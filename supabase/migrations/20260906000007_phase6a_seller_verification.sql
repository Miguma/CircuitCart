-- =======================================================
-- CIRCUITCART MIGRATION: PHASE 6A REAL SELLER VERIFICATION
-- =======================================================

-- 1. Create seller_verification_requests table
create table if not exists public.seller_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  seller_type text not null check (seller_type in ('individual', 'business')),
  full_name text not null,
  date_of_birth date not null,
  city_address text not null,
  business_name text null,
  id_type text not null,
  id_front_path text not null,
  id_back_path text null,
  selfie_path text not null,
  contact_email text not null,
  contact_phone text not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles(id) on delete set null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Indexes for efficient lookup
create index if not exists idx_seller_verification_user_id on public.seller_verification_requests (user_id);
create index if not exists idx_seller_verification_status on public.seller_verification_requests (status);
create index if not exists idx_seller_verification_submitted_at on public.seller_verification_requests (submitted_at desc);
create unique index if not exists unique_pending_seller_verification on public.seller_verification_requests (user_id) where status = 'pending';

-- Trigger for updated_at
drop trigger if exists set_seller_verification_updated_at on public.seller_verification_requests;
create trigger set_seller_verification_updated_at
  before update on public.seller_verification_requests
  for each row
  execute function public.handle_updated_at();

-- 3. Enable RLS on seller_verification_requests
alter table public.seller_verification_requests enable row level security;

-- SELECT Policy: Users can view their own requests, Admins can view all requests
drop policy if exists "Users can view own verification requests" on public.seller_verification_requests;
create policy "Users can view own verification requests"
  on public.seller_verification_requests
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- INSERT Policy: Buyers can submit verification requests only for themselves
drop policy if exists "Buyers can submit verification request for themselves" on public.seller_verification_requests;
create policy "Buyers can submit verification request for themselves"
  on public.seller_verification_requests
  for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and rejection_reason is null
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'buyer'
    )
  );

-- 4. Private Storage Bucket for Seller Verification Documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-verification',
  'seller-verification',
  false,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS on objects
drop policy if exists "Users can upload own verification documents" on storage.objects;
create policy "Users can upload own verification documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users and admins can view verification documents" on storage.objects;
create policy "Users and admins can view verification documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'seller-verification'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

drop policy if exists "Users can delete own pending verification documents" on storage.objects;
create policy "Users can delete own pending verification documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Secure RPC: submit_seller_verification
create or replace function public.submit_seller_verification(
  p_seller_type text,
  p_full_name text,
  p_date_of_birth date,
  p_city_address text,
  p_business_name text,
  p_id_type text,
  p_id_front_path text,
  p_id_back_path text,
  p_selfie_path text,
  p_contact_email text,
  p_contact_phone text
)
returns public.seller_verification_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_new_req public.seller_verification_requests;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Check current role is buyer
  select role into v_user_role from public.profiles where id = v_user_id;
  if v_user_role is null then
    raise exception 'User profile not found';
  end if;

  if v_user_role != 'buyer' then
    raise exception 'Only buyers can submit seller verification. Current role is %', v_user_role;
  end if;

  -- Check for existing pending request
  if exists (
    select 1 from public.seller_verification_requests
    where user_id = v_user_id and status = 'pending'
  ) then
    raise exception 'You already have a pending verification request under review';
  end if;

  -- Validate seller type
  if p_seller_type not in ('individual', 'business') then
    raise exception 'Invalid seller type. Must be individual or business';
  end if;

  if p_seller_type = 'business' and (p_business_name is null or length(trim(p_business_name)) = 0) then
    raise exception 'Business name is required for business seller verification';
  end if;

  -- Validate required fields
  if length(trim(p_full_name)) < 2 then
    raise exception 'Full legal name must be at least 2 characters';
  end if;

  if p_date_of_birth is null or p_date_of_birth > (current_date - interval '18 years') then
    raise exception 'You must be at least 18 years old to register as a seller';
  end if;

  if length(trim(p_city_address)) < 5 then
    raise exception 'Please provide a valid permanent/residential address';
  end if;

  if length(trim(p_id_type)) = 0 then
    raise exception 'ID type is required';
  end if;

  if length(trim(p_contact_email)) = 0 or length(trim(p_contact_phone)) = 0 then
    raise exception 'Contact email and phone number are required';
  end if;

  -- Validate document ownership paths
  if not (p_id_front_path like v_user_id::text || '/%') then
    raise exception 'Invalid front ID document path';
  end if;

  if p_id_back_path is not null and length(trim(p_id_back_path)) > 0 and not (p_id_back_path like v_user_id::text || '/%') then
    raise exception 'Invalid back ID document path';
  end if;

  if not (p_selfie_path like v_user_id::text || '/%') then
    raise exception 'Invalid selfie document path';
  end if;

  -- Insert pending verification request
  insert into public.seller_verification_requests (
    user_id,
    status,
    seller_type,
    full_name,
    date_of_birth,
    city_address,
    business_name,
    id_type,
    id_front_path,
    id_back_path,
    selfie_path,
    contact_email,
    contact_phone,
    submitted_at,
    reviewed_at,
    reviewed_by,
    rejection_reason
  ) values (
    v_user_id,
    'pending',
    p_seller_type,
    trim(p_full_name),
    p_date_of_birth,
    trim(p_city_address),
    nullif(trim(p_business_name), ''),
    trim(p_id_type),
    trim(p_id_front_path),
    nullif(trim(p_id_back_path), ''),
    trim(p_selfie_path),
    trim(p_contact_email),
    trim(p_contact_phone),
    now(),
    null,
    null,
    null
  )
  returning * into v_new_req;

  return v_new_req;
end;
$$;

revoke execute on function public.submit_seller_verification from public, anon;
grant execute on function public.submit_seller_verification to authenticated;

-- 6. Secure Admin RPC: review_seller_verification
create or replace function public.review_seller_verification(
  p_request_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.seller_verification_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_admin_role text;
  v_req public.seller_verification_requests;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null then
    raise exception 'Authentication required';
  end if;

  -- Verify admin role
  select role into v_admin_role from public.profiles where id = v_admin_id;
  if v_admin_role != 'admin' then
    raise exception 'Unauthorized: Only administrators can review seller verifications';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision. Must be approved or rejected';
  end if;

  if p_decision = 'rejected' and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'Rejection reason is required when rejecting a verification request';
  end if;

  -- Lock row FOR UPDATE
  select * into v_req
  from public.seller_verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Verification request not found';
  end if;

  if v_req.status != 'pending' then
    raise exception 'Verification request has already been reviewed (status: %)', v_req.status;
  end if;

  if p_decision = 'rejected' then
    update public.seller_verification_requests
    set
      status = 'rejected',
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      rejection_reason = trim(p_reason),
      updated_at = now()
    where id = p_request_id
    returning * into v_req;

  elsif p_decision = 'approved' then
    update public.seller_verification_requests
    set
      status = 'approved',
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      rejection_reason = null,
      updated_at = now()
    where id = p_request_id
    returning * into v_req;

    -- Update applicant profile role to 'seller'
    update public.profiles
    set
      role = 'seller',
      updated_at = now()
    where id = v_req.user_id;

    -- If shop exists for user, mark is_verified = true
    update public.shops
    set
      is_verified = true,
      updated_at = now()
    where owner_id = v_req.user_id;

  end if;

  return v_req;
end;
$$;

revoke execute on function public.review_seller_verification from public, anon;
grant execute on function public.review_seller_verification to authenticated;

-- 7. Automatic Shop Verification on Shop Insert
create or replace function public.handle_new_shop_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Derive is_verified strictly from approved database verification
  if exists (
    select 1 from public.seller_verification_requests
    where user_id = new.owner_id
      and status = 'approved'
  ) then
    new.is_verified := true;
  else
    new.is_verified := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_set_shop_verification on public.shops;
create trigger trigger_set_shop_verification
  before insert on public.shops
  for each row
  execute function public.handle_new_shop_verification();
