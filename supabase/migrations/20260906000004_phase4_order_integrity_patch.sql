-- CircuitCart — Phase 4 Final Security & Data Integrity Patch
-- Date: 2026-09-06
-- Description:
-- 1. Strict order status transitions (Delivery: pending->confirmed->preparing->ready->shipped->completed, Meetup: pending->confirmed->preparing->ready->completed)
-- 2. Require valid active shop during checkout (reject missing, null, or inactive shops)
-- 3. Restrict SECURITY DEFINER RPC execute permissions to authenticated users only

-- ========================================================
-- 1. STRICT ORDER STATUS TRANSITIONS FUNCTION
-- ========================================================
create or replace function public.update_seller_order_status(
  p_order_id uuid,
  p_new_status text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seller_id uuid;
  v_order record;
begin
  -- 1. Authenticate caller
  v_seller_id := auth.uid();
  if v_seller_id is null then
    raise exception 'Authentication required.';
  end if;

  -- 2. Validate input status domain
  if p_new_status not in ('confirmed', 'preparing', 'ready', 'shipped', 'completed', 'cancelled') then
    raise exception 'Invalid status "%".', p_new_status;
  end if;

  -- 3. Lock order row for update
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  -- 4. Verify seller ownership
  if v_order.seller_id <> v_seller_id then
    raise exception 'You are not the seller of this order.';
  end if;

  -- Idempotency check
  if v_order.status = p_new_status then
    return true;
  end if;

  -- Disallow transitions from terminal states
  if v_order.status = 'completed' then
    raise exception 'Completed orders cannot change status.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Cancelled orders cannot change status.';
  end if;

  -- 5. Cancellation delegate (cancel_order handles pending/confirmed -> cancelled + stock rollback)
  if p_new_status = 'cancelled' then
    return public.cancel_order(p_order_id);
  end if;

  -- 6. Enforce strict linear transitions
  if p_new_status = 'confirmed' then
    if v_order.status <> 'pending' then
      raise exception 'Only pending orders can be confirmed (current: %).', v_order.status;
    end if;
  elsif p_new_status = 'preparing' then
    if v_order.status <> 'confirmed' then
      raise exception 'Only confirmed orders can move to preparing (current: %).', v_order.status;
    end if;
  elsif p_new_status = 'ready' then
    if v_order.status <> 'preparing' then
      raise exception 'Only preparing orders can be marked ready (current: %).', v_order.status;
    end if;
  elsif p_new_status = 'shipped' then
    if v_order.delivery_method <> 'delivery' then
      raise exception 'Only delivery orders can be marked shipped.';
    end if;
    if v_order.status <> 'ready' then
      raise exception 'Delivery orders must be marked ready before shipping (current: %).', v_order.status;
    end if;
  elsif p_new_status = 'completed' then
    if v_order.delivery_method = 'delivery' then
      if v_order.status <> 'shipped' then
        raise exception 'Delivery orders must be shipped before being marked completed (current: %).', v_order.status;
      end if;
    elsif v_order.delivery_method = 'meetup' then
      if v_order.status <> 'ready' then
        raise exception 'Meetup orders must be marked ready before being marked completed (current: %).', v_order.status;
      end if;
    else
      raise exception 'Invalid delivery method "%" for order completion.', v_order.delivery_method;
    end if;
  else
    raise exception 'Illegal status transition from % to %.', v_order.status, p_new_status;
  end if;

  -- 7. Update status
  update public.orders
  set
    status = p_new_status,
    updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;


-- ========================================================
-- 2. REQUIRE VALID ACTIVE SHOP DURING CHECKOUT
-- ========================================================
create or replace function public.checkout_cart(
  p_delivery_method text,
  p_shipping_name text default null,
  p_shipping_phone text default null,
  p_shipping_address text default null,
  p_buyer_note text default null
)
returns table (order_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_cart_count integer;
  v_group record;
  v_item record;
  v_new_order_id uuid;
  v_group_subtotal numeric(12,2);
  v_group_shipping numeric(12,2);
  v_group_total numeric(12,2);
  v_primary_image text;
begin
  -- 1. Identify authenticated buyer
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Authentication required for checkout.';
  end if;

  -- 2. Validate delivery inputs
  if p_delivery_method not in ('delivery', 'meetup') then
    raise exception 'Invalid delivery method "%"', p_delivery_method;
  end if;

  if p_delivery_method = 'delivery' then
    if p_shipping_name is null or trim(p_shipping_name) = '' then
      raise exception 'Shipping recipient name is required for delivery.';
    end if;
    if p_shipping_phone is null or trim(p_shipping_phone) = '' then
      raise exception 'Shipping phone number is required for delivery.';
    end if;
    if p_shipping_address is null or trim(p_shipping_address) = '' then
      raise exception 'Shipping address is required for delivery.';
    end if;
  end if;

  -- 3. Check cart existence
  select count(*) into v_cart_count
  from public.cart_items
  where user_id = v_buyer_id;

  if v_cart_count = 0 then
    raise exception 'Your cart is empty.';
  end if;

  -- 4. Lock products involved in cart for update to prevent race conditions / overselling
  perform p.id
  from public.products p
  where p.id in (
    select c.product_id
    from public.cart_items c
    where c.user_id = v_buyer_id
  )
  for update of p;

  -- 5. Validate each product in cart against locked rows and enforce ACTIVE SHOP REQUIREMENT
  for v_item in (
    select
      c.id as cart_item_id,
      c.quantity as requested_qty,
      p.id as product_id,
      p.title as product_title,
      p.price as db_price,
      p.stock as current_stock,
      p.status as product_status,
      p.seller_id as product_seller_id,
      p.shop_id as product_shop_id,
      s.id as shop_exists_id,
      s.owner_id as shop_owner_id,
      s.status as shop_status
    from public.cart_items c
    join public.products p on p.id = c.product_id
    left join public.shops s on s.id = p.shop_id
    where c.user_id = v_buyer_id
  ) loop
    -- Non-self purchase check
    if v_item.product_seller_id = v_buyer_id then
      raise exception 'You cannot purchase your own listing ("%").', v_item.product_title;
    end if;

    -- Strict shop validation: must exist, have valid owner, and be 'active'
    if v_item.product_shop_id is null or v_item.shop_exists_id is null then
      raise exception 'Product "%" cannot be purchased because it does not belong to a valid shop.', v_item.product_title;
    end if;

    if v_item.shop_owner_id <> v_item.product_seller_id then
      raise exception 'Product "%" shop owner mismatch.', v_item.product_title;
    end if;

    if v_item.shop_status <> 'active' then
      raise exception 'Product "%" cannot be purchased because its shop is currently %.', v_item.product_title, coalesce(v_item.shop_status, 'inactive');
    end if;

    -- Product status and inventory checks
    if v_item.product_status <> 'active' then
      raise exception 'Product "%" is no longer available.', v_item.product_title;
    end if;

    if v_item.current_stock <= 0 then
      raise exception 'Product "%" is sold out.', v_item.product_title;
    end if;

    if v_item.requested_qty > v_item.current_stock then
      raise exception 'Only % units of "%" remain in stock.', v_item.current_stock, v_item.product_title;
    end if;
  end loop;

  -- 6. Group cart by shop/seller and create separate orders
  for v_group in (
    select
      p.seller_id,
      p.shop_id,
      sum(p.price * c.quantity) as subtotal
    from public.cart_items c
    join public.products p on p.id = c.product_id
    where c.user_id = v_buyer_id
    group by p.seller_id, p.shop_id
  ) loop
    if v_group.shop_id is null then
      raise exception 'Cannot create order: missing shop identifier.';
    end if;

    v_group_subtotal := v_group.subtotal;

    -- Calculate shipping fee per shop (Free shipping if meetup or subtotal >= 10,000)
    if p_delivery_method = 'meetup' or v_group_subtotal >= 10000 then
      v_group_shipping := 0;
    else
      v_group_shipping := 150;
    end if;

    v_group_total := v_group_subtotal + v_group_shipping;

    -- Create order for this seller/shop
    insert into public.orders (
      buyer_id,
      shop_id,
      seller_id,
      status,
      subtotal,
      shipping_fee,
      total,
      delivery_method,
      shipping_name,
      shipping_phone,
      shipping_address,
      buyer_note
    ) values (
      v_buyer_id,
      v_group.shop_id,
      v_group.seller_id,
      'pending',
      v_group_subtotal,
      v_group_shipping,
      v_group_total,
      p_delivery_method,
      p_shipping_name,
      p_shipping_phone,
      p_shipping_address,
      p_buyer_note
    ) returning id into v_new_order_id;

    -- Insert snapshot order items and decrement inventory
    for v_item in (
      select
        c.quantity,
        p.id as product_id,
        p.title,
        p.price,
        p.stock
      from public.cart_items c
      join public.products p on p.id = c.product_id
      where c.user_id = v_buyer_id
        and p.seller_id = v_group.seller_id
        and p.shop_id = v_group.shop_id
    ) loop
      -- Fetch primary image for snapshot
      select storage_path into v_primary_image
      from public.product_images
      where product_id = v_item.product_id
      order by sort_order asc
      limit 1;

      -- Insert historical snapshot
      insert into public.order_items (
        order_id,
        product_id,
        product_title,
        product_image_path,
        unit_price,
        quantity,
        line_total
      ) values (
        v_new_order_id,
        v_item.product_id,
        v_item.title,
        v_primary_image,
        v_item.price,
        v_item.quantity,
        (v_item.price * v_item.quantity)
      );

      -- Decrement inventory transactionally
      update public.products
      set
        stock = stock - v_item.quantity,
        status = case when (stock - v_item.quantity) <= 0 then 'sold_out' else status end
      where id = v_item.product_id;
    end loop;

    -- Return order ID to caller
    order_id := v_new_order_id;
    return next;
  end loop;

  -- 7. Delete purchased cart items for this buyer
  delete from public.cart_items
  where user_id = v_buyer_id;

  return;
end;
$$;


-- ========================================================
-- 3. TRANSACTIONAL ORDER CANCELLATION
-- ========================================================
create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_order record;
  v_item record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  -- Lock order row
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  -- Verify permissions: Buyer can cancel 'pending'; Seller can cancel 'pending' or 'confirmed'
  if v_order.buyer_id = v_user_id then
    if v_order.status <> 'pending' then
      raise exception 'Buyers may only cancel pending orders.';
    end if;
  elsif v_order.seller_id = v_user_id then
    if v_order.status not in ('pending', 'confirmed') then
      raise exception 'Sellers cannot cancel orders that are already %.', v_order.status;
    end if;
  else
    raise exception 'You do not have permission to cancel this order.';
  end if;

  -- Mark cancelled
  update public.orders
  set
    status = 'cancelled',
    updated_at = now()
  where id = p_order_id;

  -- Restore inventory transactionally
  for v_item in (
    select product_id, quantity
    from public.order_items
    where order_id = p_order_id
      and product_id is not null
  ) loop
    update public.products
    set
      stock = stock + v_item.quantity,
      status = case when status = 'sold_out' and (stock + v_item.quantity) > 0 then 'active' else status end
    where id = v_item.product_id;
  end loop;

  return true;
end;
$$;


-- ========================================================
-- 4. EXPLICIT FUNCTION EXECUTE PERMISSIONS
-- ========================================================

-- Revoke from PUBLIC and anon
revoke execute on function public.checkout_cart(text, text, text, text, text) from public;
revoke execute on function public.checkout_cart(text, text, text, text, text) from anon;
grant execute on function public.checkout_cart(text, text, text, text, text) to authenticated;

revoke execute on function public.cancel_order(uuid, text) from public;
revoke execute on function public.cancel_order(uuid, text) from anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

revoke execute on function public.update_seller_order_status(uuid, text) from public;
revoke execute on function public.update_seller_order_status(uuid, text) from anon;
grant execute on function public.update_seller_order_status(uuid, text) to authenticated;
