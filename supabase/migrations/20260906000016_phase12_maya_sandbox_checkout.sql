-- ============================================================================
-- CIRCUITCART MIGRATION: PHASE 12 MAYA CHECKOUT SANDBOX INTEGRATION
-- Date: 2026-09-27
-- Description:
-- 1. Authoritative confirm_online_payment RPC:
--    - Atomically updates payment_transactions (status = 'paid', paid_at = now())
--    - Atomically updates all child orders (payment_status = 'paid', status = 'confirmed')
--    - Initializes seller_payouts records for verified seller fulfillment
--    - Generates buyer & seller persistent notifications
-- 2. Authoritative record_online_checkout_id RPC:
--    - Records Maya Sandbox checkoutId on parent transaction & child orders
-- 3. Authoritative fail_online_payment RPC:
--    - Updates transaction status to failed/cancelled/expired
-- 4. Secure privileges: revokes public/anon execute, grants to authenticated and service_role
-- ============================================================================

begin;

-- ============================================================================
-- 1. RECORD MAYA CHECKOUT ID ON PAYMENT TRANSACTION
-- ============================================================================

create or replace function public.record_online_checkout_id(
  p_payment_transaction_id uuid,
  p_checkout_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_payment_transaction_id is null or p_checkout_id is null or trim(p_checkout_id) = '' then
    return false;
  end if;

  update public.payment_transactions
  set provider_checkout_id = trim(p_checkout_id),
      updated_at = clock_timestamp()
  where id = p_payment_transaction_id
    and (provider_checkout_id is null or provider_checkout_id = trim(p_checkout_id));

  update public.orders
  set payment_reference = trim(p_checkout_id),
      updated_at = clock_timestamp()
  where payment_transaction_id = p_payment_transaction_id
    and (payment_reference is null or payment_reference = trim(p_checkout_id));

  return true;
end;
$$;

revoke all on function public.record_online_checkout_id(uuid, text) from public, anon;
grant execute on function public.record_online_checkout_id(uuid, text) to authenticated, service_role;

-- ============================================================================
-- 2. CONFIRM ONLINE PAYMENT (MAYA WEBHOOK & VERIFICATION)
-- ============================================================================

create or replace function public.confirm_online_payment(
  p_payment_transaction_id uuid,
  p_provider_payment_id text default null,
  p_provider_checkout_id text default null,
  p_receipt_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tx public.payment_transactions;
  v_order record;
  v_confirmed_orders uuid[] := array[]::uuid[];
  v_clean_ref text;
  v_buyer_order_ref text;
begin
  if p_payment_transaction_id is null then
    raise exception 'Payment transaction ID is required.';
  end if;

  -- 1. Acquire transaction lock
  select * into v_tx
  from public.payment_transactions
  where id = p_payment_transaction_id
  for update;

  if not found then
    raise exception 'Payment transaction % not found.', p_payment_transaction_id;
  end if;

  -- Idempotency check: if already paid, return existing success state
  if v_tx.status = 'paid' then
    select array_agg(id) into v_confirmed_orders
    from public.orders
    where payment_transaction_id = v_tx.id;

    return jsonb_build_object(
      'success', true,
      'alreadyPaid', true,
      'paymentTransactionId', v_tx.id,
      'status', 'paid',
      'orderIds', coalesce(to_jsonb(v_confirmed_orders), '[]'::jsonb)
    );
  end if;

  -- Ensure transaction is not in a terminal non-payable state
  if v_tx.status in ('failed', 'cancelled', 'expired', 'refunded') then
    raise exception 'Payment transaction % is in terminal state % and cannot be confirmed.', v_tx.id, v_tx.status;
  end if;

  -- 2. Update parent payment transaction
  v_clean_ref := coalesce(nullif(trim(p_receipt_number), ''), nullif(trim(p_provider_payment_id), ''), nullif(trim(p_provider_checkout_id), ''));

  update public.payment_transactions
  set status = 'paid',
      paid_at = coalesce(paid_at, clock_timestamp()),
      provider_payment_id = coalesce(nullif(trim(p_provider_payment_id), ''), provider_payment_id),
      provider_checkout_id = coalesce(nullif(trim(p_provider_checkout_id), ''), provider_checkout_id),
      updated_at = clock_timestamp()
  where id = v_tx.id;

  -- 3. Update all child orders to paid & confirmed
  for v_order in
    select id, buyer_id, seller_id, total, status, payment_status, payment_reference
    from public.orders
    where payment_transaction_id = v_tx.id
    for update
  loop
    update public.orders
    set payment_status = 'paid',
        status = case when status = 'pending' then 'confirmed' else status end,
        payment_reference = coalesce(v_clean_ref, payment_reference),
        updated_at = clock_timestamp()
    where id = v_order.id;

    v_confirmed_orders := array_append(v_confirmed_orders, v_order.id);
    v_buyer_order_ref := 'CC-' || upper(replace(v_order.id::text, '-', ''));
    v_buyer_order_ref := substring(v_buyer_order_ref from 1 for 11);

    -- 4. Initialize seller payout entry if missing
    insert into public.seller_payouts (
      order_id,
      seller_id,
      payment_transaction_id,
      gross_amount,
      platform_fee,
      net_amount,
      status,
      created_at,
      updated_at
    )
    values (
      v_order.id,
      v_order.seller_id,
      v_tx.id,
      v_order.total,
      0.00,
      v_order.total,
      'pending',
      clock_timestamp(),
      clock_timestamp()
    )
    on conflict (order_id) do update
    set payment_transaction_id = coalesce(seller_payouts.payment_transaction_id, v_tx.id),
        updated_at = clock_timestamp();

    -- 5. Create notification for seller
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      entity_id
    )
    values (
      v_order.seller_id,
      'order_new',
      'New Paid Order Received',
      'You received a paid Maya Sandbox order (' || v_buyer_order_ref || '). Total: ₱' || to_char(v_order.total, 'FM999,999,990.00') || '. You may now start fulfillment.',
      '/seller/orders',
      v_order.id
    );
  end loop;

  -- 6. Create notification for buyer
  if v_tx.buyer_id is not null then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      entity_id
    )
    values (
      v_tx.buyer_id,
      'order_status',
      'Maya Payment Confirmed',
      'Your payment of ₱' || to_char(v_tx.amount, 'FM999,999,990.00') || ' via Maya Sandbox has been confirmed. Your order is now being processed.',
      '/marketplace/orders',
      p_payment_transaction_id
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'alreadyPaid', false,
    'paymentTransactionId', v_tx.id,
    'status', 'paid',
    'amount', v_tx.amount,
    'orderIds', to_jsonb(v_confirmed_orders)
  );
end;
$$;

revoke all on function public.confirm_online_payment(uuid, text, text, text) from public, anon;
grant execute on function public.confirm_online_payment(uuid, text, text, text) to authenticated, service_role;

-- ============================================================================
-- 3. FAIL / CANCEL ONLINE PAYMENT
-- ============================================================================

create or replace function public.fail_online_payment(
  p_payment_transaction_id uuid,
  p_status text default 'failed'
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := coalesce(trim(p_status), 'failed');
begin
  if p_payment_transaction_id is null then
    return false;
  end if;

  if v_status not in ('failed', 'cancelled', 'expired') then
    v_status := 'failed';
  end if;

  update public.payment_transactions
  set status = v_status,
      updated_at = clock_timestamp()
  where id = p_payment_transaction_id
    and status not in ('paid', 'refunded');

  update public.orders
  set payment_status = v_status,
      updated_at = clock_timestamp()
  where payment_transaction_id = p_payment_transaction_id
    and payment_status <> 'paid';

  return true;
end;
$$;

revoke all on function public.fail_online_payment(uuid, text) from public, anon;
grant execute on function public.fail_online_payment(uuid, text) to authenticated, service_role;

-- ============================================================================
-- 4. ABORT FAILED ONLINE CHECKOUT (MAYA CREATION FAILURE ROLLBACK)
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

    -- 2. Release product stock & cancel child orders
    perform public.finish_unpaid_online_checkout(v_tx.id, 'cancelled');

    -- 3. Mark transaction as failed
    update public.payment_transactions
    set status = 'failed',
        updated_at = clock_timestamp()
    where id = v_tx.id;

    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.abort_failed_online_checkout(uuid, uuid) from public, anon;
grant execute on function public.abort_failed_online_checkout(uuid, uuid) to authenticated, service_role;

commit;
