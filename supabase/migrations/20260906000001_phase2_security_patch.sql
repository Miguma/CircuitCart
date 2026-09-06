-- CircuitCart — Phase 2 Security and Data Integrity Patch
-- Date: 2026-09-06

-- 1. Hardened Product UPDATE and DELETE Policies (verifying current DB profile role)
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

-- 2. Hardened Product Images UPDATE and DELETE Policies
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

-- 3. Hardened Shop UPDATE Policy (Shop owners cannot unsuspend a suspended shop, status must be active/vacation)
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

-- 4. Storage Bucket Server-Side Limits & Hardening
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

-- 5. Hardened Storage Objects Policies for product-images bucket
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
