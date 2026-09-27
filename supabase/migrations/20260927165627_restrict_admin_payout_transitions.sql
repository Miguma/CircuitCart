-- ============================================================================
-- CIRCUITCART MIGRATION: RESTRICT ADMIN PAYOUT TRANSITIONS (SELLER-LED FLOW)
-- Date: 2026-09-28
--
-- Desired workflow:
--   Buyer payment → payout pending/on hold → buyer confirms receipt →
--   finance_record_order trigger sets eligible automatically → seller clicks
--   Request payout via seller_request_payout() → processing → admin
--   releases / fails / holds.
--
-- The admin must NOT bypass the seller request flow, so this migration
-- narrows admin_update_payout_status:
--   REMOVED: pending → eligible (eligibility is automatic via trigger)
--   REMOVED: eligible → processing (only seller_request_payout() performs it)
--   ADDED:   processing → held (admin may pull a processing payout back)
-- Everything else (pending → held, eligible → held, held → eligible,
-- processing → released/failed, paid/completed guards, payout-account
-- requirement, grants) is unchanged. Existing finance records are untouched.
-- seller_request_payout() is NOT modified.
-- ============================================================================

begin;

create or replace function public.admin_update_payout_status(p_payout_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_p public.seller_payouts; v_o public.orders; v_tx public.payment_transactions; v_a public.seller_payout_accounts;
begin
  if auth.uid() is null or (select role from public.profiles where id=auth.uid()) is distinct from 'admin' then
    raise exception 'Administrator required.' using errcode='42501'; end if;
  select * into v_p from public.seller_payouts where id=p_payout_id;
  if not found then raise exception 'Payout not found.'; end if;
  -- Match checkout lock order: transaction -> order -> payout.
  select * into v_tx from public.payment_transactions where id=v_p.payment_transaction_id for update;
  select * into v_o from public.orders where id=v_p.order_id for update;
  select * into v_p from public.seller_payouts where id=p_payout_id for update;
  if p_status is null then raise exception 'Invalid transition.'; end if;
  if v_p.status=p_status then return true; end if;
  -- Seller-led flow: eligibility is automatic (finance_record_order) and only
  -- seller_request_payout() moves eligible → processing.
  if not ((v_p.status='pending' and p_status='held')
       or (v_p.status='eligible' and p_status='held')
       or (v_p.status='held' and p_status='eligible')
       or (v_p.status='processing' and p_status in ('released','failed','held'))) then raise exception 'Invalid payout transition.'; end if;
  if v_tx.status is distinct from 'paid' or v_o.payment_status is distinct from 'paid' or v_o.status='cancelled' then
    raise exception 'Payout requires a paid, non-cancelled order.'; end if;
  if p_status in ('eligible','processing','released') and v_o.status<>'completed' then raise exception 'Complete the order first.'; end if;
  if p_status='processing' then
    select * into v_a from public.seller_payout_accounts where seller_id=v_p.seller_id and shop_id=v_o.shop_id and is_active and is_default for share;
    if not found then raise exception 'Seller must save an active payout account first.'; end if;
  end if;
  update public.seller_payouts set status=p_status,
    eligible_at=case when p_status='eligible' then coalesce(eligible_at,clock_timestamp()) else eligible_at end,
    released_at=case when p_status='released' then clock_timestamp() else released_at end,
    destination_bank=case when p_status='processing' then v_a.bank_name else destination_bank end,
    destination_name=case when p_status='processing' then v_a.account_name else destination_name end,
    destination_last4=case when p_status='processing' then v_a.account_last4 else destination_last4 end
  where id=p_payout_id;
  return true;
end $$;
revoke all on function public.admin_update_payout_status(uuid,text) from public,anon;
grant execute on function public.admin_update_payout_status(uuid,text) to authenticated;

commit;
