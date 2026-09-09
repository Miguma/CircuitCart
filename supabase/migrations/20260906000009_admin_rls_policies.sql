-- =======================================================
-- CIRCUITCART MIGRATION: ADMIN ROW LEVEL SECURITY POLICIES
-- Date: 2026-09-09
-- Purpose: Grant SELECT access to authenticated administrators (role = 'admin')
-- for platform monitoring across shops, products, product_images, orders, and order_items.
-- Authority strictly derived from public.profiles.role.
-- =======================================================

-- 1. Shops: Allow admins to view all shops regardless of status
drop policy if exists "Admins can view all shops" on public.shops;
create policy "Admins can view all shops"
  on public.shops
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 2. Products: Allow admins to view all products regardless of status or stock
drop policy if exists "Admins can view all products" on public.products;
create policy "Admins can view all products"
  on public.products
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 3. Product Images: Allow admins to view all product images
drop policy if exists "Admins can view all product images" on public.product_images;
create policy "Admins can view all product images"
  on public.product_images
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 4. Orders: Allow admins to view all platform orders
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
  on public.orders
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 5. Order Items: Allow admins to view all order items
drop policy if exists "Admins can view all order items" on public.order_items;
create policy "Admins can view all order items"
  on public.order_items
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
