-- CircuitCart — Phase 3: Persistent Cart + Favorites Migration
-- Date: 2026-09-06

-- 1. Create cart_items table
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

-- 2. Create favorites table
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
