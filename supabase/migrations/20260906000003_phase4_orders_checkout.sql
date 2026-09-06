-- CircuitCart — Phase 4: Real Checkout + Orders Migration
-- Date: 2026-09-06

-- 1. Create orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  shop_id uuid not null references public.shops(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'preparing', 'ready', 'shipped', 'completed', 'cancelled')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  delivery_method text not null check (delivery_method in ('delivery', 'meetup')),
  shipping_name text,
  shipping_phone text,
  shipping_address text,
  buyer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create index if not exists idx_orders_buyer_id on public.orders(buyer_id);
create index if not exists idx_orders_seller_id on public.orders(seller_id);
create index if not exists idx_orders_shop_id on public.orders(shop_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

alter table public.orders enable row level security;

-- Orders RLS Policies
drop policy if exists "Buyers and Sellers can view their own orders" on public.orders;
create policy "Buyers and Sellers can view their own orders"
  on public.orders
  for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
  before update on public.orders
  for each row
  execute function public.handle_updated_at();

-- 2. Create order_items table
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  product_image_path text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);

alter table public.order_items enable row level security;

-- Order Items RLS Policies
drop policy if exists "Buyers and Sellers can view their own order items" on public.order_items;
create policy "Buyers and Sellers can view their own order items"
  on public.order_items
  for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

-- 3. Transactional Checkout Function
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

  -- 3. Check and lock cart items
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

  -- 5. Validate each product in cart against locked rows
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
      s.status as shop_status
    from public.cart_items c
    join public.products p on p.id = c.product_id
    left join public.shops s on s.id = p.shop_id
    where c.user_id = v_buyer_id
  ) loop
    if v_item.product_seller_id = v_buyer_id then
      raise exception 'You cannot purchase your own listing ("%").', v_item.product_title;
    end if;

    if v_item.product_status <> 'active' then
      raise exception 'Product "%" is no longer available.', v_item.product_title;
    end if;

    if v_item.shop_status is not null and v_item.shop_status <> 'active' then
      raise exception 'The seller store for "%" is currently not accepting orders.', v_item.product_title;
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
        and (p.shop_id = v_group.shop_id or (p.shop_id is null and v_group.shop_id is null))
    ) loop
      -- Fetch primary image
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

-- 4. Transactional Order Cancellation (Buyer or Seller)
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

-- 5. Controlled Seller Order Status Transitions
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
  v_seller_id := auth.uid();
  if v_seller_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_new_status not in ('confirmed', 'preparing', 'ready', 'shipped', 'completed', 'cancelled') then
    raise exception 'Invalid status "%".', p_new_status;
  end if;

  -- Lock order
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.seller_id <> v_seller_id then
    raise exception 'You are not the seller of this order.';
  end if;

  if v_order.status = p_new_status then
    return true;
  end if;

  -- Cancellation delegate
  if p_new_status = 'cancelled' then
    return public.cancel_order(p_order_id);
  end if;

  -- Enforce transition rules
  if p_new_status = 'confirmed' then
    if v_order.status <> 'pending' then
      raise exception 'Only pending orders can be confirmed (current: %).', v_order.status;
    end if;
  elsif p_new_status = 'preparing' then
    if v_order.status not in ('pending', 'confirmed') then
      raise exception 'Cannot prepare an order in % state.', v_order.status;
    end if;
  elsif p_new_status = 'ready' then
    if v_order.status not in ('confirmed', 'preparing') then
      raise exception 'Cannot mark ready from % state.', v_order.status;
    end if;
  elsif p_new_status = 'shipped' then
    if v_order.delivery_method <> 'delivery' then
      raise exception 'Only delivery orders can be marked shipped.';
    end if;
    if v_order.status not in ('confirmed', 'preparing', 'ready') then
      raise exception 'Cannot ship order from % state.', v_order.status;
    end if;
  elsif p_new_status = 'completed' then
    if v_order.status not in ('ready', 'shipped') then
      raise exception 'Cannot complete order from % state.', v_order.status;
    end if;
  else
    raise exception 'Illegal transition to %.', p_new_status;
  end if;

  update public.orders
  set
    status = p_new_status,
    updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;
