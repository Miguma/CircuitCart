-- =======================================================
-- CIRCUITCART MIGRATION: PHASE 6A.1 AUTOMATED VERIFICATION REVIEW
-- =======================================================

-- 1. Extend seller_verification_requests with automated review fields
alter table public.seller_verification_requests
  add column if not exists automated_review_status text null default 'queued'
    check (automated_review_status in ('queued', 'processing', 'passed', 'manual_review', 'failed')),
  add column if not exists automated_score integer null
    check (automated_score >= 0 and automated_score <= 100),
  add column if not exists automated_flags jsonb not null default '[]'::jsonb,
  add column if not exists extracted_full_name text null,
  add column if not exists extracted_date_of_birth date null,
  add column if not exists extracted_id_type text null,
  add column if not exists automated_review_summary text null,
  add column if not exists automated_reviewed_at timestamptz null;

-- Index for automated review querying
create index if not exists idx_seller_verification_auto_status
  on public.seller_verification_requests (automated_review_status);

-- 2. Secure Backend-Only RPC: auto_approve_seller_verification
-- Must NEVER be callable by browser/public/anon/authenticated. Service role only.
create or replace function public.auto_approve_seller_verification(
  p_request_id uuid
)
returns public.seller_verification_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.seller_verification_requests;
begin
  -- Lock row FOR UPDATE
  select * into v_req
  from public.seller_verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Verification request not found';
  end if;

  if v_req.status != 'pending' then
    raise exception 'Verification request is not pending (current status: %)', v_req.status;
  end if;

  if v_req.automated_review_status != 'passed' then
    raise exception 'Automated review status is not passed (status: %)', v_req.automated_review_status;
  end if;

  if v_req.automated_score is null or v_req.automated_score < 90 then
    raise exception 'Automated score (%) does not meet auto-approval threshold (90)', coalesce(v_req.automated_score::text, 'null');
  end if;

  -- Verify no critical mismatch flags are present
  if exists (
    select 1
    from jsonb_array_elements_text(v_req.automated_flags) as flag
    where flag in (
      'NAME_MISMATCH',
      'DOB_MISMATCH',
      'UNREADABLE_DOCUMENT',
      'ID_TYPE_MISMATCH',
      'OCR_FAILED',
      'UNDERAGE_APPLICANT'
    )
  ) then
    raise exception 'Automated review flags contain critical mismatch flags';
  end if;

  -- Execute approval
  update public.seller_verification_requests
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = null, -- automated approval
    rejection_reason = null,
    updated_at = now()
  where id = p_request_id
  returning * into v_req;

  -- Promote user profile role to 'seller'
  update public.profiles
  set
    role = 'seller',
    updated_at = now()
  where id = v_req.user_id;

  -- Mark existing shop as verified if already created
  update public.shops
  set
    is_verified = true,
    updated_at = now()
  where owner_id = v_req.user_id;

  return v_req;
end;
$$;

-- STRICT ACCESS CONTROL: Revoke from all client roles
revoke execute on function public.auto_approve_seller_verification(uuid) from public, anon, authenticated;
grant execute on function public.auto_approve_seller_verification(uuid) to service_role;

-- 3. Secure Backend-Only RPC: record_automated_verification_result
create or replace function public.record_automated_verification_result(
  p_request_id uuid,
  p_status text,
  p_score integer,
  p_flags jsonb,
  p_extracted_name text default null,
  p_extracted_dob date default null,
  p_extracted_id_type text default null,
  p_summary text default null
)
returns public.seller_verification_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.seller_verification_requests;
begin
  if p_status not in ('queued', 'processing', 'passed', 'manual_review', 'failed') then
    raise exception 'Invalid automated review status: %', p_status;
  end if;

  update public.seller_verification_requests
  set
    automated_review_status = p_status,
    automated_score = p_score,
    automated_flags = coalesce(p_flags, '[]'::jsonb),
    extracted_full_name = p_extracted_name,
    extracted_date_of_birth = p_extracted_dob,
    extracted_id_type = p_extracted_id_type,
    automated_review_summary = p_summary,
    automated_reviewed_at = now(),
    updated_at = now()
  where id = p_request_id
  returning * into v_req;

  if not found then
    raise exception 'Verification request not found';
  end if;

  return v_req;
end;
$$;

revoke execute on function public.record_automated_verification_result from public, anon, authenticated;
grant execute on function public.record_automated_verification_result to service_role;
