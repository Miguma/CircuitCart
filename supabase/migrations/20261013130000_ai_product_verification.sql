-- ============================================================================
-- CIRCUITCART MIGRATION: AI AUTOMATIC PRODUCT VERIFICATION
-- Date: 2026-10-13
--
-- Adds AI product verification columns, audit table, triggers to prevent
-- unverified listings from becoming active, and authoritative decision RPC.
-- ============================================================================

begin;

-- 1. Extend products table with verification columns
alter table public.products
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected', 'uncertain')),
  add column if not exists verification_reason text null,
  add column if not exists verification_content_hash text null,
  add column if not exists verified_at timestamptz null,
  add column if not exists verified_by_model text null,
  add column if not exists grace_expires_at timestamptz null;

-- Index for querying products by verification status and grace expiry
create index if not exists idx_products_verification_status
  on public.products (verification_status);

create index if not exists idx_products_grace_expires_at
  on public.products (grace_expires_at)
  where grace_expires_at is not null;

-- 2. Legacy listing transition:
-- Helper predicates are kept as SQL functions so the rollout preview query, the
-- migration, and the automated tests all evaluate exactly the same rules.
--
-- Non-tech indicator: whole-word match on the TITLE or CATEGORY only.
-- Descriptions are deliberately NOT scanned: legitimate electronics listings
-- routinely contain phrases such as "cosmetic condition", "rose gold",
-- "dress code", etc. Descriptions are judged by the real AI re-verification.
create or replace function public.legacy_listing_has_non_tech_indicator(
  p_title text,
  p_category text
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    coalesce(p_title, '') ~* '\m(flowers?|bouquets?|roses?|lipsticks?|make[ -]?ups?|cosmetics?|perfumes?|dress(es)?|shoes|skin ?care)\M'
    or coalesce(p_category, '') ~* '\m(flowers?|florist|beauty|cosmetics?|fashion|apparel|clothing)\M';
$$;

-- Technology indicator: if the title or category names a technology product,
-- the listing is never auto-quarantined by keywords (it receives grace + AI).
create or replace function public.legacy_listing_has_tech_indicator(
  p_title text,
  p_category text
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    (coalesce(p_title, '') || ' ' || coalesce(p_category, '')) ~*
      '(\m(i ?phone|ipad|macbook|imac|airpods|galaxy|pixel|xiaomi|redmi|oppo|vivo|realme|huawei|smartphones?|phones?|tablets?|laptops?|notebooks?|computers?|desktops?|pc|gpu|cpu|rtx|gtx|radeon|ryzen|intel|ssd|hdd|nvme|ram|ddr[3-5]|motherboards?|monitors?|keyboards?|mouse|mice|headsets?|headphones?|earbuds?|speakers?|routers?|modems?|cameras?|consoles?|playstation|ps[45]|xbox|nintendo|chargers?|cables?|power ?banks?|smart ?watch(es)?|drones?|printers?|projectors?|electronics?|gadgets?|peripherals?|networking)\M|\m\d+ ?(gb|tb)\M)';
$$;

-- 2a. Immediately quarantine obvious non-tech legacy listings
-- (title/category says flower, bouquet, makeup, cosmetics, apparel ... AND no tech indicator).
update public.products
set verification_status = 'rejected',
    status = 'draft',
    verification_reason = 'Quarantined during AI verification rollout: non-technology item. Edit and resubmit for AI verification.',
    verified_at = clock_timestamp(),
    verified_by_model = 'legacy_rollout_quarantine'
where status = 'active'
  and public.legacy_listing_has_non_tech_indicator(title, category)
  and not public.legacy_listing_has_tech_indicator(title, category);

-- 2b. Every remaining active listing receives TEMPORARY grace approval tagged
-- 'legacy_migration_grace'.
-- SAFETY ENFORCEMENT & ROLLOUT TIMER:
-- The 7-day grace window begins at MIGRATION EXECUTION TIME (clock_timestamp()),
-- NOT from the product's historical created_at or published_at!
-- A dedicated timestamp column `grace_expires_at` is set explicitly to (clock_timestamp() + interval '7 days').
-- If batch re-verification does not run or fails, the listing automatically loses
-- public visibility after grace_expires_at, and can be demoted to draft via public.expire_stale_legacy_grace_listings().
update public.products
set verification_status = 'approved',
    verification_reason = 'Temporary rollout transition approval. Scheduled for authoritative AI verification.',
    verified_at = clock_timestamp(),
    verified_by_model = 'legacy_migration_grace',
    grace_expires_at = clock_timestamp() + interval '7 days'
where status = 'active' and (verification_status is null or verification_status = 'pending' or verified_by_model is null);

-- Exposed view for operators to monitor remaining grace listings and their expiry
create or replace view public.legacy_grace_pending_verification
with (security_invoker = true)
as
  select
    id,
    seller_id,
    title,
    category,
    status,
    verified_at,
    grace_expires_at as expires_at,
    (grace_expires_at is not null and clock_timestamp() > grace_expires_at) as is_expired
  from public.products
  where verified_by_model = 'legacy_migration_grace';

revoke all on public.legacy_grace_pending_verification from public, anon, authenticated;
grant select on public.legacy_grace_pending_verification to service_role;

-- Enforceable cleanup function that revokes grace on expired unverified listings
create or replace function public.expire_stale_legacy_grace_listings()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.products
  set verification_status = 'uncertain',
      status = 'draft',
      verification_reason = 'Temporary grace period expired (7 days from migration rollout) without AI re-verification. Re-verification required.',
      updated_at = clock_timestamp()
  where verified_by_model = 'legacy_migration_grace'
    and grace_expires_at is not null
    and clock_timestamp() > grace_expires_at
    and status = 'active';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_legacy_grace_listings() from public, anon, authenticated;
grant execute on function public.expire_stale_legacy_grace_listings() to service_role;

-- 3. Create product_verifications audit table
create table if not exists public.product_verifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('TECH_APPROVED', 'NON_TECH_REJECTED', 'UNCERTAIN')),
  confidence numeric(4,3) null check (confidence >= 0 and confidence <= 1),
  reason text not null,
  suggested_category text null,
  flagged_reasons jsonb not null default '[]'::jsonb,
  content_hash text not null,
  model_used text not null,
  raw_response jsonb null,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_product_verifications_product on public.product_verifications(product_id);
create index if not exists idx_product_verifications_seller on public.product_verifications(seller_id);
create index if not exists idx_product_verifications_decision on public.product_verifications(decision);
create index if not exists idx_product_verifications_created on public.product_verifications(created_at desc);

alter table public.product_verifications enable row level security;

-- Sellers can view verification history of their own products; admins can view all
drop policy if exists "Sellers and admins can view product verifications" on public.product_verifications;
create policy "Sellers and admins can view product verifications"
  on public.product_verifications
  for select
  using (
    seller_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Only backend / service role / authoritative RPC can insert/update/delete audit rows
revoke insert, update, delete on public.product_verifications from public, anon, authenticated;
grant select on public.product_verifications to authenticated;
grant all on public.product_verifications to service_role;

-- 4. Content Hash Helper Function
create or replace function public.calculate_product_content_hash(
  p_title text,
  p_category text,
  p_specs text,
  p_description text
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(
    btrim(coalesce(p_title, ''), E' \t\n\r\f\x0B') || '|' ||
    btrim(coalesce(p_category, ''), E' \t\n\r\f\x0B') || '|' ||
    btrim(coalesce(p_specs, ''), E' \t\n\r\f\x0B') || '|' ||
    btrim(coalesce(p_description, ''), E' \t\n\r\f\x0B'),
    'UTF8'
  )), 'hex');
$$;

-- 4b. Full verification hash (text + authoritative image paths).
-- Must stay byte-identical to computeProductVerificationHash() in lib/ai/content-hash.ts:
--   sha256( trim(title)|trim(category)|trim(specs)|trim(description) || '::images::' || sorted(paths).join(',') )
-- Image paths are ASCII (<seller uuid>/<product uuid>/<uuid>.<ext>), so COLLATE "C"
-- ordering matches JavaScript's default Array.prototype.sort().
create or replace function public.calculate_product_verification_hash(p_product_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(
    btrim(coalesce(p.title, ''), E' \t\n\r\f\x0B') || '|' ||
    btrim(coalesce(p.category, ''), E' \t\n\r\f\x0B') || '|' ||
    btrim(coalesce(p.specs, ''), E' \t\n\r\f\x0B') || '|' ||
    btrim(coalesce(p.description, ''), E' \t\n\r\f\x0B') ||
    '::images::' ||
    coalesce((
      select string_agg(pi.storage_path, ',' order by pi.storage_path collate "C")
      from public.product_images pi
      where pi.product_id = p.id
    ), ''),
    'UTF8'
  )), 'hex')
  from public.products p
  where p.id = p_product_id;
$$;

revoke all on function public.calculate_product_verification_hash(uuid) from public, anon, authenticated;
grant execute on function public.calculate_product_verification_hash(uuid) to service_role;

-- 5. Hardened Product Integrity Trigger
-- Protects against:
--  a) Sellers directly setting status='active' without AI verification approval
--  b) Sellers directly setting verification_status='approved' from client
--  c) Material changes (title, category, specs, description) on approved products:
--     automatically invalidates approval and demotes to draft + pending!
create or replace function public.enforce_product_verification_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_privileged boolean;
begin
  -- Check if caller is privileged:
  -- Privileged contexts:
  -- - Backend service role
  -- - Internal AI verification RPC (circuitcart.internal_ai_verified = 'true')
  -- - Marketplace platform admin
  -- - Direct database migrations/seeds/scripts (where role is 'none', not client 'authenticated'/'anon')
  v_is_privileged := (
    coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') or
    coalesce(auth.role(), '') = 'service_role' or
    coalesce(current_setting('circuitcart.internal_ai_verified', true), '') = 'true' or
    coalesce((select role from public.profiles where id = auth.uid()), '') = 'admin'
  );

  if TG_OP = 'INSERT' then
    -- Sellers cannot insert products directly as 'approved' or 'active' without verification.
    -- BACKWARD COMPATIBILITY FIX:
    -- If a legacy client inserts with status='active' (as the pre-AI seller form did),
    -- do NOT crash the seller's form with an unhandled exception!
    -- Instead, safely coerce status to 'draft' and verification_status to 'pending'.
    -- This keeps publishing 100% operational during the migration-to-app deployment window,
    -- while strictly preventing unverified listings from appearing in the public active catalog!
    if not v_is_privileged then
      if NEW.verification_status = 'approved' then
        raise exception 'Direct product approval is prohibited. AI verification is required.'
          using errcode = '42501';
      end if;
      if NEW.status = 'active' and NEW.verification_status <> 'approved' then
        NEW.status := 'draft';
        NEW.verification_status := 'pending';
        NEW.verification_reason := coalesce(NEW.verification_reason, 'Newly submitted listing awaiting AI verification.');
      end if;
    else
      -- If privileged caller inserts an active product without explicit verification status, mark approved
      if NEW.status = 'active' and NEW.verification_status = 'pending' then
        NEW.verification_status := 'approved';
        NEW.verified_at := coalesce(NEW.verified_at, now());
        NEW.verification_reason := coalesce(NEW.verification_reason, 'Initial administrative seed or privileged creation');
      end if;
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    -- If an unprivileged caller attempts to directly approve or activate an unapproved listing:
    if not v_is_privileged then
      if NEW.verification_status = 'approved' and OLD.verification_status is distinct from 'approved' then
        raise exception 'Direct product approval is prohibited. AI verification is required.'
          using errcode = '42501';
      end if;

      if NEW.status = 'active' and (NEW.verification_status is distinct from 'approved' or OLD.verification_status is distinct from 'approved') then
        raise exception 'Cannot activate an unverified product. AI verification approval is required.'
          using errcode = '42501';
      end if;

      -- If seller materially changes title, category, specs, or description on an approved listing:
      if OLD.verification_status = 'approved' and (
        NEW.title <> OLD.title or
        NEW.category <> OLD.category or
        NEW.specs is distinct from OLD.specs or
        NEW.description is distinct from OLD.description
      ) then
        -- Invalidate previous approval!
        NEW.verification_status := 'pending';
        NEW.status := 'draft';
        NEW.verification_reason := 'Listing details modified. Pending AI re-verification.';
        NEW.verified_at := null;
        NEW.verification_content_hash := null;
      end if;
    end if;

    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_product_verification_guard on public.products;
create trigger trg_product_verification_guard
  before insert or update on public.products
  for each row
  execute function public.enforce_product_verification_guard();

-- 6. Demote Product on Image Mutation
-- When product images are added, removed, or changed, invalidate previous approval
create or replace function public.handle_product_images_verification_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prod_id uuid;
  v_is_privileged boolean;
begin
  v_is_privileged := (
    coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') or
    coalesce(auth.role(), '') = 'service_role' or
    coalesce(current_setting('circuitcart.internal_ai_verified', true), '') = 'true' or
    coalesce((select role from public.profiles where id = auth.uid()), '') = 'admin'
  );

  if v_is_privileged then
    return coalesce(NEW, OLD);
  end if;

  v_prod_id := case when TG_OP = 'DELETE' then OLD.product_id else NEW.product_id end;

  if v_prod_id is not null then
    update public.products
    set verification_status = 'pending',
        status = 'draft',
        verification_reason = 'Product photos modified. Pending AI re-verification.',
        verified_at = null,
        verification_content_hash = null,
        updated_at = clock_timestamp()
    where id = v_prod_id and verification_status = 'approved';
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_product_images_verification_invalidation on public.product_images;
create trigger trg_product_images_verification_invalidation
  after insert or update or delete on public.product_images
  for each row
  execute function public.handle_product_images_verification_invalidation();

-- 7. Authoritative Backend AI Decision RPC
create or replace function public.apply_product_ai_decision(
  p_product_id uuid,
  p_decision text,
  p_confidence numeric default 1.0,
  p_reason text default 'AI verified technology product',
  p_suggested_category text default null,
  p_flagged_reasons jsonb default '[]'::jsonb,
  p_content_hash text default null,
  p_model_used text default 'gemini-multimodal',
  p_raw_response jsonb default null,
  p_expected_hash text default null
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products;
  v_current_hash text;
begin
  if p_decision not in ('TECH_APPROVED', 'NON_TECH_REJECTED', 'UNCERTAIN') then
    raise exception 'Invalid verification decision: %', p_decision;
  end if;

  -- Authoritative access check: only service_role, platform admin, or internal superuser/migration
  if not (
    coalesce(auth.role(), '') = 'service_role' or
    coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') or
    coalesce((select role from public.profiles where id = auth.uid()), '') = 'admin'
  ) then
    raise exception 'Unauthorized: Only service role or platform administrators can apply verification decisions.'
      using errcode = '42501';
  end if;

  -- Lock row FOR UPDATE to prevent concurrency race conditions
  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found: %', p_product_id;
  end if;

  -- Compute current content hash (text + authoritative image paths), identical to the API hash
  v_current_hash := public.calculate_product_verification_hash(v_product.id);

  -- If an expected content hash was specified, ensure listing was not modified concurrently
  if p_expected_hash is not null and p_expected_hash <> v_current_hash then
    raise exception 'Listing content was modified while verification was in progress. Hash mismatch.';
  end if;

  -- Record audit log entry
  insert into public.product_verifications (
    product_id,
    seller_id,
    decision,
    confidence,
    reason,
    suggested_category,
    flagged_reasons,
    content_hash,
    model_used,
    raw_response,
    created_at
  )
  values (
    v_product.id,
    v_product.seller_id,
    p_decision,
    p_confidence,
    p_reason,
    p_suggested_category,
    coalesce(p_flagged_reasons, '[]'::jsonb),
    coalesce(p_content_hash, v_current_hash),
    p_model_used,
    p_raw_response,
    clock_timestamp()
  );

  -- Temporarily set context setting so the guard trigger allows privileged status update
  perform set_config('circuitcart.internal_ai_verified', 'true', true);

  if p_decision = 'TECH_APPROVED' then
    update public.products
    set verification_status = 'approved',
        verification_reason = p_reason,
        verification_content_hash = coalesce(p_content_hash, v_current_hash),
        verified_at = clock_timestamp(),
        verified_by_model = p_model_used,
        grace_expires_at = null,
        status = 'active',
        published_at = coalesce(published_at, clock_timestamp()),
        updated_at = clock_timestamp()
    where id = v_product.id
    returning * into v_product;
  elsif p_decision = 'NON_TECH_REJECTED' then
    update public.products
    set verification_status = 'rejected',
        verification_reason = p_reason,
        verification_content_hash = coalesce(p_content_hash, v_current_hash),
        verified_at = clock_timestamp(),
        verified_by_model = p_model_used,
        grace_expires_at = null,
        status = 'draft',
        updated_at = clock_timestamp()
    where id = v_product.id
    returning * into v_product;
  else -- UNCERTAIN
    update public.products
    set verification_status = 'uncertain',
        verification_reason = p_reason,
        verification_content_hash = coalesce(p_content_hash, v_current_hash),
        verified_at = clock_timestamp(),
        verified_by_model = p_model_used,
        grace_expires_at = null,
        status = 'draft',
        updated_at = clock_timestamp()
    where id = v_product.id
    returning * into v_product;
  end if;

  return v_product;
end;
$$;

revoke all on function public.apply_product_ai_decision(uuid, text, numeric, text, text, jsonb, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_product_ai_decision(uuid, text, numeric, text, text, jsonb, text, text, jsonb, text) to service_role;

-- 8. Storage Object Hardening: Prevent post-verification image replacement
-- Three ways a seller could swap the bytes behind an approved image path:
--   a) UPDATE / upsert the object in place          -> seller UPDATE policy dropped
--   b) DELETE the object, then INSERT new bytes at   -> DELETE allowed only for objects
--      the same path (product_images row unchanged)    no longer referenced by any
--                                                      product_images row; INSERT refused
--                                                      for any path still referenced
--   c) Delete the product_images row first           -> row deletion fires
--                                                      trg_product_images_verification_invalidation,
--                                                      demoting the listing to draft + pending
-- The helper is SECURITY DEFINER so the check sees every product_images row
-- (including clones made by duplicateProduct) regardless of the caller's RLS view.
create or replace function public.is_product_image_path_referenced(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.product_images pi where pi.storage_path = p_path
  );
$$;

revoke all on function public.is_product_image_path_referenced(text) from public, anon;
grant execute on function public.is_product_image_path_referenced(text) to authenticated, service_role;

create index if not exists idx_product_images_storage_path
  on public.product_images (storage_path);

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    grant select, insert, update, delete on storage.objects to authenticated, service_role;

    -- (a) No in-place overwrite by sellers
    drop policy if exists "Sellers can update own product images" on storage.objects;
    drop policy if exists "Admins only can update product images in storage" on storage.objects;
    create policy "Admins only can update product images in storage"
      on storage.objects
      for update
      using (
        bucket_id = 'product-images'
        and (select role from public.profiles where id = auth.uid()) = 'admin'
      );

    -- (b) INSERT: same ownership rules as 20260906000001, plus the path must not be
    --     referenced by an existing product_images row (blocks re-upload after delete).
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
        and not public.is_product_image_path_referenced(name)
      );

    -- (b) DELETE: only the uploader's own folder, and only orphaned objects. Sellers must
    --     remove the product_images row first (which invalidates verification).
    --     The parent product is not required to exist, so cleanup after deleteProduct()
    --     (which cascades product_images) still succeeds. Paths still referenced by a
    --     duplicated listing stay protected.
    drop policy if exists "Sellers can delete own product images" on storage.objects;
    create policy "Sellers can delete own product images"
      on storage.objects
      for delete
      using (
        bucket_id = 'product-images'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
        and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
        and not public.is_product_image_path_referenced(name)
      );
  end if;
end $$;

-- 8b. product_images rows written by sellers must reference the seller's own
-- Supabase Storage folder. Blocks external URLs (https://...), whose content the
-- seller could change after approval without touching the database.
-- (duplicateProduct() reuses the seller's own paths, which still satisfy this.)
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
    and split_part(product_images.storage_path, '/', 1) = auth.uid()::text
  );

-- storage_path is immutable for sellers. Reordering (sort_order) stays allowed by the
-- existing UPDATE policy; replacing an image means delete row + insert new row, which
-- fires trg_product_images_verification_invalidation.
create or replace function public.prevent_product_image_path_rewrite()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.storage_path is distinct from OLD.storage_path
     and coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Product image paths are immutable. Remove the image and upload a new one.'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_product_image_path_rewrite on public.product_images;
create trigger trg_prevent_product_image_path_rewrite
  before update on public.product_images
  for each row
  execute function public.prevent_product_image_path_rewrite();

-- 9. Atomic Distributed Rate Limiting (Pre-check Reservation)
-- Ensures concurrent burst requests across multiple server instances cannot bypass the limit
-- before AI verification audit records are written.
create table if not exists public.verification_rate_limits (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_verification_rate_limits_seller
  on public.verification_rate_limits (seller_id, created_at desc);

alter table public.verification_rate_limits enable row level security;
revoke all on public.verification_rate_limits from public, anon, authenticated;
grant select, insert, delete on public.verification_rate_limits to service_role;

create or replace function public.check_and_record_verification_rate_limit(
  p_seller_id uuid,
  p_max_requests int default 15,
  p_window_seconds int default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count int;
  v_oldest timestamptz;
  v_retry_after int;
begin
  v_window_start := clock_timestamp() - (p_window_seconds || ' seconds')::interval;

  -- Periodically purge stale entries older than 5 minutes to keep table compact
  delete from public.verification_rate_limits
  where created_at < clock_timestamp() - interval '5 minutes';

  -- Count recent requests for this seller within the sliding window
  select count(*), min(created_at)
  into v_count, v_oldest
  from public.verification_rate_limits
  where seller_id = p_seller_id
    and created_at >= v_window_start;

  if v_count >= p_max_requests then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_oldest + (p_window_seconds || ' seconds')::interval - clock_timestamp()))));
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  end if;

  -- Atomically reserve this request slot before AI processing begins
  insert into public.verification_rate_limits (seller_id, created_at)
  values (p_seller_id, clock_timestamp());

  return jsonb_build_object(
    'allowed', true,
    'remaining', p_max_requests - v_count - 1,
    'retry_after_seconds', 0
  );
end;
$$;

revoke all on function public.check_and_record_verification_rate_limit(uuid, int, int) from public, anon, authenticated;
grant execute on function public.check_and_record_verification_rate_limit(uuid, int, int) to service_role;

-- 10. Hardened RLS Policy: Public cannot view unapproved products under any circumstances
-- In addition, listings in legacy_migration_grace expire once grace_expires_at elapses.
alter table public.products enable row level security;
alter table public.products force row level security;
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products
  for select
  using (
    (
      status = 'active'
      and verification_status = 'approved'
      and stock > 0
      and (
        verified_by_model is distinct from 'legacy_migration_grace'
        or grace_expires_at is null
        or clock_timestamp() <= grace_expires_at
      )
    )
    or seller_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
