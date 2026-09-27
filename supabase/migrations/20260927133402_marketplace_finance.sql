-- Prepared only. Apply after 000017; never re-run historical migrations.
begin;

create table public.platform_settings (
  id boolean primary key default true check (id),
  commission_rate_bps integer not null default 500 check (commission_rate_bps between 0 and 3000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.platform_settings(id) values (true);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public, anon, authenticated;
grant select (id, commission_rate_bps) on public.platform_settings to authenticated;
create policy settings_read on public.platform_settings for select to authenticated using (true);

create table public.seller_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  shop_id uuid not null unique references public.shops(id),
  method text not null default 'bank' check (method = 'bank'),
  bank_name text not null check (length(trim(bank_name)) between 2 and 100),
  account_name text not null check (length(trim(account_name)) between 2 and 150),
  account_number text not null check (account_number ~ '^[0-9]{6,34}$'),
  account_last4 text generated always as (right(account_number, 4)) stored,
  is_default boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seller_payout_accounts_seller_idx on public.seller_payout_accounts(seller_id);
alter table public.seller_payout_accounts enable row level security;
revoke all on public.seller_payout_accounts from public, anon, authenticated;
grant select, insert, update on public.seller_payout_accounts to authenticated;
-- Admin access is masked, through finance_payout_history, never a public account API.
create policy account_owner_read on public.seller_payout_accounts for select to authenticated
using (seller_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'seller'));
create policy account_owner_insert on public.seller_payout_accounts for insert to authenticated
with check (seller_id = (select auth.uid()) and exists (
  select 1 from public.shops s join public.profiles p on p.id = s.owner_id
  where s.id = shop_id and s.owner_id = auth.uid() and p.role = 'seller'));
create policy account_owner_update on public.seller_payout_accounts for update to authenticated
using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()) and exists (
  select 1 from public.shops s join public.profiles p on p.id = s.owner_id
  where s.id = shop_id and s.owner_id = auth.uid() and p.role = 'seller'));
create trigger payout_account_updated before update on public.seller_payout_accounts
for each row execute function public.handle_updated_at();

alter table public.seller_payouts
  add column commission_base numeric(12,2),
  add column commission_rate_bps integer,
  add column destination_bank text,
  add column destination_name text,
  add column destination_last4 text,
  add constraint payout_commission_snapshot check (
    (commission_base is null and commission_rate_bps is null) or
    (commission_base is not null and commission_base >= 0 and commission_rate_bps is not null
     and commission_rate_bps between 0 and 3000
     and platform_fee = round(commission_base * commission_rate_bps / 10000, 2))
  );

create table public.platform_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  seller_id uuid not null references public.profiles(id),
  shop_id uuid not null references public.shops(id),
  payment_transaction_id uuid references public.payment_transactions(id),
  payment_method text not null,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_base numeric(12,2) not null check (commission_base >= 0),
  -- NULL is deliberately reserved for historical amounts whose rate is unknown.
  commission_rate_bps integer check (commission_rate_bps between 0 and 3000),
  commission_amount numeric(12,2) not null check (commission_amount between 0 and gross_amount),
  settlement_mode text not null check (settlement_mode in ('platform_collected','seller_direct')),
  collection_status text not null check (collection_status in ('collected','receivable','waived','refunded')),
  is_sandbox boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (commission_rate_bps is null or commission_amount = round(commission_base * commission_rate_bps / 10000,2)),
  check ((settlement_mode = 'platform_collected' and payment_transaction_id is not null)
      or (settlement_mode = 'seller_direct' and payment_transaction_id is null))
);
create index platform_commissions_seller_date_idx on public.platform_commissions(seller_id,created_at desc);
create index platform_commissions_shop_idx on public.platform_commissions(shop_id);
create index platform_commissions_tx_idx on public.platform_commissions(payment_transaction_id);
alter table public.platform_commissions enable row level security;
revoke all on public.platform_commissions from public, anon, authenticated;
grant select on public.platform_commissions to authenticated;
create policy commission_read on public.platform_commissions for select to authenticated using (
  seller_id = (select auth.uid()) or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Preserve previously recorded fees/net exactly; never charge historical sales today's rate.
insert into public.platform_commissions(order_id,seller_id,shop_id,payment_transaction_id,payment_method,
  gross_amount,commission_base,commission_rate_bps,commission_amount,settlement_mode,collection_status,is_sandbox,created_at)
select o.id,o.seller_id,o.shop_id,p.payment_transaction_id,o.payment_method,p.gross_amount,o.subtotal,
  null,p.platform_fee,'platform_collected',
  case when t.status = 'refunded' or p.status = 'refunded' then 'refunded'
       when o.status = 'cancelled' or t.status <> 'paid' or p.status = 'cancelled' then 'waived' else 'collected' end,
  t.sandbox or t.provider in ('circuitcart_sandbox','maya'),p.created_at
from public.seller_payouts p join public.orders o on o.id=p.order_id
join public.payment_transactions t on t.id=p.payment_transaction_id;

create function public.admin_set_commission_rate(p_rate_bps integer)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or (select role from public.profiles where id=auth.uid()) is distinct from 'admin' then
    raise exception 'Administrator required.' using errcode='42501';
  end if;
  if p_rate_bps is null or p_rate_bps not between 0 and 3000 then raise exception 'Rate must be between 0 and 3000 basis points.'; end if;
  update public.platform_settings set commission_rate_bps=p_rate_bps, updated_at=clock_timestamp(),updated_by=auth.uid() where id;
  return p_rate_bps;
end $$;
revoke all on function public.admin_set_commission_rate(integer) from public,anon;
grant execute on function public.admin_set_commission_rate(integer) to authenticated;

-- Trigger runs inside the same transaction as payment confirmation / fulfillment.
create function public.finance_record_order() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_rate integer; v_fee numeric(12,2); v_tx public.payment_transactions;
begin
  if new.status = 'cancelled' or new.payment_status in ('failed','refunded') then
    update public.seller_payouts set status=case when new.payment_status='refunded' then 'refunded' else 'cancelled' end
      where order_id=new.id and status not in ('released','refunded','cancelled');
    update public.platform_commissions set collection_status=case when collection_status='collected' then 'refunded' else 'waived' end,
      updated_at=clock_timestamp() where order_id=new.id and collection_status in ('collected','receivable');
    return new;
  end if;
  if new.payment_method in ('demo_card','maya_online') and new.payment_status='paid' then
    select * into v_tx from public.payment_transactions where id=new.payment_transaction_id;
    if v_tx.status is distinct from 'paid' or v_tx.buyer_id is distinct from new.buyer_id then
      raise exception 'Verified parent payment required.';
    end if;
    if not exists(select 1 from public.seller_payouts where order_id=new.id) then
      select commission_rate_bps into strict v_rate from public.platform_settings where id;
      v_fee := round(new.subtotal*v_rate/10000,2);
      insert into public.platform_commissions(order_id,seller_id,shop_id,payment_transaction_id,payment_method,
        gross_amount,commission_base,commission_rate_bps,commission_amount,settlement_mode,collection_status,is_sandbox)
      values(new.id,new.seller_id,new.shop_id,new.payment_transaction_id,new.payment_method,new.total,new.subtotal,
        v_rate,v_fee,'platform_collected','collected',v_tx.sandbox or v_tx.provider in ('circuitcart_sandbox','maya'));
      insert into public.seller_payouts(order_id,seller_id,payment_transaction_id,gross_amount,commission_base,
        commission_rate_bps,platform_fee,net_amount,status)
      values(new.id,new.seller_id,new.payment_transaction_id,new.total,new.subtotal,v_rate,v_fee,new.total-v_fee,'pending');
    end if;
    if new.status='completed' then
      update public.seller_payouts set status='eligible',eligible_at=coalesce(eligible_at,clock_timestamp())
      where order_id=new.id and status='pending';
    end if;
  elsif new.payment_method in ('cash_on_delivery','cash_on_meetup','manual_gcash','manual_maya')
      and new.status='completed' then
    -- Completion of seller-direct cash fulfillment is the authoritative collection event.
    select commission_rate_bps into strict v_rate from public.platform_settings where id;
    insert into public.platform_commissions(order_id,seller_id,shop_id,payment_method,gross_amount,
      commission_base,commission_rate_bps,commission_amount,settlement_mode,collection_status,is_sandbox)
    values(new.id,new.seller_id,new.shop_id,new.payment_method,new.total,new.subtotal,v_rate,
      round(new.subtotal*v_rate/10000,2),'seller_direct','receivable',false)
    on conflict(order_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.finance_record_order() from public,anon,authenticated;
create trigger finance_record_order after insert or update of status,payment_status on public.orders
for each row execute function public.finance_record_order();

create function public.finance_guard_snapshot() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_table_name='orders' then
    if exists(select 1 from public.platform_commissions where order_id=old.id) and
      row(new.buyer_id,new.seller_id,new.shop_id,new.payment_method,new.payment_transaction_id,new.subtotal,new.shipping_fee,new.total)
      is distinct from row(old.buyer_id,old.seller_id,old.shop_id,old.payment_method,old.payment_transaction_id,old.subtotal,old.shipping_fee,old.total) then
      raise exception 'Recorded financial fields are immutable.';
    end if;
  elsif tg_table_name='seller_payouts' then
    if row(new.order_id,new.seller_id,new.payment_transaction_id,new.gross_amount,new.platform_fee,new.net_amount,new.commission_base,new.commission_rate_bps)
      is distinct from row(old.order_id,old.seller_id,old.payment_transaction_id,old.gross_amount,old.platform_fee,old.net_amount,old.commission_base,old.commission_rate_bps) then
      raise exception 'Payout amounts are immutable.';
    end if;
    if old.status='released' and new is distinct from old then raise exception 'Released payout history is immutable.'; end if;
  end if;
  return new;
end $$;
revoke all on function public.finance_guard_snapshot() from public,anon,authenticated;
create trigger finance_guard_snapshot before update on public.orders for each row execute function public.finance_guard_snapshot();
create trigger finance_guard_snapshot before update on public.seller_payouts for each row execute function public.finance_guard_snapshot();

create function public.finance_stop_unpayable() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status in ('failed','cancelled','expired','refunded') then
    update public.seller_payouts set status=case when new.status='refunded' then 'refunded' else 'cancelled' end
    where payment_transaction_id=new.id and status not in ('released','refunded','cancelled');
    update public.platform_commissions set collection_status=case when collection_status='collected' then 'refunded' else 'waived' end,
      updated_at=clock_timestamp() where payment_transaction_id=new.id and collection_status in ('collected','receivable');
  end if;
  return new;
end $$;
revoke all on function public.finance_stop_unpayable() from public,anon,authenticated;
create trigger finance_stop_unpayable after update of status on public.payment_transactions for each row execute function public.finance_stop_unpayable();

-- Buyer-specific reconciliation result; never grants buyers access to seller bank data.
create function public.get_payment_financial_receipt(p_payment_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tx public.payment_transactions; v_ok boolean; v_ids uuid[];
begin
  select * into v_tx from public.payment_transactions where id=p_payment_transaction_id;
  if not found or (coalesce(auth.jwt()->>'role','') <> 'service_role' and
      (auth.uid() is null or v_tx.buyer_id is distinct from auth.uid())) then
    raise exception 'Payment not accessible.' using errcode='42501';
  end if;
  select array_agg(o.id order by o.id),
    count(*)>0 and sum(o.total)=v_tx.amount and bool_and(
      o.buyer_id=v_tx.buyer_id and o.payment_status='paid' and o.status in ('confirmed','preparing','ready','shipped','completed')
      and p.id is not null and c.id is not null and p.status not in ('cancelled','refunded')
      and p.payment_transaction_id=v_tx.id and p.seller_id=o.seller_id
      and p.gross_amount=o.total and p.net_amount=p.gross_amount-p.platform_fee
      and c.payment_transaction_id=v_tx.id and c.seller_id=o.seller_id and c.shop_id=o.shop_id
      and c.gross_amount=p.gross_amount and c.commission_amount=p.platform_fee and c.collection_status='collected'
    ) into v_ids,v_ok
    from public.orders o left join public.seller_payouts p on p.order_id=o.id
    left join public.platform_commissions c on c.order_id=o.id where o.payment_transaction_id=v_tx.id;
  return jsonb_build_object('success',v_tx.status='paid' and coalesce(v_ok,false), 'status',v_tx.status,
    'paymentTransactionId',v_tx.id,'orderIds',coalesce(to_jsonb(v_ids),'[]'::jsonb));
end $$;
revoke all on function public.get_payment_financial_receipt(uuid) from public,anon;
grant execute on function public.get_payment_financial_receipt(uuid) to authenticated,service_role;

-- Preserve notifications/legacy gateway behavior, but close its unguarded RPC entry point.
alter function public.confirm_online_payment(uuid,text,text,text) rename to finance_confirm_online_payment_legacy;
revoke all on function public.finance_confirm_online_payment_legacy(uuid,text,text,text) from public,anon,authenticated,service_role;
create function public.confirm_online_payment(p_payment_transaction_id uuid,p_provider_payment_id text default null,
  p_provider_checkout_id text default null,p_receipt_number text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tx public.payment_transactions; v_result jsonb; v_already boolean;
begin
  select * into v_tx from public.payment_transactions where id=p_payment_transaction_id for update;
  if not found then raise exception 'Payment not accessible.'; end if;
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and (
    auth.uid() is null or v_tx.buyer_id is distinct from auth.uid()
    or v_tx.provider is distinct from 'circuitcart_sandbox' or v_tx.sandbox is distinct from true
    or v_tx.payment_method is distinct from 'demo_card') then
    raise exception 'Trusted payment confirmation required.' using errcode='42501';
  end if;
  v_already := v_tx.status='paid';
  perform id from public.orders where payment_transaction_id=v_tx.id order by id for update;
  if v_tx.inventory_released_at is not null or v_tx.status not in ('created','pending','authorized','paid')
     or (not v_already and v_tx.expires_at <= clock_timestamp()) then raise exception 'Payment requires reconciliation.'; end if;
  if not exists(select 1 from public.orders where payment_transaction_id=v_tx.id)
    or (select sum(total) from public.orders where payment_transaction_id=v_tx.id) is distinct from v_tx.amount
    or exists(select 1 from public.orders where payment_transaction_id=v_tx.id and
      (buyer_id<>v_tx.buyer_id or status='cancelled' or (not v_already and (status<>'pending' or payment_status<>'pending')))) then
    raise exception 'Checkout integrity check failed.';
  end if;
  -- Do not accept caller-supplied provider evidence for a sandbox payment.
  if v_tx.provider='circuitcart_sandbox' then
    p_provider_payment_id:=v_tx.transaction_reference;
    p_provider_checkout_id:=v_tx.checkout_attempt_id::text;
    p_receipt_number:=v_tx.transaction_reference;
  end if;
  perform public.finance_confirm_online_payment_legacy(v_tx.id,p_provider_payment_id,p_provider_checkout_id,p_receipt_number);
  v_result:=public.get_payment_financial_receipt(v_tx.id);
  if (v_result->>'success')::boolean is distinct from true then raise exception 'Payment requires reconciliation.'; end if;
  return v_result || jsonb_build_object('alreadyPaid',v_already);
end $$;
revoke all on function public.confirm_online_payment(uuid,text,text,text) from public,anon;
grant execute on function public.confirm_online_payment(uuid,text,text,text) to authenticated,service_role;
-- Unverified callers must not invalidate another buyer's paid financial state.
revoke all on function public.fail_online_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.fail_online_payment(uuid,text) to service_role;

create function public.admin_update_payout_status(p_payout_id uuid,p_status text)
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
  if not ((v_p.status='pending' and p_status in ('eligible','held'))
       or (v_p.status='eligible' and p_status in ('processing','held'))
       or (v_p.status='held' and p_status='eligible')
       or (v_p.status='processing' and p_status in ('released','failed'))) then raise exception 'Invalid payout transition.'; end if;
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

-- All-period totals computed in SQL, not from a truncated browser result set.
create function public.finance_summary() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text; v_result jsonb;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if auth.uid() is null or v_role is null or v_role not in ('seller','admin') then raise exception 'Finance access denied.' using errcode='42501'; end if;
  with valid as (
    select c.* from public.platform_commissions c join public.orders o on o.id=c.order_id
    left join public.payment_transactions t on t.id=c.payment_transaction_id
    where (v_role='admin' or c.seller_id=auth.uid()) and c.collection_status in ('collected','receivable')
      and o.status<>'cancelled' and o.payment_status not in ('failed','refunded')
      and ((c.settlement_mode='platform_collected' and t.status='paid' and o.payment_status='paid')
        or (c.settlement_mode='seller_direct' and o.status='completed'))
  ), totals as (
    select coalesce(sum(gross_amount),0) gross,coalesce(sum(commission_amount),0) fees,
      coalesce(sum(gross_amount-commission_amount),0) net,
      coalesce(sum(commission_amount) filter(where collection_status='collected'),0) collected,
      coalesce(sum(commission_amount) filter(where collection_status='receivable'),0) receivable,
      coalesce(sum(gross_amount) filter(where is_sandbox),0) sandbox_gross,
      coalesce(sum(commission_amount) filter(where is_sandbox),0) sandbox_fees,
      count(*) sales,count(distinct payment_transaction_id) transactions from valid
  ), payouts as (
    select coalesce(sum(p.net_amount) filter(where p.status='pending'),0) pending,
      coalesce(sum(p.net_amount) filter(where p.status='eligible'),0) eligible,
      coalesce(sum(p.net_amount) filter(where p.status='processing'),0) processing,
      coalesce(sum(p.net_amount) filter(where p.status='held'),0) held,
      coalesce(sum(p.net_amount) filter(where p.status='released'),0) released
    from public.seller_payouts p join valid v on v.order_id=p.order_id
  ), months as (
    select to_char(created_at at time zone 'Asia/Manila','YYYY-MM') month,
      sum(gross_amount-commission_amount) net,count(*) sales from valid group by 1 order by 1 desc limit 12
  ) select jsonb_build_object('totals',to_jsonb(t),'payouts',to_jsonb(p),
    'months',coalesce((select jsonb_agg(to_jsonb(m) order by month) from months m),'[]'::jsonb),
    'commissionRateBps',(select commission_rate_bps from public.platform_settings where id)) into v_result from totals t cross join payouts p;
  return v_result;
end $$;
revoke all on function public.finance_summary() from public,anon;
grant execute on function public.finance_summary() to authenticated;

create function public.finance_payout_history(p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text; v_result jsonb;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if auth.uid() is null or v_role is null or v_role not in ('seller','admin') then raise exception 'Finance access denied.' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 then raise exception 'Invalid offset.'; end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_result from (
    select p.id,p.order_id,p.gross_amount,p.platform_fee,p.net_amount,p.status,p.commission_rate_bps,
      p.created_at,p.eligible_at,p.released_at,o.status order_status,o.payment_method,
      pr.full_name seller_name,s.name shop_name,
      coalesce(p.destination_bank,a.bank_name) bank_name,coalesce(p.destination_name,a.account_name) account_name,
      coalesce(p.destination_last4,a.account_last4) account_last4
    from public.seller_payouts p join public.orders o on o.id=p.order_id
    join public.profiles pr on pr.id=p.seller_id join public.shops s on s.id=o.shop_id
    left join public.seller_payout_accounts a on a.shop_id=o.shop_id and a.seller_id=p.seller_id and a.is_active and a.is_default
    where v_role='admin' or p.seller_id=auth.uid() order by p.created_at desc,p.id limit 50 offset p_offset
  ) r;
  return v_result;
end $$;
revoke all on function public.finance_payout_history(integer) from public,anon;
grant execute on function public.finance_payout_history(integer) to authenticated;

commit;
