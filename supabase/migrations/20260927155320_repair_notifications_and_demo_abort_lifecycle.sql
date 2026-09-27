-- ============================================================================
-- CIRCUITCART REPAIR MIGRATION: NOTIFICATIONS BACKFILL + DEMO ABORT FIX
-- Date: 2026-09-27
--
-- Context (from live Supabase logs — NO re-runs of historical migrations):
-- 1. confirm_online_payment fails with SQLSTATE 42P01 because
--    public.notifications does not exist in the live database, even though
--    20260906000012_phase8_persistent_notifications.sql exists in the repo.
--    Re-running phase8 is forbidden: it would CREATE OR REPLACE
--    review_seller_verification, handle_message_inserted,
--    mark_conversation_messages_read and install the order-notification
--    trigger, overwriting newer behavior.
-- 2. abort_failed_online_checkout (from phase12) violates constraint 23514
--    (online_inventory_release_terminal): after finish_unpaid_online_checkout
--    releases inventory (status 'cancelled' + inventory_released_at set), it
--    updates the transaction to 'failed', which that constraint forbids.
--
-- This repair migration ONLY:
-- 1. Creates public.notifications IF MISSING (phase8 definition, verbatim).
-- 2. Creates its indexes IF MISSING.
-- 3. Applies RLS + privilege lockdown (select-only for own rows).
-- 4. (Re)creates the two standalone read-mutation RPCs mark_notification_read
--    and mark_all_notifications_read (verbatim from phase8 — these are NOT in
--    the do-not-touch list).
-- 5. Replaces abort_failed_online_checkout with a constraint-compatible
--    version that leaves the released transaction terminal 'cancelled'.
--
-- Explicitly NOT touched: review_seller_verification,
-- handle_message_inserted, mark_conversation_messages_read,
-- handle_order_notification / trigger_order_notification (never installed
-- here), confirm_online_payment, fail_online_payment, finance triggers,
-- or any integrity CHECK constraint.
-- ============================================================================

begin;

-- ============================================================================
-- 1. NOTIFICATIONS TABLE (created only when missing)
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  entity_id uuid,
  read_at timestamptz default null,
  created_at timestamptz not null default now(),
  check (length(trim(title)) > 0 and length(title) <= 200),
  check (length(trim(message)) > 0 and length(message) <= 1000)
);

-- ============================================================================
-- 2. NOTIFICATION INDEXES (created only when missing)
-- ============================================================================

create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_dedup
  on public.notifications(user_id, type, entity_id, created_at desc)
  where read_at is null;

-- ============================================================================
-- 3. ROW LEVEL SECURITY + PRIVILEGE LOCKDOWN
-- Direct client INSERT/UPDATE/DELETE stay denied: no mutation policies exist.
-- Trusted writes happen via SECURITY DEFINER RPCs and triggers only.
-- ============================================================================

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

revoke all privileges on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;

-- ============================================================================
-- 4. READ-MUTATION RPCs (standalone; safe to (re)create)
-- ============================================================================

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = v_user_id;

  return true;
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = v_user_id
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============================================================================
-- 5. ABORT_FAILED_ONLINE_CHECKOUT: CONSTRAINT-COMPATIBLE TERMINAL STATE
-- ============================================================================
-- finish_unpaid_online_checkout(v_tx.id, 'cancelled') sets status='cancelled'
-- AND inventory_released_at. The online_inventory_release_terminal check
-- requires a released transaction to stay in ('expired','cancelled'), so the
-- old follow-up update to 'failed' raised 23514. A failed pre-provider
-- checkout now remains terminal 'cancelled': stock restored, cart restored,
-- child orders cancelled, API layers report the failure to the buyer.
-- Ownership, provider-evidence, and idempotency guards are unchanged.
-- ============================================================================

create or replace function public.abort_failed_online_checkout(
  p_attempt_id uuid default null,
  p_payment_transaction_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tx public.payment_transactions;
  v_item record;
  v_buyer uuid := auth.uid();
begin
  if v_buyer is null then
    return false;
  end if;

  if p_payment_transaction_id is not null then
    select * into v_tx from public.payment_transactions
    where id = p_payment_transaction_id and buyer_id = v_buyer
    for update;
  elsif p_attempt_id is not null then
    select * into v_tx from public.payment_transactions
    where checkout_attempt_id = p_attempt_id and buyer_id = v_buyer
    for update;
  else
    return false;
  end if;

  if not found then
    return false;
  end if;

  -- Only abort if created and no provider checkout session was established
  if v_tx.status = 'created' and v_tx.provider_checkout_id is null and v_tx.inventory_released_at is null then
    -- 1. Restore cart items for buyer
    for v_item in
      select i.product_id, i.quantity
      from public.order_items i
      join public.orders o on o.id = i.order_id
      where o.payment_transaction_id = v_tx.id and o.status = 'pending' and i.product_id is not null
    loop
      insert into public.cart_items (user_id, product_id, quantity)
      values (v_tx.buyer_id, v_item.product_id, v_item.quantity)
      on conflict (user_id, product_id) do update
      set quantity = public.cart_items.quantity + excluded.quantity;
    end loop;

    -- 2. Release product stock & cancel child orders. The transaction remains
    --    terminal 'cancelled' afterwards (see header comment).
    if not public.finish_unpaid_online_checkout(v_tx.id, 'cancelled') then
      return false;
    end if;

    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.abort_failed_online_checkout(uuid, uuid) from public, anon;
grant execute on function public.abort_failed_online_checkout(uuid, uuid) to authenticated, service_role;

commit;
