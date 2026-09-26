\set ON_ERROR_STOP on
-- Run after bootstrap.sql ONLY in the disposable local cluster. All fixtures roll back.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
declare caught boolean := false;
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then raise exception 'Unexpected error: %', sqlerrm; end if;
    caught := true;
  end;
  perform pg_temp.assert_true(caught, expected);
end $$;

insert into auth.users (id, email) values
 ('10000000-0000-4000-8000-000000000001', 'buyer-one@example.invalid'),
 ('10000000-0000-4000-8000-000000000002', 'buyer-two@example.invalid'),
 ('10000000-0000-4000-8000-000000000003', 'seller-one@example.invalid'),
 ('10000000-0000-4000-8000-000000000004', 'seller-two@example.invalid');
update public.profiles set role = 'seller' where id in
 ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004');
insert into public.shops (id, owner_id, name, slug) values
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Test A', 'test-a'),
 ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'Test B', 'test-b');
insert into public.products (id, seller_id, shop_id, title, category, condition, price, stock, status) values
 ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Test Laptop', 'Laptops', 'New', 10000.10, 10, 'active'),
 ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'Test Mouse', 'Accessories', 'New', 99.95, 10, 'active');

set local role anon;
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup')$q$, 'permission denied');
reset role;
set local role authenticated;
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup')$q$, 'Authentication required');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup')$q$, 'Your cart is empty');
insert into public.cart_items (user_id, product_id, quantity) values
 (auth.uid(), '30000000-0000-4000-8000-000000000001', 1),
 (auth.uid(), '30000000-0000-4000-8000-000000000002', 3);
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), null)$q$, 'Invalid delivery method');
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'delivery')$q$, 'required for delivery');
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup', p_amount => 1)$q$, 'does not exist');
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup', p_buyer_id => auth.uid())$q$, 'does not exist');
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup', p_payment_status => 'paid')$q$, 'does not exist');

-- Failure *after* orders/items exist proves the whole RPC rolls back, not just validation.
reset role;
create function pg_temp.inject_checkout_failure() returns trigger language plpgsql as $$
begin raise exception 'injected cart-delete failure'; end $$;
create trigger test_checkout_failure before delete on public.cart_items
for each row execute function pg_temp.inject_checkout_failure();
set local role authenticated;
select pg_temp.expect_error($q$select public.create_online_checkout('40000000-0000-4000-8000-000000000001', 'meetup')$q$, 'injected cart-delete failure');
select pg_temp.assert_true((select count(*) = 0 from public.orders), 'failed checkout has no orders');
select pg_temp.assert_true((select count(*) = 0 from public.payment_transactions), 'failed checkout has no payment');
select pg_temp.assert_true((select count(*) = 0 from public.order_items), 'failed checkout has no items');
select pg_temp.assert_true((select count(*) = 2 from public.cart_items), 'failed checkout preserves cart');
select pg_temp.assert_true((select sum(stock) = 20 from public.products), 'failed checkout restores stock');
reset role;
drop trigger test_checkout_failure on public.cart_items;
set local role authenticated;

select public.create_online_checkout('40000000-0000-4000-8000-000000000001', 'delivery', 'Test Buyer', 'test-phone', 'Test address') as result \gset
select pg_temp.assert_true(:'result'::jsonb->>'amount' = '10449.95', 'exact NUMERIC cents + per-shop shipping');
select pg_temp.assert_true(jsonb_array_length(:'result'::jsonb->'orderIds') = 2, 'two sellers -> two orders');
select pg_temp.assert_true((select bool_and(buyer_id = auth.uid() and payment_method = 'maya_online' and payment_status = 'pending' and status = 'pending') from public.orders), 'all orders pending and buyer-derived');
select pg_temp.assert_true((select sum(total) = 10449.95 from public.orders), 'child sum equals transaction amount');
select pg_temp.assert_true((select count(distinct payment_transaction_id) = 1 from public.orders), 'one parent across children');
select pg_temp.assert_true((select bool_and(status = 'created' and provider = 'maya' and provider_checkout_id is null and provider_payment_id is null and authorized_at is null and paid_at is null) from public.payment_transactions), 'no fabricated evidence or payment');
select pg_temp.assert_true((select count(*) = 0 from public.cart_items), 'purchased cart cleared');
select pg_temp.assert_true((select sum(stock) = 16 from public.products), 'stock decremented once');
select pg_temp.assert_true((select count(*) = 0 from public.seller_payouts), 'no payouts created');
select pg_temp.assert_true(public.create_online_checkout('40000000-0000-4000-8000-000000000001', 'meetup') = :'result'::jsonb, 'same key replays original result even after cart cleared');
select pg_temp.assert_true(public.create_online_checkout(gen_random_uuid(), 'meetup') = :'result'::jsonb, 'different key recovers active checkout');
select pg_temp.assert_true(public.get_online_checkout() = :'result'::jsonb, 'refresh recovery returns same checkout');
select pg_temp.assert_true((select count(*) = 2 from public.orders), 'no duplicate orders');
select pg_temp.expect_error($q$insert into public.payment_transactions(buyer_id,provider,amount) values(auth.uid(),'maya',1)$q$, 'permission denied');
select pg_temp.expect_error($q$update public.payment_transactions set status='paid',paid_at=now()$q$, 'permission denied');
-- Orders have no mutation RLS policy; a direct update sees zero writable rows.
update public.orders set payment_status = 'paid';
select pg_temp.assert_true((select bool_and(payment_status = 'pending') from public.orders), 'direct order paid update rejected by RLS');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(public.get_online_checkout('40000000-0000-4000-8000-000000000001') is null, 'other buyer cannot recover checkout');
select pg_temp.assert_true((select count(*) = 0 from public.payment_transactions), 'other buyer financial rows hidden');
select pg_temp.assert_true((select count(*) = 0 from public.orders), 'other buyer orders hidden');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select pg_temp.expect_error($q$select public.update_seller_order_status((select id from public.orders limit 1), 'confirmed')$q$, 'Awaiting Payment');
select pg_temp.assert_true((select bool_and(status = 'pending') from public.orders), 'seller cannot confirm unpaid online order');

-- Even a trusted caller cannot bypass cross-buyer linkage / mutate online totals.
reset role;
select pg_temp.expect_error($q$update public.orders set total=1 where payment_method='maya_online'$q$, 'financial fields cannot be changed');
select pg_temp.expect_error($q$insert into public.orders (buyer_id,seller_id,shop_id,subtotal,shipping_fee,total,delivery_method,payment_method,payment_transaction_id)
select '10000000-0000-4000-8000-000000000002',seller_id,shop_id,subtotal,shipping_fee,total,delivery_method,'maya_online',payment_transaction_id from public.orders limit 1$q$, 'does not match payment transaction');

-- Validation cases for a second buyer with no active checkout.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
insert into public.cart_items(user_id, product_id, quantity) values(auth.uid(), '30000000-0000-4000-8000-000000000001', 100);
set local role authenticated;
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup')$q$, 'Stock changed');
update public.cart_items set quantity = 1 where user_id = auth.uid();
reset role;
update public.products set status = 'archived' where id = '30000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup')$q$, 'no longer available');
reset role;
update public.products set status = 'active' where id = '30000000-0000-4000-8000-000000000001';
update public.shops set status = 'vacation' where id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(), 'meetup')$q$, 'active, valid shop');
reset role;
update public.shops set status = 'active' where id = '20000000-0000-4000-8000-000000000001';

-- Legacy regression: all four unchanged methods, no transaction links; seller confirms normally.
set local role authenticated;
do $$
declare method text; order_ref uuid; buyer uuid := auth.uid();
begin
  foreach method in array array['cash_on_delivery','cash_on_meetup','manual_gcash','manual_maya'] loop
    insert into public.cart_items(user_id, product_id, quantity) values(buyer, '30000000-0000-4000-8000-000000000001', 1)
    on conflict(user_id,product_id) do update set quantity = 1;
    select order_id into order_ref from public.checkout_cart(
      case when method='cash_on_meetup' then 'meetup' else 'delivery' end, 'Buyer','phone','address',null,method);
    perform pg_temp.assert_true((select payment_transaction_id is null and payment_status='pending' and payment_method=method from public.orders where id=order_ref), 'legacy ' || method);
    perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
    perform public.update_seller_order_status(order_ref, 'confirmed');
    perform set_config('request.jwt.claim.sub', buyer::text, true);
  end loop;
end $$;

-- Cancellation keeps existing stock rollback and flags checkout as unsuitable for payment.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
reset role;
create function pg_temp.inject_release_failure() returns trigger language plpgsql as $$
begin
  if new.status='cancelled' then raise exception 'injected restoration failure'; end if;
  return new;
end $$;
create trigger test_release_failure before update on public.orders for each row execute function pg_temp.inject_release_failure();
set local role authenticated;
select pg_temp.expect_error($q$select public.cancel_online_checkout('40000000-0000-4000-8000-000000000001')$q$, 'injected restoration failure');
select pg_temp.assert_true((select sum(stock)=12 from public.products), 'failed release rolls restored stock back');
select pg_temp.assert_true((select bool_and(status='created' and inventory_released_at is null) from public.payment_transactions), 'failed release rolls parent state back');
reset role;
drop trigger test_release_failure on public.orders;
set local role authenticated;
select public.cancel_order((select id from public.orders limit 1));
select pg_temp.assert_true((public.get_online_checkout('40000000-0000-4000-8000-000000000001')->>'hasCancelledOrders')::boolean, 'same-key recovery identifies cancellation');
select pg_temp.assert_true(public.get_online_checkout() is null, 'cancelled checkout excluded from active recovery');
select pg_temp.assert_true((select bool_and(status='cancelled') from public.orders), 'all siblings cancelled together');
select pg_temp.assert_true((select sum(stock)=16 from public.products), 'all online stock restored, legacy stock unchanged');
select public.cancel_online_checkout('40000000-0000-4000-8000-000000000001');
select public.cancel_order((select id from public.orders limit 1));
select pg_temp.assert_true((select sum(stock)=16 from public.products), 'repeated cancellation restores exactly once');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(public.recover_online_checkout('40000000-0000-4000-8000-000000000001') is null, 'definer recovery still isolates buyers');
select pg_temp.expect_error($q$select public.cancel_online_checkout('40000000-0000-4000-8000-000000000001')$q$, 'Checkout not found');
insert into public.cart_items(user_id,product_id,quantity) values(auth.uid(),'30000000-0000-4000-8000-000000000001',2);
select public.create_online_checkout('40000000-0000-4000-8000-000000000001','meetup') as second \gset
select pg_temp.assert_true(:'second'::jsonb->>'paymentTransactionId' <> :'result'::jsonb->>'paymentTransactionId', 'same attempt value is independently scoped to buyer');
select pg_temp.assert_true((select sum(stock)=14 from public.products), 'second buyer reserves two units');
select pg_temp.assert_true(public.expire_online_checkouts()=0, 'not-yet-due checkout cannot expire');
reset role;
update public.payment_transactions set expires_at = clock_timestamp() - interval '1 second'
where buyer_id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(),'meetup')$q$, 'Reservation expired');
select pg_temp.assert_true(public.expire_online_checkouts()=1, 'trusted cleanup expires overdue reservation');
select pg_temp.assert_true(public.expire_online_checkouts()=0, 'second expiry has nothing to restore');
select pg_temp.assert_true((select sum(stock)=16 from public.products), 'expiry restores exactly two units once');
select pg_temp.assert_true(public.get_online_checkout() is null, 'expired checkout excluded from active recovery');
select pg_temp.assert_true(public.create_online_checkout('40000000-0000-4000-8000-000000000001','meetup')->>'paymentStatus'='expired', 'same-key retry retains expired history without reserving again');
select pg_temp.assert_true((select sum(stock)=16 from public.products), 'same-key terminal replay does not change stock');

-- Up to 3 new attempts/hour; cancellations do not reset the database rate guard.
do $$ declare k uuid; i integer; begin
  for i in 1..2 loop
    k := gen_random_uuid();
    insert into public.cart_items(user_id,product_id,quantity) values(auth.uid(),'30000000-0000-4000-8000-000000000001',1);
    perform public.create_online_checkout(k,'meetup');
    perform public.cancel_online_checkout(k);
  end loop;
end $$;
insert into public.cart_items(user_id,product_id,quantity) values(auth.uid(),'30000000-0000-4000-8000-000000000001',1);
select pg_temp.expect_error($q$select public.create_online_checkout(gen_random_uuid(),'meetup')$q$, 'limit reached');
select pg_temp.assert_true((select sum(stock)=16 from public.products), 'rate limit does not change stock');
select pg_temp.expect_error($q$select public.finish_unpaid_online_checkout(gen_random_uuid(),'expired')$q$, 'permission denied');
select pg_temp.expect_error($q$select public.checkout_cancel_order_legacy(gen_random_uuid())$q$, 'permission denied');
select pg_temp.expect_error($q$select public.checkout_seller_status_legacy(gen_random_uuid(),'confirmed')$q$, 'permission denied');
reset role;
select pg_temp.expect_error($q$update public.orders set status='pending' where payment_method='maya_online'$q$, 'cannot be reopened');

-- Check exact allowlist instead of fabricating a successful provider payment.
select pg_temp.assert_true(position('v_tx.status <> ''created''' in pg_get_functiondef('public.finish_unpaid_online_checkout(uuid,text)'::regprocedure)) > 0,
  'expiry/cancel refuses paid, authorized, pending and other non-created states by explicit allowlist');

-- Exercise the non-created guard without manufacturing paid/authorized evidence.
savepoint non_created_state;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.cart_items(user_id,product_id,quantity) values(auth.uid(),'30000000-0000-4000-8000-000000000001',1);
set local role authenticated;
select public.create_online_checkout('40000000-0000-4000-8000-000000000099','meetup');
reset role;
update public.payment_transactions set status='pending', expires_at=clock_timestamp()-interval '1 second'
where checkout_attempt_id='40000000-0000-4000-8000-000000000099';
set local role authenticated;
select pg_temp.assert_true(public.expire_online_checkouts()=0, 'future provider-pending checkout not blindly expired');
select pg_temp.expect_error($q$select public.cancel_online_checkout('40000000-0000-4000-8000-000000000099')$q$, 'payment reconciliation');
rollback to non_created_state;

-- Audit the deployed-in-test catalog, not only source spelling of GRANT/REVOKE.
select pg_temp.assert_true(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname='public' and p.proname in (
    'create_online_checkout','get_online_checkout','recover_online_checkout','cancel_online_checkout',
    'expire_online_checkouts','finish_unpaid_online_checkout','guard_online_order_fulfillment',
    'cancel_order','update_seller_order_status','checkout_cancel_order_legacy','checkout_seller_status_legacy')
    and a.privilege_type='EXECUTE' and a.grantee in (0, 'anon'::regrole)
), 'no new or wrapped function grants PUBLIC/anon execute');
select pg_temp.assert_true(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'create_online_checkout','recover_online_checkout','cancel_online_checkout','expire_online_checkouts',
    'cancel_order','update_seller_order_status','checkout_cancel_order_legacy','checkout_seller_status_legacy')
    and (not p.prosecdef or not ('search_path=public, pg_temp'=any(p.proconfig)))
), 'every definer has fixed required search_path');
rollback;
\echo 'PASS: all online checkout security / atomicity / legacy regression assertions (fixtures rolled back)'
