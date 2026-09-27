-- CircuitCart — seller-initiated sandbox payout requests
-- Adds a seller-owned transition from eligible -> processing.
-- Actual bank transfer is intentionally NOT performed in the academic sandbox.

begin;

create or replace function public.seller_request_payout(p_payout_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.seller_payouts;
  v_order public.orders;
  v_tx public.payment_transactions;
  v_account public.seller_payout_accounts;
begin
  if auth.uid() is null
     or (select role from public.profiles where id = auth.uid()) is distinct from 'seller' then
    raise exception 'Seller access required.' using errcode = '42501';
  end if;

  select * into v_payout
  from public.seller_payouts
  where id = p_payout_id
    and seller_id = auth.uid();

  if not found then
    raise exception 'Payout not found.' using errcode = '42501';
  end if;

  -- Keep lock order aligned with checkout/admin finance paths.
  select * into v_tx
  from public.payment_transactions
  where id = v_payout.payment_transaction_id
  for update;

  select * into v_order
  from public.orders
  where id = v_payout.order_id
  for update;

  select * into v_payout
  from public.seller_payouts
  where id = p_payout_id
  for update;

  if v_payout.seller_id is distinct from auth.uid() then
    raise exception 'Payout not accessible.' using errcode = '42501';
  end if;

  -- Safe retry after a successful request.
  if v_payout.status = 'processing' then
    return true;
  end if;

  if v_payout.status is distinct from 'eligible' then
    raise exception 'Only eligible payouts can be requested.';
  end if;

  if v_order.status is distinct from 'completed'
     or v_order.payment_status is distinct from 'paid'
     or v_tx.status is distinct from 'paid' then
    raise exception 'Payout requires a completed, paid order.';
  end if;

  select * into v_account
  from public.seller_payout_accounts
  where seller_id = auth.uid()
    and shop_id = v_order.shop_id
    and is_active
    and is_default
  for share;

  if not found then
    raise exception 'Save an active payout account before requesting payout.';
  end if;

  update public.seller_payouts
  set status = 'processing',
      destination_bank = v_account.bank_name,
      destination_name = v_account.account_name,
      destination_last4 = v_account.account_last4
  where id = p_payout_id;

  return true;
end;
$$;

revoke all on function public.seller_request_payout(uuid) from public, anon;
grant execute on function public.seller_request_payout(uuid) to authenticated;

comment on function public.seller_request_payout(uuid) is
  'Seller requests release of an eligible marketplace payout. Sandbox bookkeeping only; no real bank transfer occurs.';

commit;
