-- CircuitCart — Phase 9: Payment & Fulfillment Backend Foundation
-- Date: 2026-09-06
-- Description:
-- 1. Persistent payment fields on public.orders (payment_method, payment_status, payment_reference)
-- 2. Persistent fulfillment tracking fields on public.orders (courier_name, tracking_number)
-- 3. Authoritative checkout_cart RPC with payment method validation and backward compatibility
-- 4. Authoritative update_seller_order_status RPC with courier and tracking number persistence
-- 5. Revocation of execute permissions from public/anon with authenticated grants

-- ========================================================
-- 1. ADD PAYMENT & FULFILLMENT COLUMNS TO public.orders
-- ========================================================

-- A. Payment Method
alter table public.orders add column if not exists payment_method text;

-- Backfill existing orders based on delivery method
update public.orders
set payment_method = case
  when delivery_method = 'meetup' then 'cash_on_meetup'
  else 'cash_on_delivery'
end
where payment_method is null;

alter table public.orders alter column payment_method set default 'cash_on_delivery';
alter table public.orders alter column payment_method set not null;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cash_on_delivery', 'cash_on_meetup', 'manual_gcash', 'manual_maya'));

-- B. Payment Status
alter table public.orders add column if not exists payment_status text;

-- Backfill existing orders conservatively as pending (no manufactured financial history)
update public.orders
set payment_status = 'pending'
where payment_status is null;

alter table public.orders alter column payment_status set default 'pending';
alter table public.orders alter column payment_status set not null;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'refunded'));

-- C. Payment Reference (Optional external manual receipt/reference number)
alter table public.orders add column if not exists payment_reference text;

alter table public.orders drop constraint if exists orders_payment_reference_check;
alter table public.orders add constraint orders_payment_reference_check
  check (payment_reference is null or length(trim(payment_reference)) <= 100);

-- D. Courier Name (Optional for delivery orders)
alter table public.orders add column if not exists courier_name text;

alter table public.orders drop constraint if exists orders_courier_name_check;
alter table public.orders add constraint orders_courier_name_check
  check (courier_name is null or length(trim(courier_name)) <= 100);

-- E. Tracking Number (Optional for delivery orders)
alter table public.orders add column if not exists tracking_number text;

alter table public.orders drop constraint if exists orders_tracking_number_check;
alter table public.orders add constraint orders_tracking_number_check
  check (tracking_number is null or length(trim(tracking_number)) <= 100);

-- F. Indexes
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_payment_method on public.orders(payment_method);
create index if not exists idx_orders_tracking_number on public.orders(tracking_number) where tracking_number is not null;


-- ========================================================
-- 2. HARDENED checkout_cart RPC WITH PAYMENT METHOD
-- ========================================================

-- Drop prior 5-argument overload to prevent PostgreSQL candidate ambiguity
drop function if exists public.checkout_cart(text, text, text, text, text);

create or replace function public.checkout_cart(
  p_delivery_method text,
  p_shipping_name text default null,
  p_shipping_phone text default null,
  p_shipping_address text default null,
  p_buyer_note text default null,
  p_payment_method text default null
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
  v_payment_method text;
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

  -- 3. Resolve & validate payment method (Backward-compatible defaulting)
  if p_payment_method is null or trim(p_payment_method) = '' then
    if p_delivery_method = 'meetup' then
      v_payment_method := 'cash_on_meetup';
    else
      v_payment_method := 'cash_on_delivery';
    end if;
  else
    v_payment_method := trim(p_payment_method);
    if v_payment_method not in ('cash_on_delivery', 'cash_on_meetup', 'manual_gcash', 'manual_maya') then
      raise exception 'Invalid payment method "%".', v_payment_method;
    end if;

    -- Strict compatibility between fulfillment method and payment method
    if p_delivery_method = 'meetup' and v_payment_method = 'cash_on_delivery' then
      raise exception 'Cash on Delivery is not valid for meetup fulfillment.';
    end if;

    if p_delivery_method = 'delivery' and v_payment_method = 'cash_on_meetup' then
      raise exception 'Cash on Meetup is not valid for delivery fulfillment.';
    end if;
  end if;

  -- 4. Check cart existence
  select count(*) into v_cart_count
  from public.cart_items
  where user_id = v_buyer_id;

  if v_cart_count = 0 then
    raise exception 'Your cart is empty.';
  end if;

  -- 5. Lock products involved in cart for update to prevent race conditions / overselling
  perform p.id
  from public.products p
  where p.id in (
    select c.product_id
    from public.cart_items c
    where c.user_id = v_buyer_id
  )
  for update of p;

  -- 6. Validate each product in cart against locked rows and enforce ACTIVE SHOP REQUIREMENT
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

  -- 7. Group cart by shop/seller and create separate orders
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

    -- Create order for this seller/shop with authoritative payment state
    insert into public.orders (
      buyer_id,
      shop_id,
      seller_id,
      status,
      subtotal,
      shipping_fee,
      total,
      delivery_method,
      payment_method,
      payment_status,
      payment_reference,
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
      v_payment_method,
      'pending',
      null,
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

  -- 8. Delete purchased cart items for this buyer
  delete from public.cart_items
  where user_id = v_buyer_id;

  return;
end;
$$;


-- ========================================================
-- 3. HARDENED update_seller_order_status RPC WITH TRACKING
-- ========================================================

-- Drop prior 2-argument overload to prevent PostgreSQL candidate ambiguity
drop function if exists public.update_seller_order_status(uuid, text);

create or replace function public.update_seller_order_status(
  p_order_id uuid,
  p_new_status text,
  p_tracking_number text default null,
  p_courier_name text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seller_id uuid;
  v_order record;
  v_clean_tracking text;
  v_clean_courier text;
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

  -- 3. Clean optional tracking inputs
  v_clean_tracking := nullif(trim(p_tracking_number), '');
  v_clean_courier := nullif(trim(p_courier_name), '');

  if v_clean_tracking is not null and length(v_clean_tracking) > 100 then
    raise exception 'Tracking number cannot exceed 100 characters.';
  end if;

  if v_clean_courier is not null and length(v_clean_courier) > 100 then
    raise exception 'Courier name cannot exceed 100 characters.';
  end if;

  -- 4. Lock order row for update
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  -- 5. Verify seller ownership
  if v_order.seller_id <> v_seller_id then
    raise exception 'You are not the seller of this order.';
  end if;

  -- Meetup tracking guard: meetup orders cannot have courier/tracking numbers
  if v_order.delivery_method = 'meetup' and (v_clean_tracking is not null or v_clean_courier is not null) then
    raise exception 'Tracking information cannot be assigned to meetup orders.';
  end if;

  -- Idempotency check with tracking update support
  if v_order.status = p_new_status then
    if p_new_status = 'shipped' and (v_clean_tracking is not null or v_clean_courier is not null) then
      update public.orders
      set
        tracking_number = coalesce(v_clean_tracking, tracking_number),
        courier_name = coalesce(v_clean_courier, courier_name),
        updated_at = now()
      where id = p_order_id;
    end if;
    return true;
  end if;

  -- Disallow transitions from terminal states
  if v_order.status = 'completed' then
    raise exception 'Completed orders cannot change status.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Cancelled orders cannot change status.';
  end if;

  -- 6. Cancellation delegate (cancel_order handles pending/confirmed -> cancelled + stock rollback)
  if p_new_status = 'cancelled' then
    return public.cancel_order(p_order_id);
  end if;

  -- 7. Enforce strict linear transitions
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

  -- 8. Update status and fulfillment tracking
  update public.orders
  set
    status = p_new_status,
    tracking_number = case
      when p_new_status = 'shipped' and v_clean_tracking is not null then v_clean_tracking
      else tracking_number
    end,
    courier_name = case
      when p_new_status = 'shipped' and v_clean_courier is not null then v_clean_courier
      else courier_name
    end,
    updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;


-- ========================================================
-- 4. FUNCTION EXECUTE PERMISSIONS
-- ========================================================

revoke execute on function public.checkout_cart(text, text, text, text, text, text) from public;
revoke execute on function public.checkout_cart(text, text, text, text, text, text) from anon;
grant execute on function public.checkout_cart(text, text, text, text, text, text) to authenticated;

revoke execute on function public.update_seller_order_status(uuid, text, text, text) from public;
revoke execute on function public.update_seller_order_status(uuid, text, text, text) from anon;
grant execute on function public.update_seller_order_status(uuid, text, text, text) to authenticated;
