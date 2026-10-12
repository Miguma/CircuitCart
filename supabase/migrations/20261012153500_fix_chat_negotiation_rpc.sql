-- ============================================================================
-- CIRCUITCART MIGRATION: DIRECT PUBLIC CHAT NEGOTIATION AND MEETUP RPCS
-- Date: 2026-10-12
--
-- Exposes send_chat_offer, respond_chat_offer, confirm_meetup_balance, and
-- refund_meetup_deposit directly as public SECURITY DEFINER functions so
-- PostgREST reliably caches and indexes their exact signatures.
-- Auth and seller/buyer boundaries remain strictly validated internally.
-- ============================================================================

begin;

-- 1. SEND CHAT OFFER
create or replace function public.send_chat_offer(
  p_conversation_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_expires_hours integer default 24
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_c public.conversations;
  v_p public.products;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  -- Lock product for share, matching checkout concurrency model
  select * into v_p from public.products where id = p_product_id for share;
  select * into v_c from public.conversations where id = p_conversation_id;

  if v_c.id is null or v_c.seller_id is distinct from auth.uid() or v_c.order_id is not null
    or v_p.seller_id is distinct from v_c.seller_id or v_p.shop_id is distinct from v_c.shop_id
    or (v_c.product_id is not null and v_c.product_id <> p_product_id)
    or v_p.status is distinct from 'active'
    or not exists (
      select 1 from public.shops
      where id = v_p.shop_id and owner_id = auth.uid() and status = 'active'
    ) then
    raise exception 'Only this product seller can send an offer in this conversation.' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity not between 1 and 10000 or p_quantity > v_p.stock
    or p_unit_price is null or p_unit_price <= 0 or p_unit_price > 9999999999.99 or p_unit_price <> round(p_unit_price, 2)
    or p_expires_hours is null or p_expires_hours not between 1 and 168 then
    raise exception 'Invalid offer price, quantity or expiry.';
  end if;

  -- Serialize version replacement for this conversation/product without deleting history
  perform pg_advisory_xact_lock(hashtextextended('offer:' || p_conversation_id::text || p_product_id::text, 0));

  if exists (
    select 1 from public.chat_offers
    where conversation_id = p_conversation_id and product_id = p_product_id and status = 'reserved'
  ) then
    raise exception 'This offer is locked in an active checkout.';
  end if;

  update public.chat_offers
  set status = 'withdrawn', updated_at = clock_timestamp()
  where conversation_id = p_conversation_id and product_id = p_product_id and status in ('pending', 'accepted');

  insert into public.chat_offers (
    conversation_id, buyer_id, seller_id, product_id, quantity, unit_price, expires_at
  )
  values (
    v_c.id, v_c.buyer_id, v_c.seller_id, v_p.id, p_quantity, p_unit_price,
    clock_timestamp() + make_interval(hours => p_expires_hours)
  )
  returning id into v_id;

  insert into public.messages (conversation_id, sender_id, body)
  values (
    v_c.id, auth.uid(),
    'Private offer sent: ' || p_quantity || ' × ₱' || p_unit_price::text || '. Review the offer card to accept.'
  );

  return v_id;
end $$;

revoke all on function public.send_chat_offer(uuid, uuid, integer, numeric, integer) from public;
grant execute on function public.send_chat_offer(uuid, uuid, integer, numeric, integer) to authenticated, service_role, anon;

-- 2. RESPOND CHAT OFFER
create or replace function public.respond_chat_offer(
  p_offer_id uuid,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_o public.chat_offers;
  v_p public.products;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_o from public.chat_offers where id = p_offer_id;
  if v_o.id is null or auth.uid() not in (v_o.buyer_id, v_o.seller_id) then
    raise exception 'Offer not accessible.' using errcode = '42501';
  end if;

  if p_action is null or p_action not in ('accept', 'decline', 'withdraw') or
     (p_action = 'withdraw' and auth.uid() <> v_o.seller_id) or
     (p_action <> 'withdraw' and auth.uid() <> v_o.buyer_id) then
    raise exception 'Offer action not permitted.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('online-checkout:' || v_o.buyer_id::text, 0));
  perform id from public.cart_items where user_id = v_o.buyer_id and product_id = v_o.product_id for update;
  select * into v_p from public.products where id = v_o.product_id for share;
  select * into v_o from public.chat_offers where id = p_offer_id for update;

  if v_o.status = 'accepted' and p_action = 'accept' then
    if v_o.expires_at <= clock_timestamp() then
      raise exception 'Offer expired. Ask the seller for a new offer.';
    end if;
  elsif v_o.status <> 'pending' and not (p_action = 'withdraw' and v_o.status = 'accepted') then
    raise exception 'Offer is no longer available.';
  end if;

  if p_action = 'accept' then
    if v_o.expires_at <= clock_timestamp() or v_p.status <> 'active' or v_p.stock < v_o.quantity
       or not exists (
         select 1 from public.shops
         where id = v_p.shop_id and owner_id = v_o.seller_id and status = 'active'
       ) then
      raise exception 'Offer expired or product unavailable.';
    end if;

    update public.chat_offers
    set status = 'accepted', updated_at = clock_timestamp()
    where id = v_o.id;

    insert into public.cart_items (user_id, product_id, quantity, offer_id)
    values (v_o.buyer_id, v_o.product_id, v_o.quantity, v_o.id)
    on conflict (user_id, product_id)
    do update set quantity = excluded.quantity, offer_id = excluded.offer_id;
  else
    update public.chat_offers
    set status = case when p_action = 'withdraw' then 'withdrawn' else 'declined' end,
        updated_at = clock_timestamp()
    where id = v_o.id;
  end if;

  return true;
end $$;

revoke all on function public.respond_chat_offer(uuid, text) from public;
grant execute on function public.respond_chat_offer(uuid, text) to authenticated, service_role, anon;

-- 3. CONFIRM MEETUP BALANCE
create or replace function public.confirm_meetup_balance(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_o public.orders;
  v_tx public.payment_transactions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_o from public.orders where id = p_order_id;
  if v_o.id is null or v_o.seller_id is distinct from auth.uid() then
    raise exception 'Order not accessible.' using errcode = '42501';
  end if;

  select * into v_tx from public.payment_transactions where id = v_o.payment_transaction_id for update;
  select * into v_o from public.orders where id = p_order_id for update;

  if v_o.deposit_amount is null or v_o.status not in ('ready', 'completed') or v_tx.status is distinct from 'paid'
     or v_o.payment_status not in ('partially_paid', 'paid') then
    raise exception 'A verified deposit and ready meetup order are required.';
  end if;

  if v_o.balance_received_at is not null then
    return true;
  end if;

  update public.orders
  set balance_received_at = clock_timestamp(), payment_status = 'paid', updated_at = clock_timestamp()
  where id = v_o.id;

  insert into public.notifications (user_id, type, title, message, link, entity_id)
  values (
    v_o.buyer_id, 'order_update', 'Meetup balance confirmed',
    'The seller confirmed the remaining cash payment. Confirm receipt after inspecting and receiving your item.',
    '/marketplace/orders?orderId=' || v_o.id::text, v_o.id
  );

  return true;
end $$;

revoke all on function public.confirm_meetup_balance(uuid) from public;
grant execute on function public.confirm_meetup_balance(uuid) to authenticated, service_role, anon;

-- 4. REFUND MEETUP DEPOSIT
create or replace function public.refund_meetup_deposit(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_o public.orders;
  v_tx public.payment_transactions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_o from public.orders where id = p_order_id;
  if v_o.id is null or auth.uid() not in (v_o.buyer_id, v_o.seller_id) then
    raise exception 'Order not accessible.' using errcode = '42501';
  end if;

  select * into v_tx from public.payment_transactions where id = v_o.payment_transaction_id for update;
  select * into v_o from public.orders where id = p_order_id for update;
  perform id from public.seller_payouts where order_id = v_o.id for update;

  if v_o.deposit_refunded_at is not null then
    return true;
  end if;

  if v_o.deposit_amount is null or v_tx.provider is distinct from 'circuitcart_sandbox' or v_tx.sandbox is distinct from true
    or v_tx.status is distinct from 'paid' or v_o.status not in ('confirmed', 'preparing', 'ready')
    or v_o.payment_status <> 'partially_paid' or v_o.balance_received_at is not null
    or exists (select 1 from public.seller_payouts where order_id = v_o.id and status in ('processing', 'released')) then
    raise exception 'Only an uncompleted sandbox meetup deposit can be refunded here. Gateway payments require verified provider refund.';
  end if;

  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = v_o.id order by p.id for update of p;
  update public.products p set stock = p.stock + r.quantity, status = case when p.status = 'sold_out' then 'active' else p.status end
  from (select product_id, sum(quantity)::integer quantity from public.order_items where order_id = v_o.id group by product_id) r where p.id = r.product_id;

  update public.orders
  set status = 'cancelled', payment_status = 'refunded', deposit_refunded_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = v_o.id;

  insert into public.notifications (user_id, type, title, message, link, entity_id)
  values (
    v_o.buyer_id, 'order_update', 'Meetup cancelled — simulated refund',
    'Your sandbox deposit was reversed and the order cancelled. No real money was charged or transferred.',
    '/marketplace/orders?orderId=' || v_o.id::text, v_o.id
  );

  return true;
end $$;

revoke all on function public.refund_meetup_deposit(uuid) from public;
grant execute on function public.refund_meetup_deposit(uuid) to authenticated, service_role, anon;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
