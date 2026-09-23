-- CircuitCart — Phase 7: Reviews & Ratings Backend Foundation
-- Date: 2026-09-06
-- Description:
-- 1. Create public.reviews table with strict FKs, check constraints, and unique order_item_id
-- 2. Add rating and review_count aggregates to public.products with atomic recalculation trigger
-- 3. Create secure submit_product_review SECURITY DEFINER RPC with purchase verification
-- 4. Enable RLS: public read-only, all mutations strictly guarded through the secure RPC

-- ========================================================
-- 1. REVIEWS TABLE
-- ========================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or length(trim(comment)) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Performance indexes for marketplace and buyer queries
create index if not exists idx_reviews_product_id on public.reviews(product_id);
create index if not exists idx_reviews_buyer_id on public.reviews(buyer_id);
create index if not exists idx_reviews_order_id on public.reviews(order_id);
create index if not exists idx_reviews_created_at on public.reviews(created_at desc);

-- ========================================================
-- 2. PRODUCT AGGREGATES & ATOMIC RECALCULATION TRIGGER
-- ========================================================

-- Add aggregate rating columns to products
alter table public.products
  add column if not exists rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  add column if not exists review_count integer not null default 0 check (review_count >= 0);

-- Trigger function to recalculate product rating and review_count atomically
create or replace function public.handle_review_product_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prod_id uuid;
begin
  -- For INSERT or UPDATE, recalculate for the affected new product
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    v_prod_id := new.product_id;
    update public.products
    set
      rating = coalesce((
        select round(avg(rating)::numeric, 1)
        from public.reviews
        where product_id = v_prod_id
      ), 0),
      review_count = coalesce((
        select count(*)::integer
        from public.reviews
        where product_id = v_prod_id
      ), 0)
    where id = v_prod_id;
  end if;

  -- For DELETE, recalculate for the deleted review's product
  if tg_op = 'DELETE' then
    v_prod_id := old.product_id;
    update public.products
    set
      rating = coalesce((
        select round(avg(rating)::numeric, 1)
        from public.reviews
        where product_id = v_prod_id
      ), 0),
      review_count = coalesce((
        select count(*)::integer
        from public.reviews
        where product_id = v_prod_id
      ), 0)
    where id = v_prod_id;
  end if;

  -- If UPDATE changed the product_id (defensive check), recalculate the old product as well
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    v_prod_id := old.product_id;
    update public.products
    set
      rating = coalesce((
        select round(avg(rating)::numeric, 1)
        from public.reviews
        where product_id = v_prod_id
      ), 0),
      review_count = coalesce((
        select count(*)::integer
        from public.reviews
        where product_id = v_prod_id
      ), 0)
    where id = v_prod_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trigger_review_product_aggregate on public.reviews;
create trigger trigger_review_product_aggregate
  after insert or update or delete on public.reviews
  for each row
  execute function public.handle_review_product_aggregate();

-- Revoke direct execution of the internal trigger helper from all application roles
revoke execute on function public.handle_review_product_aggregate() from public, anon, authenticated;

-- ========================================================
-- 3. SECURE REVIEW SUBMISSION / EDIT RPC
-- ========================================================

create or replace function public.submit_product_review(
  p_order_item_id uuid,
  p_rating integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_item record;
  v_clean_comment text;
  v_review_id uuid;
begin
  -- 1. Validate caller authentication
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Authentication required.';
  end if;

  -- 2. Validate rating range (1 to 5)
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  -- 3. Sanitize and validate comment
  v_clean_comment := nullif(trim(p_comment), '');
  if v_clean_comment is not null and length(v_clean_comment) > 1000 then
    raise exception 'Review comment must not exceed 1000 characters.';
  end if;

  -- 4. Retrieve order item details with its parent order
  select
    oi.id as order_item_id,
    oi.order_id,
    oi.product_id,
    o.buyer_id,
    o.seller_id,
    o.status as order_status
  into v_item
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_order_item_id;

  if not found then
    raise exception 'Order item not found.';
  end if;

  -- 5. Strict ownership verification
  if v_item.buyer_id <> v_buyer_id then
    raise exception 'Unauthorized: You did not purchase this order item.';
  end if;

  -- 6. Strict completed order requirement
  if v_item.order_status <> 'completed' then
    raise exception 'You can only review products from completed orders.';
  end if;

  -- 7. Ensure reviewed product listing is intact
  if v_item.product_id is null then
    raise exception 'The product listing for this item is no longer available.';
  end if;

  -- 8. Disallow seller self-review
  if v_item.seller_id = v_buyer_id then
    raise exception 'Sellers cannot review their own products.';
  end if;

  -- 9. Insert or update review (one review per order_item_id)
  -- Crucial: ON CONFLICT only mutates rating, comment, and updated_at.
  -- Identity fields (buyer_id, order_item_id, order_id, product_id) remain immutable.
  insert into public.reviews (
    order_item_id,
    order_id,
    product_id,
    buyer_id,
    rating,
    comment,
    created_at,
    updated_at
  ) values (
    v_item.order_item_id,
    v_item.order_id,
    v_item.product_id,
    v_buyer_id,
    p_rating,
    v_clean_comment,
    now(),
    now()
  )
  on conflict (order_item_id) do update set
    rating = excluded.rating,
    comment = excluded.comment,
    updated_at = now()
  returning id into v_review_id;

  return v_review_id;
end;
$$;

-- 4. RPC Permissions: Authenticated callers only, no anon execution
revoke execute on function public.submit_product_review(uuid, integer, text) from public, anon;
grant execute on function public.submit_product_review(uuid, integer, text) to authenticated;

-- ========================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ========================================================

alter table public.reviews enable row level security;

-- Public can read all verified product reviews
drop policy if exists "Public can view reviews" on public.reviews;
create policy "Public can view reviews"
  on public.reviews
  for select
  using (true);

-- Direct INSERT, UPDATE, and DELETE are strictly disallowed via REST API.
-- All mutations must be executed through the secure submit_product_review RPC.
-- By defining no INSERT / UPDATE / DELETE policies, Supabase default-deny blocks any direct REST mutations.
