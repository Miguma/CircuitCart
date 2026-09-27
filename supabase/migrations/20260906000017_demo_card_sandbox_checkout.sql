-- ============================================================================
-- CIRCUITCART MIGRATION: DEMO CARD SANDBOX CHECKOUT (ACADEMIC DEFENSE)
-- Date: 2026-09-27
--
-- A fake, offline card payment method for demonstration only. No real money
-- is ever charged and no external gateway is contacted. All writes reuse the
-- existing online-checkout architecture (reservation lifecycle, integrity
-- triggers, payouts, notifications) with provider = 'circuitcart_sandbox'
-- and orders.payment_method = 'demo_card'.
--
-- 1. Allow 'circuitcart_sandbox' provider + add sandbox metadata columns
--    (sandbox flag, card_last4, transaction_reference). Full PAN/CVV are
--    NEVER stored anywhere.
-- 2. Allow 'demo_card' order payment method + require parent transaction.
-- 3. Extend online-order integrity guards (fulfillment gating, whole-
--    checkout cancellation) to demo_card.
-- 4. Add create_demo_checkout RPC: server-authoritative cart/stock/order
--    reservation mirroring create_online_checkout.
-- 5. Branch confirm_online_payment notifications so demo receipts never
--    claim to be Maya payments (Maya text unchanged).
-- ============================================================================

begin;

-- ============================================================================
-- 1. PAYMENT_TRANSACTIONS: PROVIDER ALLOWLIST + SANDBOX METADATA
-- ============================================================================

alter table public.payment_transactions
  drop constraint if exists payment_transactions_provider_check;

alter table public.payment_transactions
  add constraint payment_transactions_provider_allowlist
  check (provider in ('maya', 'circuitcart_sandbox'));

alter table public.payment_transactions
  add column if not exists sandbox boolean not null default false;

alter table public.payment_transactions
  add column if not exists payment_method text null
  constraint payment_transactions_demo_method_check
  check (payment_method is null or payment_method = 'demo_card');

alter table public.payment_transactions
  add column if not exists card_last4 text null
  constraint payment_transactions_card_last4_check
  check (card_last4 is null or card_last4 ~ '^[0-9]{4}$');

alter table public.payment_transactions
  add column if not exists transaction_reference text null;

create unique index if not exists idx_payment_transactions_demo_reference
  on public.payment_transactions (transaction_reference)
  where transaction_reference is not null;

-- ============================================================================
-- 2. ORDERS: ALLOW demo_card + REQUIRE PARENT TRANSACTION
-- ============================================================================

alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (
  payment_method in ('cash_on_delivery', 'cash_on_meetup', 'manual_gcash', 'manual_maya', 'maya_online', 'demo_card')
);

alter table public.orders drop constraint if exists orders_online_transaction_required;
alter table public.orders add constraint orders_online_transaction_required check (
  payment_method not in ('maya_online', 'demo_card') or payment_transaction_id is not null
);

-- ============================================================================
-- 3. EXTEND ONLINE-ORDER INTEGRITY GUARDS TO demo_card
-- ============================================================================

create or replace function public.guard_online_order_fulfillment()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.payment_method in ('maya_online', 'demo_card') then
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'Cancelled online orders cannot be reopened.';
    end if;
    if row(new.payment_method, new.payment_transaction_id, new.buyer_id, new.seller_id,
           new.shop_id, new.subtotal, new.shipping_fee, new.total)
       is distinct from
       row(old.payment_method, old.payment_transaction_id, old.buyer_id, old.seller_id,
           old.shop_id, old.subtotal, old.shipping_fee, old.total) then
      raise exception 'Online checkout financial fields cannot be changed.';
    end if;
  end if;
  if new.payment_method in ('maya_online', 'demo_card') and new.status = 'cancelled'
     and (tg_op = 'INSERT' or old.status <> 'cancelled') and not exists (
       select 1 from public.payment_transactions t where t.id = new.payment_transaction_id
       and t.status in ('cancelled', 'expired') and t.inventory_released_at is null
     ) then
    raise exception 'Cancel the whole unpaid online checkout through its trusted lifecycle.';
  end if;
  if new.payment_method in ('maya_online', 'demo_card')
     and new.status not in ('pending', 'cancelled') then
    if new.payment_status <> 'paid' or not exists (
      select 1 from public.payment_transactions t
      where t.id = new.payment_transaction_id and t.buyer_id = new.buyer_id and t.status = 'paid'
    ) then
      raise exception 'Awaiting Payment: online orders cannot be fulfilled before verified payment.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_online_order_fulfillment() from public, anon, authenticated;

create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders; v_tx public.payment_transactions;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found or (auth.uid() <> v_order.buyer_id and auth.uid() <> v_order.seller_id) then
    raise exception 'Order not found or not permitted.';
  end if;
  if v_order.payment_method not in ('maya_online', 'demo_card') then
    return public.checkout_cancel_order_legacy(p_order_id, p_reason);
  end if;
  select * into v_tx from public.payment_transactions where id = v_order.payment_transaction_id for update;
  if v_tx.inventory_released_at is not null then return true; end if;
  if not public.finish_unpaid_online_checkout(v_tx.id, 'cancelled') then
    raise exception 'Checkout cannot be cancelled without payment reconciliation.';
  end if;
  return true;
end;
$$;
revoke all on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

create or replace function public.update_seller_order_status(
  p_order_id uuid, p_new_status text, p_tracking_number text default null, p_courier_name text default null
)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.seller_id <> auth.uid() then raise exception 'Order not found or not permitted.'; end if;
  if v_order.payment_method in ('maya_online', 'demo_card') then
    perform id from public.payment_transactions where id = v_order.payment_transaction_id for update;
    if p_new_status = 'cancelled' then return public.cancel_order(p_order_id); end if;
  end if;
  return public.checkout_seller_status_legacy(p_order_id, p_new_status, p_tracking_number, p_courier_name);
end;
$$;
revoke all on function public.update_seller_order_status(uuid, text, text, text) from public, anon;
grant execute on function public.update_seller_order_status(uuid, text, text, text) to authenticated;

-- ============================================================================
-- 4. CREATE_DEMO_CHECKOUT RPC (MIRRORS create_online_checkout)
-- ============================================================================
-- Server-authoritative: cart snapshot, stock validation, per-shop orders,
-- stock decrement, cart clearing. Amounts are derived, never trusted from
-- the client. Only the non-sensitive card_last4 is accepted; full PAN/CVV
-- must never leave the buyer's browser.
-- ============================================================================

create or replace function public.create_demo_checkout(
  p_attempt_id uuid,
  p_delivery_method text,
  p_shipping_name text default null,
  p_shipping_phone text default null,
  p_shipping_address text default null,
  p_buyer_note text default null,
  p_card_last4 text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer uuid := auth.uid();
  v_existing jsonb;
  v_cart jsonb;
  v_groups jsonb;
  v_item record;
  v_group record;
  v_amount numeric(12,2);
  v_tx uuid;
  v_order uuid;
  v_orders uuid[] := array[]::uuid[];
  v_count integer;
  v_sum numeric;
  v_reference text;
begin
  if v_buyer is null then raise exception 'Authentication required for checkout.'; end if;
  if p_attempt_id is null then raise exception 'Checkout attempt is required.'; end if;
  if p_card_last4 is null or p_card_last4 !~ '^[0-9]{4}$' then
    raise exception 'Demo card last4 digits are required.';
  end if;

  -- Serialize this buyer's online attempts. A hash collision only adds waiting.
  perform pg_advisory_xact_lock(hashtextextended('online-checkout:' || v_buyer::text, 0));
  v_existing := public.recover_online_checkout(p_attempt_id);
  if v_existing is not null then return v_existing; end if;
  perform id from public.payment_transactions where buyer_id = v_buyer
    and checkout_attempt_id is not null and status in ('created', 'pending', 'authorized') for update;
  if exists (select 1 from public.payment_transactions where buyer_id = v_buyer
      and checkout_attempt_id is not null and status = 'created' and expires_at <= clock_timestamp()) then
    raise exception 'Reservation expired. Recover payment status before retrying.';
  end if;
  v_existing := public.get_online_checkout(null);
  if v_existing is not null then return v_existing; end if;

  if (select count(*) from public.payment_transactions where buyer_id = v_buyer
      and checkout_attempt_id is not null and created_at > clock_timestamp() - interval '1 hour') >= 3 then
    raise exception 'Online checkout limit reached. Try again later.';
  end if;

  if p_delivery_method is null or p_delivery_method not in ('delivery', 'meetup') then
    raise exception 'Invalid delivery method.';
  end if;
  if p_delivery_method = 'delivery' and (
    nullif(trim(p_shipping_name), '') is null or nullif(trim(p_shipping_phone), '') is null
    or nullif(trim(p_shipping_address), '') is null
  ) then raise exception 'Recipient, phone and address are required for delivery.'; end if;
  if length(p_shipping_name) > 150 or length(p_shipping_phone) > 50
     or length(p_shipping_address) > 1000 or length(p_buyer_note) > 1000 then
    raise exception 'Checkout details exceed the allowed length.';
  end if;

  -- Freeze exact cart rows and quantities; later inserts must not be silently cleared.
  select jsonb_agg(to_jsonb(c)) into v_cart from (
    select id, product_id, quantity from public.cart_items
    where user_id = v_buyer order by id limit 101 for update
  ) c;
  if v_cart is null then raise exception 'Your cart is empty.'; end if;
  if jsonb_array_length(v_cart) > 100 then raise exception 'Online checkout supports up to 100 cart items.'; end if;

  perform p.id from public.products p
  join jsonb_to_recordset(v_cart) as c(product_id uuid) on c.product_id = p.id
  order by p.id for update of p;
  perform s.id from public.shops s where s.id in (
    select p.shop_id from public.products p
    join jsonb_to_recordset(v_cart) as c(product_id uuid) on c.product_id = p.id
  ) order by s.id for share;

  for v_item in
    select c.quantity, p.id, p.seller_id, p.price, p.stock, p.status,
           s.id as shop_id, s.owner_id, s.status as shop_status
    from jsonb_to_recordset(v_cart) as c(product_id uuid, quantity integer)
    left join public.products p on p.id = c.product_id
    left join public.shops s on s.id = p.shop_id
  loop
    if v_item.id is null or v_item.status is distinct from 'active' then
      raise exception 'A product is no longer available. Refresh your cart.';
    end if;
    if v_item.seller_id = v_buyer then raise exception 'You cannot purchase your own listing.'; end if;
    if v_item.shop_id is null or v_item.owner_id is distinct from v_item.seller_id
       or v_item.shop_status is distinct from 'active' then
      raise exception 'A product does not belong to an active, valid shop.';
    end if;
    if v_item.quantity is null or v_item.quantity <= 0 or v_item.stock is null
       or v_item.stock < v_item.quantity then
      raise exception 'Stock changed or quantity is invalid. Refresh your cart.';
    end if;
    if v_item.price is null or v_item.price <= 0 then raise exception 'A product price is invalid.'; end if;
  end loop;

  -- Match legacy pricing: shipping per shop = 150, free for meetup or subtotal >= 10000.
  select jsonb_agg(to_jsonb(g)), sum(g.subtotal + g.shipping) into v_groups, v_amount
  from (
    select p.seller_id, p.shop_id, sum(p.price * c.quantity) as subtotal,
      case when p_delivery_method = 'meetup' or sum(p.price * c.quantity) >= 10000
           then 0::numeric else 150::numeric end as shipping
    from jsonb_to_recordset(v_cart) as c(product_id uuid, quantity integer)
    join public.products p on p.id = c.product_id
    group by p.seller_id, p.shop_id
  ) g;

  -- Server-generated demo reference, e.g. DEMO-20260927-ABC123.
  v_reference := 'DEMO-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(md5(v_buyer::text || clock_timestamp()::text || random()::text), 1, 6));

  insert into public.payment_transactions (
    buyer_id, provider, currency, amount, status, checkout_attempt_id, expires_at,
    sandbox, payment_method, card_last4, transaction_reference
  )
  values (
    v_buyer, 'circuitcart_sandbox', 'PHP', v_amount, 'created', p_attempt_id,
    clock_timestamp() + interval '20 minutes',
    true, 'demo_card', p_card_last4, v_reference
  ) returning id into v_tx;

  for v_group in select * from jsonb_to_recordset(v_groups)
    as g(seller_id uuid, shop_id uuid, subtotal numeric, shipping numeric)
  loop
    insert into public.orders (
      buyer_id, seller_id, shop_id, status, subtotal, shipping_fee, total,
      delivery_method, payment_method, payment_status, payment_transaction_id,
      payment_reference, shipping_name, shipping_phone, shipping_address, buyer_note
    ) values (
      v_buyer, v_group.seller_id, v_group.shop_id, 'pending', v_group.subtotal,
      v_group.shipping, v_group.subtotal + v_group.shipping,
      p_delivery_method, 'demo_card', 'pending', v_tx,
      v_reference,
      nullif(trim(p_shipping_name), ''), nullif(trim(p_shipping_phone), ''),
      nullif(trim(p_shipping_address), ''), nullif(trim(p_buyer_note), '')
    ) returning id into v_order;
    v_orders := array_append(v_orders, v_order);

    insert into public.order_items (order_id, product_id, product_title, product_image_path, unit_price, quantity, line_total)
    select v_order, p.id, p.title,
      (select i.storage_path from public.product_images i where i.product_id = p.id order by i.sort_order, i.id limit 1),
      p.price, c.quantity, p.price * c.quantity
    from jsonb_to_recordset(v_cart) as c(product_id uuid, quantity integer)
    join public.products p on p.id = c.product_id
    where p.seller_id = v_group.seller_id and p.shop_id = v_group.shop_id;
  end loop;

  select count(*), sum(o.total) into v_count, v_sum from public.orders o
  where o.payment_transaction_id = v_tx;
  if v_count <> cardinality(v_orders) or v_sum is distinct from v_amount
     or exists (select 1 from public.orders o where o.payment_transaction_id = v_tx
                and (o.buyer_id <> v_buyer or not (o.id = any(v_orders)))) then
    raise exception 'Checkout total integrity check failed.';
  end if;

  update public.products p set stock = p.stock - c.quantity,
    status = case when p.stock - c.quantity = 0 then 'sold_out' else p.status end
  from jsonb_to_recordset(v_cart) as c(product_id uuid, quantity integer)
  where p.id = c.product_id;
  delete from public.cart_items c using jsonb_to_recordset(v_cart) as snapshot(id uuid)
  where c.id = snapshot.id and c.user_id = v_buyer;

  -- No payouts or payment success here; confirmation happens separately.
  return public.get_online_checkout(p_attempt_id);
end;
$$;
revoke all on function public.create_demo_checkout(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_demo_checkout(uuid, text, text, text, text, text, text) to authenticated;

-- ============================================================================
-- 5. CONFIRM ONLINE PAYMENT: PROVIDER-AWARE NOTIFICATIONS
-- ============================================================================
-- Logic identical to Phase 12; only the human-readable notifications branch
-- on provider so demo receipts never claim to be Maya payments.
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
  v_is_demo boolean;
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

  v_is_demo := coalesce(v_tx.sandbox, false) or v_tx.provider = 'circuitcart_sandbox';

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
      case when v_is_demo
        then 'You received a paid Demo Card sandbox order (' || v_buyer_order_ref || '). Total: ₱' || to_char(v_order.total, 'FM999,999,990.00') || '. No real money was charged. You may now start fulfillment.'
        else 'You received a paid Maya Sandbox order (' || v_buyer_order_ref || '). Total: ₱' || to_char(v_order.total, 'FM999,999,990.00') || '. You may now start fulfillment.'
      end,
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
      case when v_is_demo then 'Demo Payment Confirmed' else 'Maya Payment Confirmed' end,
      case when v_is_demo
        then 'Your demo payment of ₱' || to_char(v_tx.amount, 'FM999,999,990.00') || ' via Demo Card (sandbox) has been confirmed. No real money was charged. Your order is now being processed.'
        else 'Your payment of ₱' || to_char(v_tx.amount, 'FM999,999,990.00') || ' via Maya Sandbox has been confirmed. Your order is now being processed.'
      end,
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

commit;
