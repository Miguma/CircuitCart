-- =======================================================
-- CIRCUITCART COMPLETE DATABASE SCHEMA
-- PROFILES, SHOPS, PRODUCTS, PRODUCT IMAGES & STORAGE
-- =======================================================

-- 1. Create profiles table linked to Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  location text,
  bio text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles RLS Policies
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles
  for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile as buyer" on public.profiles;
create policy "Users can insert their own profile as buyer"
  on public.profiles
  for insert
  with check (
    auth.uid() = id
    and role = 'buyer'
  );

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own profile except role" on public.profiles;
create policy "Users can update own profile except role"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Function & Trigger for automatic updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Function & Trigger for automatic Profile creation on User Signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_full_name text;
  user_username text;
  clean_username text;
begin
  user_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  user_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  clean_username := lower(regexp_replace(user_username, '[^a-zA-Z0-9_]', '', 'g'));

  if clean_username = '' then
    clean_username := 'user_' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (id, full_name, username, role, created_at, updated_at)
  values (
    new.id,
    user_full_name,
    clean_username,
    'buyer',
    now(),
    now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Create shops table
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  banner_url text,
  location text,
  status text not null default 'active' check (status in ('active', 'vacation', 'suspended')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on shops
alter table public.shops enable row level security;

-- Shops RLS Policies
drop policy if exists "Public can view active shops" on public.shops;
create policy "Public can view active shops"
  on public.shops
  for select
  using (status = 'active' or auth.uid() = owner_id);

drop policy if exists "Sellers can insert their own shop" on public.shops;
create policy "Sellers can insert their own shop"
  on public.shops
  for insert
  with check (
    auth.uid() = owner_id
    and is_verified = false
    and status in ('active', 'vacation')
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );

drop policy if exists "Shop owners can update their own shop" on public.shops;
create policy "Shop owners can update their own shop"
  on public.shops
  for update
  using (
    auth.uid() = owner_id
    and status != 'suspended'
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  )
  with check (
    auth.uid() = owner_id
    and is_verified = (select s.is_verified from public.shops s where s.id = shops.id)
    and owner_id = (select s.owner_id from public.shops s where s.id = shops.id)
    and status in ('active', 'vacation')
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );

drop trigger if exists set_shops_updated_at on public.shops;
create trigger set_shops_updated_at
  before update on public.shops
  for each row
  execute function public.handle_updated_at();

-- 3. Create products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete set null,
  title text not null,
  slug text,
  description text,
  specs text,
  category text not null,
  condition text not null check (condition in ('New', 'Like New', 'Good', 'Fair')),
  price numeric(12,2) not null check (price > 0),
  original_price numeric(12,2) check (original_price is null or original_price >= 0),
  stock integer not null default 1 check (stock >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'sold_out', 'archived')),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

-- Enable RLS on products
alter table public.products enable row level security;

-- Products RLS Policies
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products
  for select
  using ((status = 'active' and stock > 0) or seller_id = auth.uid());

drop policy if exists "Sellers can insert their own products" on public.products;
create policy "Sellers can insert their own products"
  on public.products
  for insert
  with check (
    seller_id = auth.uid()
    and (shop_id is null or shop_id in (select id from public.shops where owner_id = auth.uid()))
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );

drop policy if exists "Sellers can update their own products" on public.products;
create policy "Sellers can update their own products"
  on public.products
  for update
  using (
    seller_id = auth.uid()
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  )
  with check (
    seller_id = auth.uid()
    and (shop_id is null or shop_id in (select id from public.shops where owner_id = auth.uid()))
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );

drop policy if exists "Sellers can delete their own products" on public.products;
create policy "Sellers can delete their own products"
  on public.products
  for delete
  using (
    seller_id = auth.uid()
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row
  execute function public.handle_updated_at();

-- 4. Create product_images table
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Enable RLS on product_images
alter table public.product_images enable row level security;

-- Product Images RLS Policies
drop policy if exists "Public can view active product images" on public.product_images;
create policy "Public can view active product images"
  on public.product_images
  for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
      and (p.status = 'active' or p.seller_id = auth.uid())
    )
  );

drop policy if exists "Sellers can insert images for their own products" on public.product_images;
create policy "Sellers can insert images for their own products"
  on public.product_images
  for insert
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
      and p.seller_id = auth.uid()
    )
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );

drop policy if exists "Sellers can update images for their own products" on public.product_images;
create policy "Sellers can update images for their own products"
  on public.product_images
  for update
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
      and p.seller_id = auth.uid()
    )
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
      and p.seller_id = auth.uid()
    )
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );

drop policy if exists "Sellers can delete images for their own products" on public.product_images;
create policy "Sellers can delete images for their own products"
  on public.product_images
  for delete
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
      and p.seller_id = auth.uid()
    )
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );

-- 5. Storage Bucket Setup (Public product-images bucket with 5MB & image mime limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage Policies
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects
  for select
  using (bucket_id = 'product-images');

drop policy if exists "Sellers can upload own product images" on storage.objects;
create policy "Sellers can upload own product images"
  on storage.objects
  for insert
  with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[2]
      and p.seller_id = auth.uid()
    )
  );

drop policy if exists "Sellers can update own product images" on storage.objects;
create policy "Sellers can update own product images"
  on storage.objects
  for update
  using (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[2]
      and p.seller_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[2]
      and p.seller_id = auth.uid()
    )
  );

drop policy if exists "Sellers can delete own product images" on storage.objects;
create policy "Sellers can delete own product images"
  on storage.objects
  for delete
  using (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[2]
      and p.seller_id = auth.uid()
    )
  );

-- 6. Create cart_items table
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, product_id)
);

-- Enable RLS on cart_items
alter table public.cart_items enable row level security;

-- Cart Items RLS Policies
drop policy if exists "Users can view their own cart items" on public.cart_items;
create policy "Users can view their own cart items"
  on public.cart_items
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own cart items" on public.cart_items;
create policy "Users can insert their own cart items"
  on public.cart_items
  for insert
  with check (
    user_id = auth.uid()
    and quantity > 0
    and exists (
      select 1 from public.products p
      where p.id = cart_items.product_id
      and p.status = 'active'
      and p.stock > 0
    )
  );

drop policy if exists "Users can update their own cart items" on public.cart_items;
create policy "Users can update their own cart items"
  on public.cart_items
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and quantity > 0
  );

drop policy if exists "Users can delete their own cart items" on public.cart_items;
create policy "Users can delete their own cart items"
  on public.cart_items
  for delete
  using (user_id = auth.uid());

drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at
  before update on public.cart_items
  for each row
  execute function public.handle_updated_at();

-- 7. Create favorites table
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

-- Enable RLS on favorites
alter table public.favorites enable row level security;

-- Favorites RLS Policies
drop policy if exists "Users can view their own favorites" on public.favorites;
create policy "Users can view their own favorites"
  on public.favorites
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own favorites" on public.favorites;
create policy "Users can insert their own favorites"
  on public.favorites
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.products p
      where p.id = favorites.product_id
    )
  );

drop policy if exists "Users can delete their own favorites" on public.favorites;
create policy "Users can delete their own favorites"
  on public.favorites
  for delete
  using (user_id = auth.uid());

-- 8. Create orders table
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

-- 9. Create order_items table
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

-- 10. Transactional Checkout Function (Requires Active Shop, Prevents Self-Purchase, Transactional Locking)
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

-- 11. Transactional Order Cancellation (Buyer or Seller)
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

-- 12. Strict Seller Order Status Transitions
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

  -- Disallow transitions from terminal states
  if v_order.status = 'completed' then
    raise exception 'Completed orders cannot change status.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Cancelled orders cannot change status.';
  end if;

  -- Cancellation delegate (cancel_order handles pending/confirmed -> cancelled + stock rollback)
  if p_new_status = 'cancelled' then
    return public.cancel_order(p_order_id);
  end if;

  -- Enforce strict linear transitions
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

  update public.orders
  set
    status = p_new_status,
    updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;

-- 13. Explicit RPC Function Execute Permissions
revoke execute on function public.checkout_cart(text, text, text, text, text) from public;
revoke execute on function public.checkout_cart(text, text, text, text, text) from anon;
grant execute on function public.checkout_cart(text, text, text, text, text) to authenticated;

revoke execute on function public.cancel_order(uuid, text) from public;
revoke execute on function public.cancel_order(uuid, text) from anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

revoke execute on function public.update_seller_order_status(uuid, text) from public;
revoke execute on function public.update_seller_order_status(uuid, text) from anon;
grant execute on function public.update_seller_order_status(uuid, text) to authenticated;

-- ========================================================
-- 14. Phase 5: Real Buyer ↔ Seller Messaging
-- ========================================================

-- Conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  last_message_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (product_id is not null or order_id is not null or shop_id is not null)
);

create unique index if not exists idx_unique_buyer_seller_product
  on public.conversations(buyer_id, seller_id, product_id)
  where product_id is not null and order_id is null;

create unique index if not exists idx_unique_order_conversation
  on public.conversations(order_id)
  where order_id is not null;

create unique index if not exists idx_unique_buyer_seller_shop
  on public.conversations(buyer_id, seller_id, shop_id)
  where product_id is null and order_id is null and shop_id is not null;

create index if not exists idx_conversations_buyer_id on public.conversations(buyer_id);
create index if not exists idx_conversations_seller_id on public.conversations(seller_id);
create index if not exists idx_conversations_shop_id on public.conversations(shop_id);
create index if not exists idx_conversations_product_id on public.conversations(product_id);
create index if not exists idx_conversations_order_id on public.conversations(order_id);
create index if not exists idx_conversations_last_message_at on public.conversations(last_message_at desc);

alter table public.conversations enable row level security;

drop policy if exists "Participants can view their conversations" on public.conversations;
create policy "Participants can view their conversations"
  on public.conversations
  for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "Participants can insert their conversations" on public.conversations;
create policy "Participants can insert their conversations"
  on public.conversations
  for insert
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "Participants can update their conversations" on public.conversations;
create policy "Participants can update their conversations"
  on public.conversations
  for update
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (length(trim(body)) > 0 and length(body) <= 5000)
);

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at asc);

create index if not exists idx_messages_sender_id
  on public.messages(sender_id);

create index if not exists idx_messages_unread
  on public.messages(conversation_id, read_at)
  where read_at is null;

alter table public.messages enable row level security;

drop policy if exists "Conversation participants can view messages" on public.messages;
create policy "Conversation participants can view messages"
  on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

drop policy if exists "Conversation participants can insert their own messages" on public.messages;
create policy "Conversation participants can insert their own messages"
  on public.messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

drop policy if exists "Recipients can mark messages as read" on public.messages;
create policy "Recipients can mark messages as read"
  on public.messages
  for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  )
  with check (
    sender_id <> auth.uid()
    and read_at is not null
  );

-- Trigger for message insertion updating conversation timestamps
create or replace function public.handle_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
  set
    last_message_at = NEW.created_at,
    updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row
  execute function public.handle_message_inserted();

-- Messaging RPC Functions
create or replace function public.get_or_create_product_conversation(
  p_product_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_product record;
  v_conv_id uuid;
begin
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Authentication required.';
  end if;

  select id, seller_id, shop_id, status, title
  into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found.';
  end if;

  if v_product.seller_id = v_buyer_id then
    raise exception 'You cannot start a conversation on your own listing.';
  end if;

  select id into v_conv_id
  from public.conversations
  where buyer_id = v_buyer_id
    and seller_id = v_product.seller_id
    and product_id = p_product_id
    and order_id is null;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  insert into public.conversations (
    buyer_id,
    seller_id,
    shop_id,
    product_id
  ) values (
    v_buyer_id,
    v_product.seller_id,
    v_product.shop_id,
    p_product_id
  )
  on conflict (buyer_id, seller_id, product_id)
    where product_id is not null and order_id is null
  do update set updated_at = now()
  returning id into v_conv_id;

  return v_conv_id;
end;
$$;

create or replace function public.get_or_create_order_conversation(
  p_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid;
  v_order record;
  v_conv_id uuid;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Authentication required.';
  end if;

  select id, buyer_id, seller_id, shop_id
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.buyer_id <> v_caller_id and v_order.seller_id <> v_caller_id then
    raise exception 'You are not a participant of this order.';
  end if;

  select id into v_conv_id
  from public.conversations
  where order_id = p_order_id;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  insert into public.conversations (
    buyer_id,
    seller_id,
    shop_id,
    order_id
  ) values (
    v_order.buyer_id,
    v_order.seller_id,
    v_order.shop_id,
    p_order_id
  )
  on conflict (order_id)
    where order_id is not null
  do update set updated_at = now()
  returning id into v_conv_id;

  return v_conv_id;
end;
$$;

create or replace function public.get_or_create_shop_conversation(
  p_shop_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_shop record;
  v_conv_id uuid;
begin
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Authentication required.';
  end if;

  select id, owner_id, status, name
  into v_shop
  from public.shops
  where id = p_shop_id;

  if not found then
    raise exception 'Shop not found.';
  end if;

  if v_shop.owner_id = v_buyer_id then
    raise exception 'You cannot start a conversation with your own store.';
  end if;

  select id into v_conv_id
  from public.conversations
  where buyer_id = v_buyer_id
    and seller_id = v_shop.owner_id
    and shop_id = p_shop_id
    and product_id is null
    and order_id is null;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  insert into public.conversations (
    buyer_id,
    seller_id,
    shop_id
  ) values (
    v_buyer_id,
    v_shop.owner_id,
    p_shop_id
  )
  on conflict (buyer_id, seller_id, shop_id)
    where product_id is null and order_id is null and shop_id is not null
  do update set updated_at = now()
  returning id into v_conv_id;

  return v_conv_id;
end;
$$;

create or replace function public.mark_conversation_messages_read(
  p_conversation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_conv record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select id, buyer_id, seller_id
  into v_conv
  from public.conversations
  where id = p_conversation_id;

  if not found then
    raise exception 'Conversation not found.';
  end if;

  if v_conv.buyer_id <> v_user_id and v_conv.seller_id <> v_user_id then
    raise exception 'You do not participate in this conversation.';
  end if;

  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> v_user_id
    and read_at is null;

  return true;
end;
$$;

revoke execute on function public.get_or_create_product_conversation(uuid) from public;
revoke execute on function public.get_or_create_product_conversation(uuid) from anon;
grant execute on function public.get_or_create_product_conversation(uuid) to authenticated;

revoke execute on function public.get_or_create_order_conversation(uuid) from public;
revoke execute on function public.get_or_create_order_conversation(uuid) from anon;
grant execute on function public.get_or_create_order_conversation(uuid) to authenticated;

revoke execute on function public.get_or_create_shop_conversation(uuid) from public;
revoke execute on function public.get_or_create_shop_conversation(uuid) from anon;
grant execute on function public.get_or_create_shop_conversation(uuid) to authenticated;

revoke execute on function public.mark_conversation_messages_read(uuid) from public;
revoke execute on function public.mark_conversation_messages_read(uuid) from anon;
grant execute on function public.mark_conversation_messages_read(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
