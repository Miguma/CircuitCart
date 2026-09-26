-- ============================================================================
-- CIRCUITCART MIGRATION: PHASE 10 ONLINE PAYMENT TRANSACTIONS & SELLER PAYOUTS
-- Date: 2026-09-26
-- Phase: Step 5D.2 Financial Security & Integrity Hardening
-- 
-- Summary:
-- 1. Create public.payment_transactions table (parent transaction entity for online checkouts)
-- 2. Add provider identifier uniqueness constraints & indexes
-- 3. Link public.orders to public.payment_transactions via nullable payment_transaction_id FK
-- 4. Create public.seller_payouts table with financial check constraints (delayed payout state)
-- 5. Establish RLS policies for payment_transactions and seller_payouts (strict zero-client mutations)
-- 6. Enforce cross-table buyer & seller financial integrity triggers
-- ============================================================================

-- ============================================================================
-- 1. CREATE public.payment_transactions
-- ============================================================================

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (provider in ('maya')),
  currency text not null default 'PHP' check (currency = 'PHP'),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'created' check (
    status in (
      'created',
      'pending',
      'authorized',
      'paid',
      'failed',
      'cancelled',
      'expired',
      'refunded'
    )
  ),
  provider_checkout_id text null,
  provider_payment_id text null,
  authorized_at timestamptz null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_authorized_timestamp_check check (
    status <> 'authorized' or authorized_at is not null
  ),
  constraint payment_transactions_paid_timestamp_check check (
    status not in ('paid', 'refunded') or paid_at is not null
  ),
  constraint payment_transactions_timestamp_order_check check (
    authorized_at is null or paid_at is null or authorized_at <= paid_at
  )
);

-- Trigger for payment_transactions updated_at
drop trigger if exists set_payment_transactions_updated_at on public.payment_transactions;
create trigger set_payment_transactions_updated_at
  before update on public.payment_transactions
  for each row
  execute function public.handle_updated_at();

-- Provider identifier uniqueness indexes (composite provider + id, partial where not null)
create unique index if not exists idx_payment_transactions_provider_checkout
  on public.payment_transactions (provider, provider_checkout_id)
  where provider_checkout_id is not null;

create unique index if not exists idx_payment_transactions_provider_payment
  on public.payment_transactions (provider, provider_payment_id)
  where provider_payment_id is not null;

-- General query indexes
create index if not exists idx_payment_transactions_buyer_id
  on public.payment_transactions (buyer_id);

create index if not exists idx_payment_transactions_status
  on public.payment_transactions (status);

create index if not exists idx_payment_transactions_created_at
  on public.payment_transactions (created_at desc);

-- Step 5E must derive amount from authoritative order/cart totals, create the
-- transaction, attach exactly the intended orders, and verify that the sum of
-- those order totals equals payment_transactions.amount. Browser-provided
-- amounts must never be accepted. The final cross-row sum check is deferred
-- because a row trigger here would reject a legitimate multi-order checkout
-- while its child order links are still being created.

-- ============================================================================
-- 2. LINK public.orders TO PARENT TRANSACTION
-- ============================================================================

alter table public.orders
  add column if not exists payment_transaction_id uuid;

alter table public.orders
  drop constraint if exists orders_payment_transaction_id_fkey;

alter table public.orders
  add constraint orders_payment_transaction_id_fkey
  foreign key (payment_transaction_id)
  references public.payment_transactions(id)
  on delete restrict;

create index if not exists idx_orders_payment_transaction_id
  on public.orders (payment_transaction_id)
  where payment_transaction_id is not null;

-- Authoritative integrity check: Order buyer_id must match parent payment_transaction buyer_id
create or replace function public.validate_order_payment_transaction()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tx_buyer_id uuid;
  v_old_tx_status text;
begin
  -- Once provider evidence reaches an authorized, paid, or refunded state,
  -- the order cannot be detached from or moved to another transaction.
  if tg_op = 'UPDATE'
     and old.payment_transaction_id is not null
     and new.payment_transaction_id is distinct from old.payment_transaction_id then
    select status into v_old_tx_status
    from public.payment_transactions
    where id = old.payment_transaction_id;

    if v_old_tx_status in ('authorized', 'paid', 'refunded') then
      raise exception 'Order payment transaction cannot change after authorization or payment.';
    end if;
  end if;

  if new.payment_transaction_id is not null then
    select buyer_id into v_tx_buyer_id
    from public.payment_transactions
    where id = new.payment_transaction_id;

    if v_tx_buyer_id is null then
      raise exception 'Referenced payment transaction % does not exist.', new.payment_transaction_id;
    end if;

    if v_tx_buyer_id <> new.buyer_id then
      raise exception 'Order buyer_id % does not match payment transaction buyer_id %.', new.buyer_id, v_tx_buyer_id;
    end if;
  end if;

  -- Preserve payout ownership, transaction linkage, and gross amount if a
  -- payout record already exists for this order.
  if tg_op = 'UPDATE' and exists (
    select 1
    from public.seller_payouts sp
    where sp.order_id = new.id
      and (
        sp.seller_id is distinct from new.seller_id
        or (
          sp.payment_transaction_id is not null
          and sp.payment_transaction_id is distinct from new.payment_transaction_id
        )
        or sp.gross_amount is distinct from new.total
      )
  ) then
    raise exception 'Order financial fields cannot diverge from its seller payout.';
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_validate_order_payment_transaction on public.orders;
create trigger trigger_validate_order_payment_transaction
  before insert or update of payment_transaction_id, buyer_id, seller_id, total on public.orders
  for each row
  execute function public.validate_order_payment_transaction();

-- Protect linked orders if trusted backend code later updates a transaction.
create or replace function public.validate_payment_transaction_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.orders o
    where o.payment_transaction_id = old.id
  ) then
    if new.buyer_id is distinct from old.buyer_id then
      raise exception 'Payment transaction buyer cannot change after orders are attached.';
    end if;

    if new.amount is distinct from old.amount then
      raise exception 'Payment transaction amount cannot change after orders are attached.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_validate_payment_transaction_update on public.payment_transactions;
create trigger trigger_validate_payment_transaction_update
  before update of buyer_id, amount on public.payment_transactions
  for each row
  execute function public.validate_payment_transaction_update();

-- ============================================================================
-- 3. CREATE public.seller_payouts
-- ============================================================================

create table if not exists public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  payment_transaction_id uuid null references public.payment_transactions(id) on delete restrict,
  gross_amount numeric(12, 2) not null,
  platform_fee numeric(12, 2) not null default 0.00,
  net_amount numeric(12, 2) not null,
  status text not null default 'pending' check (
    status in (
      'pending',
      'eligible',
      'processing',
      'released',
      'held',
      'failed',
      'cancelled',
      'refunded'
    )
  ),
  eligible_at timestamptz null,
  released_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_payouts_financials_check check (
    gross_amount >= 0 and
    platform_fee >= 0 and
    net_amount >= 0 and
    platform_fee <= gross_amount and
    net_amount = (gross_amount - platform_fee)
  ),
  constraint seller_payouts_eligible_timestamp_check check (
    status not in ('eligible', 'processing', 'released') or eligible_at is not null
  ),
  constraint seller_payouts_released_timestamp_check check (
    status <> 'released' or released_at is not null
  ),
  constraint seller_payouts_timestamp_order_check check (
    eligible_at is null or released_at is null or eligible_at <= released_at
  )
);

-- Trigger for seller_payouts updated_at
drop trigger if exists set_seller_payouts_updated_at on public.seller_payouts;
create trigger set_seller_payouts_updated_at
  before update on public.seller_payouts
  for each row
  execute function public.handle_updated_at();

-- Seller payouts indexes
create index if not exists idx_seller_payouts_seller_id
  on public.seller_payouts (seller_id);

create index if not exists idx_seller_payouts_status
  on public.seller_payouts (status);

create index if not exists idx_seller_payouts_payment_transaction_id
  on public.seller_payouts (payment_transaction_id)
  where payment_transaction_id is not null;

create index if not exists idx_seller_payouts_created_at
  on public.seller_payouts (created_at desc);

-- Authoritative integrity check: Payout seller_id and payment_transaction_id must match the order
create or replace function public.validate_seller_payout_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order record;
begin
  select seller_id, payment_transaction_id, total into v_order
  from public.orders
  where id = new.order_id;

  if not found then
    raise exception 'Referenced order % does not exist.', new.order_id;
  end if;

  if v_order.seller_id <> new.seller_id then
    raise exception 'Payout seller_id % does not match order seller_id %.', new.seller_id, v_order.seller_id;
  end if;

  if new.payment_transaction_id is not null
     and new.payment_transaction_id is distinct from v_order.payment_transaction_id then
    raise exception 'Payout payment_transaction_id does not match order payment_transaction_id.';
  end if;

  if new.gross_amount is distinct from v_order.total then
    raise exception 'Payout gross_amount % does not match authoritative order total %.', new.gross_amount, v_order.total;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_validate_seller_payout_integrity on public.seller_payouts;
create trigger trigger_validate_seller_payout_integrity
  before insert or update of order_id, seller_id, payment_transaction_id, gross_amount on public.seller_payouts
  for each row
  execute function public.validate_seller_payout_integrity();

-- Trigger helpers are not client-callable. Revoking EXECUTE does not prevent
-- PostgreSQL from invoking them through their registered triggers.
revoke execute on function public.validate_order_payment_transaction() from public, anon, authenticated;
revoke execute on function public.validate_payment_transaction_update() from public, anon, authenticated;
revoke execute on function public.validate_seller_payout_integrity() from public, anon, authenticated;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- 4.1 payment_transactions RLS
alter table public.payment_transactions enable row level security;

-- Authenticated buyer may read ONLY their own payment transactions
drop policy if exists "Buyers can view their own payment transactions" on public.payment_transactions;
create policy "Buyers can view their own payment transactions"
  on public.payment_transactions
  for select
  to authenticated
  using (auth.uid() = buyer_id);

-- Admins can view all payment transactions
drop policy if exists "Admins can view all payment transactions" on public.payment_transactions;
create policy "Admins can view all payment transactions"
  on public.payment_transactions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Explicit table privileges reinforce the absence of mutation policies.
revoke all privileges on table public.payment_transactions from public, anon, authenticated;
grant select on table public.payment_transactions to authenticated;

-- 4.2 seller_payouts RLS
alter table public.seller_payouts enable row level security;

-- Authenticated seller may read ONLY their own payouts
drop policy if exists "Sellers can view their own payouts" on public.seller_payouts;
create policy "Sellers can view their own payouts"
  on public.seller_payouts
  for select
  to authenticated
  using (auth.uid() = seller_id);

-- Admins can view all seller payouts
drop policy if exists "Admins can view all seller payouts" on public.seller_payouts;
create policy "Admins can view all seller payouts"
  on public.seller_payouts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Explicit table privileges reinforce the absence of mutation policies.
revoke all privileges on table public.seller_payouts from public, anon, authenticated;
grant select on table public.seller_payouts to authenticated;
