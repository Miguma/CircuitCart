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
