-- Private seller-to-buyer offers and required 50% deposits for NEW meetup orders.
-- Existing orders retain their original settlement terms. Apply this migration only.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.chat_offers (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id),
 buyer_id uuid not null references public.profiles(id),
 seller_id uuid not null references public.profiles(id),
 product_id uuid not null references public.products(id),
 quantity integer not null check(quantity between 1 and 10000),
 unit_price numeric(12,2) not null check(unit_price > 0),
 status text not null default 'pending' check(status in ('pending','accepted','declined','withdrawn','reserved','consumed')),
 expires_at timestamptz not null,
 checkout_transaction_id uuid references public.payment_transactions(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(buyer_id <> seller_id)
);
create index chat_offers_conversation_idx on public.chat_offers(conversation_id,created_at);
create index chat_offers_buyer_idx on public.chat_offers(buyer_id);
create index chat_offers_seller_idx on public.chat_offers(seller_id);
create index chat_offers_product_idx on public.chat_offers(product_id);
create index chat_offers_checkout_idx on public.chat_offers(checkout_transaction_id);
create unique index chat_offers_live_idx on public.chat_offers(conversation_id,product_id) where status in ('pending','accepted');
alter table public.chat_offers enable row level security;
revoke all on public.chat_offers from public,anon,authenticated;
grant select on public.chat_offers to authenticated;
create policy offer_participants_read on public.chat_offers for select to authenticated
 using(buyer_id=(select auth.uid()) or seller_id=(select auth.uid()));
alter publication supabase_realtime add table public.chat_offers;

alter table public.cart_items add column offer_id uuid references public.chat_offers(id);
create index cart_offer_idx on public.cart_items(offer_id);
alter table public.order_items add column offer_id uuid references public.chat_offers(id);
create index order_items_offer_idx on public.order_items(offer_id);
alter table public.orders
 add column deposit_amount numeric(12,2),
 add column balance_due numeric(12,2) generated always as (case when deposit_amount is null then 0 else total-deposit_amount end) stored,
 add column balance_received_at timestamptz,
 add column deposit_refunded_at timestamptz,
 add constraint meetup_deposit_terms check(deposit_amount is null or
   (delivery_method='meetup' and payment_method in ('demo_card','maya_online') and shipping_fee=0
    and deposit_amount=round(total*0.5,2) and deposit_amount>0)),
 add constraint meetup_balance_receipt check(balance_received_at is null or deposit_amount is not null);
alter table public.orders drop constraint orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
 check(payment_status in ('pending','partially_paid','paid','failed','refunded'));

create or replace function public.validate_seller_payout_integrity()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_order record;
begin
 select seller_id,payment_transaction_id,total,deposit_amount into v_order from public.orders where id=new.order_id;
 if not found then raise exception 'Referenced order % does not exist.',new.order_id; end if;
 if v_order.seller_id<>new.seller_id then raise exception 'Payout seller does not match order seller.'; end if;
 if new.payment_transaction_id is not null and new.payment_transaction_id is distinct from v_order.payment_transaction_id then
  raise exception 'Payout payment transaction does not match order payment transaction.'; end if;
 if new.gross_amount is distinct from coalesce(v_order.deposit_amount,v_order.total) then
  raise exception 'Payout gross amount does not match funds collected by CircuitCart.'; end if;
 return new;
end $$;
revoke all on function public.validate_seller_payout_integrity() from public,anon,authenticated;

-- New offer mutations live in a non-exposed schema. Public wrappers are INVOKER.
create function private.send_chat_offer(p_conversation_id uuid,p_product_id uuid,p_quantity integer,p_unit_price numeric,p_expires_hours integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_c public.conversations; v_p public.products; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 -- Lock products before offers, matching checkout. Conversation identity is immutable.
 select * into v_p from public.products where id=p_product_id for share;
 select * into v_c from public.conversations where id=p_conversation_id;
 if v_c.id is null or v_c.seller_id is distinct from auth.uid() or v_c.order_id is not null
   or v_p.seller_id is distinct from v_c.seller_id or v_p.shop_id is distinct from v_c.shop_id
   or (v_c.product_id is not null and v_c.product_id<>p_product_id)
   or v_p.status is distinct from 'active' or not exists(select 1 from public.shops where id=v_p.shop_id and owner_id=auth.uid() and status='active') then
   raise exception 'Only this product seller can send an offer in this conversation.' using errcode='42501'; end if;
 if p_quantity is null or p_quantity not between 1 and 10000 or p_quantity>v_p.stock
   or p_unit_price is null or p_unit_price<=0 or p_unit_price>9999999999.99 or p_unit_price<>round(p_unit_price,2)
   or p_expires_hours is null or p_expires_hours not between 1 and 168 then raise exception 'Invalid offer price, quantity or expiry.'; end if;
 -- Serialize version replacement for this conversation/product without deleting history.
 perform pg_advisory_xact_lock(hashtextextended('offer:'||p_conversation_id::text||p_product_id::text,0));
 if exists(select 1 from public.chat_offers where conversation_id=p_conversation_id and product_id=p_product_id and status='reserved') then
   raise exception 'This offer is locked in an active checkout.'; end if;
 update public.chat_offers set status='withdrawn',updated_at=clock_timestamp()
  where conversation_id=p_conversation_id and product_id=p_product_id and status in ('pending','accepted');
 insert into public.chat_offers(conversation_id,buyer_id,seller_id,product_id,quantity,unit_price,expires_at)
 values(v_c.id,v_c.buyer_id,v_c.seller_id,v_p.id,p_quantity,p_unit_price,clock_timestamp()+make_interval(hours=>p_expires_hours)) returning id into v_id;
 insert into public.messages(conversation_id,sender_id,body) values(v_c.id,auth.uid(),'Private offer sent: '||p_quantity||' × ₱'||p_unit_price::text||'. Review the offer card to accept.');
 return v_id;
end $$;
create function public.send_chat_offer(p_conversation_id uuid,p_product_id uuid,p_quantity integer,p_unit_price numeric,p_expires_hours integer default 24)
returns uuid language sql security invoker set search_path='' as $$ select private.send_chat_offer(p_conversation_id,p_product_id,p_quantity,p_unit_price,p_expires_hours) $$;
revoke all on function private.send_chat_offer(uuid,uuid,integer,numeric,integer),public.send_chat_offer(uuid,uuid,integer,numeric,integer) from public,anon;
grant execute on function private.send_chat_offer(uuid,uuid,integer,numeric,integer),public.send_chat_offer(uuid,uuid,integer,numeric,integer) to authenticated;

create function private.respond_chat_offer(p_offer_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_o public.chat_offers; v_p public.products;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 select * into v_o from public.chat_offers where id=p_offer_id;
 if v_o.id is null or auth.uid() not in (v_o.buyer_id,v_o.seller_id) then raise exception 'Offer not accessible.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('accept','decline','withdraw') or
  (p_action='withdraw' and auth.uid()<>v_o.seller_id) or (p_action<>'withdraw' and auth.uid()<>v_o.buyer_id) then
  raise exception 'Offer action not permitted.' using errcode='42501'; end if;
 -- Same buyer lock as checkout; then cart, product and offer. No reverse lock order.
 perform pg_advisory_xact_lock(hashtextextended('online-checkout:'||v_o.buyer_id::text,0));
 perform id from public.cart_items where user_id=v_o.buyer_id and product_id=v_o.product_id for update;
 select * into v_p from public.products where id=v_o.product_id for share;
 select * into v_o from public.chat_offers where id=p_offer_id for update;
 if v_o.status='accepted' and p_action='accept' then
  if v_o.expires_at<=clock_timestamp() then raise exception 'Offer expired. Ask the seller for a new offer.'; end if;
 elsif v_o.status<>'pending' and not (p_action='withdraw' and v_o.status='accepted') then
  raise exception 'Offer is no longer available.';
 end if;
 if p_action='accept' then
  if v_o.expires_at<=clock_timestamp() or v_p.status<>'active' or v_p.stock<v_o.quantity
    or not exists(select 1 from public.shops where id=v_p.shop_id and owner_id=v_o.seller_id and status='active') then
   raise exception 'Offer expired or product unavailable.'; end if;
  update public.chat_offers set status='accepted',updated_at=clock_timestamp() where id=v_o.id;
  insert into public.cart_items(user_id,product_id,quantity,offer_id) values(v_o.buyer_id,v_o.product_id,v_o.quantity,v_o.id)
   on conflict(user_id,product_id) do update set quantity=excluded.quantity,offer_id=excluded.offer_id;
 else
  update public.chat_offers set status=case when p_action='withdraw' then 'withdrawn' else 'declined' end,updated_at=clock_timestamp() where id=v_o.id;
 end if;
 return true;
end $$;
create function public.respond_chat_offer(p_offer_id uuid,p_action text)
returns boolean language sql security invoker set search_path='' as $$ select private.respond_chat_offer(p_offer_id,p_action) $$;
revoke all on function private.respond_chat_offer(uuid,text),public.respond_chat_offer(uuid,text) from public,anon;
grant execute on function private.respond_chat_offer(uuid,text),public.respond_chat_offer(uuid,text) to authenticated;

-- This helper validates even a buyer-forged cart offer_id. It is internal only.
create function private.cart_unit_price(p_buyer uuid,p_product uuid,p_quantity integer,p_offer uuid)
returns numeric language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_o public.chat_offers; v_p public.products;
begin
 select * into strict v_p from public.products where id=p_product;
 if p_offer is null then return v_p.price; end if;
 select * into v_o from public.chat_offers where id=p_offer for update;
 if v_o.id is null or v_o.buyer_id<>p_buyer or v_o.product_id<>p_product or v_o.seller_id<>v_p.seller_id
   or v_o.quantity<>p_quantity or v_o.status<>'accepted' or v_o.expires_at<=clock_timestamp() then
  raise exception 'Private offer expired or changed. Return to chat and accept a valid offer.'; end if;
 return v_o.unit_price;
end $$;
revoke all on function private.cart_unit_price(uuid,uuid,integer,uuid) from public,anon,authenticated;

-- Freeze offer references in historical items and reserve them with the checkout.
create function private.reserve_order_offer() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_o public.orders;
begin
 if new.offer_id is null then return new; end if;
 select * into strict v_o from public.orders where id=new.order_id;
 if not exists(select 1 from public.chat_offers where id=new.offer_id and buyer_id=v_o.buyer_id and seller_id=v_o.seller_id
   and product_id=new.product_id and quantity=new.quantity and unit_price=new.unit_price and status='accepted' and expires_at>clock_timestamp()) then
  raise exception 'Offer snapshot is invalid.'; end if;
 update public.chat_offers set status=case when v_o.payment_transaction_id is null then 'consumed' else 'reserved' end,
  checkout_transaction_id=v_o.payment_transaction_id,updated_at=clock_timestamp() where id=new.offer_id;
 return new;
end $$;
revoke all on function private.reserve_order_offer() from public,anon,authenticated;
create trigger reserve_order_offer after insert on public.order_items for each row execute function private.reserve_order_offer();
create function private.settle_checkout_offers() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='paid' then
  update public.chat_offers set status='consumed',updated_at=clock_timestamp() where checkout_transaction_id=new.id and status='reserved';
 elsif new.inventory_released_at is not null then
  update public.chat_offers set status='accepted',checkout_transaction_id=null,updated_at=clock_timestamp() where checkout_transaction_id=new.id and status='reserved';
  -- Preserve a newer cart choice; restore only missing offer cart rows.
  insert into public.cart_items(user_id,product_id,quantity,offer_id)
  select new.buyer_id,i.product_id,i.quantity,i.offer_id from public.order_items i join public.orders o on o.id=i.order_id
  join public.chat_offers f on f.id=i.offer_id where o.payment_transaction_id=new.id and f.status='accepted' and f.expires_at>clock_timestamp()
  on conflict(user_id,product_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.settle_checkout_offers() from public,anon,authenticated;
create trigger settle_checkout_offers after update of status,inventory_released_at on public.payment_transactions
 for each row execute function private.settle_checkout_offers();


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
    select id, product_id, quantity, offer_id from public.cart_items
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

  perform f.id from public.chat_offers f join jsonb_to_recordset(v_cart) as c(offer_id uuid) on c.offer_id=f.id order by f.id for update of f;

  -- Match legacy pricing: shipping per shop = 150, free for meetup or subtotal >= 10000.
  select jsonb_agg(to_jsonb(g)), sum(case when p_delivery_method='meetup' then round(g.subtotal*0.5,2) else g.subtotal+g.shipping end) into v_groups, v_amount
  from (
    select p.seller_id, p.shop_id, sum(private.cart_unit_price(v_buyer,p.id,c.quantity,c.offer_id) * c.quantity) as subtotal,
      case when p_delivery_method = 'meetup' or sum(private.cart_unit_price(v_buyer,p.id,c.quantity,c.offer_id) * c.quantity) >= 10000
           then 0::numeric else 150::numeric end as shipping
    from jsonb_to_recordset(v_cart) as c(product_id uuid, quantity integer, offer_id uuid)
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
      deposit_amount, delivery_method, payment_method, payment_status, payment_transaction_id,
      payment_reference, shipping_name, shipping_phone, shipping_address, buyer_note
    ) values (
      v_buyer, v_group.seller_id, v_group.shop_id, 'pending', v_group.subtotal,
      v_group.shipping, v_group.subtotal + v_group.shipping,
      case when p_delivery_method='meetup' then round(v_group.subtotal*0.5,2) else null end,
      p_delivery_method, 'demo_card', 'pending', v_tx,
      v_reference,
      nullif(trim(p_shipping_name), ''), nullif(trim(p_shipping_phone), ''),
      nullif(trim(p_shipping_address), ''), nullif(trim(p_buyer_note), '')
    ) returning id into v_order;
    v_orders := array_append(v_orders, v_order);

    insert into public.order_items (order_id, product_id, product_title, product_image_path, unit_price, quantity, line_total, offer_id)
    select v_order, p.id, p.title,
      (select i.storage_path from public.product_images i where i.product_id = p.id order by i.sort_order, i.id limit 1),
      private.cart_unit_price(v_buyer,p.id,c.quantity,c.offer_id), c.quantity, private.cart_unit_price(v_buyer,p.id,c.quantity,c.offer_id) * c.quantity, c.offer_id
    from jsonb_to_recordset(v_cart) as c(product_id uuid, quantity integer, offer_id uuid)
    join public.products p on p.id = c.product_id
    where p.seller_id = v_group.seller_id and p.shop_id = v_group.shop_id;
  end loop;

  select count(*), sum(coalesce(o.deposit_amount,o.total)) into v_count, v_sum from public.orders o
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

create or replace function public.create_online_checkout(
  p_attempt_id uuid,
  p_delivery_method text,
  p_shipping_name text default null,
  p_shipping_phone text default null,
  p_shipping_address text default null,
  p_buyer_note text default null
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
begin
  if v_buyer is null then raise exception 'Authentication required for checkout.'; end if;
  if p_attempt_id is null then raise exception 'Checkout attempt is required.'; end if;

  -- Serialize this buyer's online attempts. A hash collision only adds waiting.
  perform pg_advisory_xact_lock(hashtextextended('online-checkout:' || v_buyer::text, 0));
  v_existing := public.recover_online_checkout(p_attempt_id);
  if v_existing is not null then return v_existing; end if;
  perform id from public.payment_transactions where buyer_id = v_buyer
    and checkout_attempt_id is not null and status in ('created', 'pending', 'authorized') for update;
  if exists (select 1 from public.payment_transactions where buyer_id = v_buyer
      and checkout_attempt_id is not null and status = 'created' and expires_at <= clock_timestamp()) then
    -- Recovery releases in a separate transaction before new reservations are taken.
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
    select id, product_id, quantity, offer_id from public.cart_items
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

  perform f.id from public.chat_offers f join jsonb_to_recordset(v_cart) as c(offer_id uuid) on c.offer_id=f.id order by f.id for update of f;

  -- Match legacy pricing: shipping per shop = 150, free for meetup or subtotal >= 10000.
  select jsonb_agg(to_jsonb(g)), sum(case when p_delivery_method='meetup' then round(g.subtotal*0.5,2) else g.subtotal+g.shipping end) into v_groups, v_amount
  from (
    select p.seller_id, p.shop_id, sum(private.cart_unit_price(v_buyer,p.id,c.quantity,c.offer_id) * c.quantity) as subtotal,
      case when p_delivery_method = 'meetup' or sum(private.cart_unit_price(v_buyer,p.id,c.quantity,c.offer_id) * c.quantity) >= 10000
           then 0::numeric else 150::numeric end as shipping
    from jsonb_to_recordset(v_cart) as c(product_id uuid, quantity integer, offer_id uuid)
    join public.products p on p.id = c.product_id
    group by p.seller_id, p.shop_id
  ) g;

  insert into public.payment_transactions (buyer_id, provider, currency, amount, status, checkout_attempt_id, expires_at)
  values (v_buyer, 'maya', 'PHP', v_amount, 'created', p_attempt_id, clock_timestamp() + interval '20 minutes') returning id into v_tx;

  for v_group in select * from jsonb_to_recordset(v_groups)
    as g(seller_id uuid, shop_id uuid, subtotal numeric, shipping numeric)
  loop
    insert into public.orders (
      buyer_id, seller_id, shop_id, status, subtotal, shipping_fee, total,
      deposit_amount, delivery_method, payment_method, payment_status, payment_transaction_id,
      shipping_name, shipping_phone, shipping_address, buyer_note
    ) values (
      v_buyer, v_group.seller_id, v_group.shop_id, 'pending', v_group.subtotal,
      v_group.shipping, v_group.subtotal + v_group.shipping,
      case when p_delivery_method='meetup' then round(v_group.subtotal*0.5,2) else null end,
      p_delivery_method, 'maya_online', 'pending', v_tx,
      nullif(trim(p_shipping_name), ''), nullif(trim(p_shipping_phone), ''),
      nullif(trim(p_shipping_address), ''), nullif(trim(p_buyer_note), '')
    ) returning id into v_order;
    v_orders := array_append(v_orders, v_order);

    insert into public.order_items (order_id, product_id, product_title, product_image_path, unit_price, quantity, line_total, offer_id)
    select v_order, p.id, p.title,
      (select i.storage_path from public.product_images i where i.product_id = p.id order by i.sort_order, i.id limit 1),
      private.cart_unit_price(v_buyer,p.id,c.quantity,c.offer_id), c.quantity, private.cart_unit_price(v_buyer,p.id,c.quantity,c.offer_id) * c.quantity, c.offer_id
    from jsonb_to_recordset(v_cart) as c(product_id uuid, quantity integer, offer_id uuid)
    join public.products p on p.id = c.product_id
    where p.seller_id = v_group.seller_id and p.shop_id = v_group.shop_id;
  end loop;

  select count(*), sum(coalesce(o.deposit_amount,o.total)) into v_count, v_sum from public.orders o
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

  -- No payouts, provider IDs, payment evidence or payment success in this stage.
  return public.get_online_checkout(p_attempt_id);
end;
$$;

create or replace function public.checkout_cart(
  p_delivery_method text,
  p_shipping_name text default null,
  p_shipping_phone text default null,
  p_shipping_address text default null,
  p_buyer_note text default null,
  p_payment_method text default null
)
returns table (order_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_cart_count integer;
  v_group record;
  v_item record;
  v_new_order_id uuid;
  v_group_subtotal numeric(12,2);
  v_group_shipping numeric(12,2);
  v_group_total numeric(12,2);
  v_primary_image text;
  v_payment_method text;
begin
  if p_delivery_method='meetup' then raise exception 'Meetup requires a 50 percent online downpayment.'; end if;
  -- 1. Identify authenticated buyer
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Authentication required for checkout.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('online-checkout:'||v_buyer_id::text,0));

  -- 2. Validate delivery inputs
  if p_delivery_method not in ('delivery', 'meetup') then
    raise exception 'Invalid delivery method "%"', p_delivery_method;
  end if;

  if p_delivery_method = 'delivery' then
    if p_shipping_name is null or trim(p_shipping_name) = '' then
      raise exception 'Shipping recipient name is required for delivery.';
    end if;
    if p_shipping_phone is null or trim(p_shipping_phone) = '' then
      raise exception 'Shipping phone number is required for delivery.';
    end if;
    if p_shipping_address is null or trim(p_shipping_address) = '' then
      raise exception 'Shipping address is required for delivery.';
    end if;
  end if;

  -- 3. Resolve & validate payment method (Backward-compatible defaulting)
  if p_payment_method is null or trim(p_payment_method) = '' then
    if p_delivery_method = 'meetup' then
      v_payment_method := 'cash_on_meetup';
    else
      v_payment_method := 'cash_on_delivery';
    end if;
  else
    v_payment_method := trim(p_payment_method);
    if v_payment_method not in ('cash_on_delivery', 'cash_on_meetup', 'manual_gcash', 'manual_maya') then
      raise exception 'Invalid payment method "%".', v_payment_method;
    end if;

    -- Strict compatibility between fulfillment method and payment method
    if p_delivery_method = 'meetup' and v_payment_method = 'cash_on_delivery' then
      raise exception 'Cash on Delivery is not valid for meetup fulfillment.';
    end if;

    if p_delivery_method = 'delivery' and v_payment_method = 'cash_on_meetup' then
      raise exception 'Cash on Meetup is not valid for delivery fulfillment.';
    end if;
  end if;

  -- 4. Check cart existence
  select count(*) into v_cart_count
  from public.cart_items
  where user_id = v_buyer_id;

  if v_cart_count = 0 then
    raise exception 'Your cart is empty.';
  end if;

  -- 5. Lock products involved in cart for update to prevent race conditions / overselling
  perform p.id
  from public.products p
  where p.id in (
    select c.product_id
    from public.cart_items c
    where c.user_id = v_buyer_id
  )
  for update of p;

  -- 6. Validate each product in cart against locked rows and enforce ACTIVE SHOP REQUIREMENT
  for v_item in (
    select
      c.id as cart_item_id,
      c.quantity as requested_qty,
      p.id as product_id,
      p.title as product_title,
      p.price as db_price,
      p.stock as current_stock,
      p.status as product_status,
      p.seller_id as product_seller_id,
      p.shop_id as product_shop_id,
      s.id as shop_exists_id,
      s.owner_id as shop_owner_id,
      s.status as shop_status
    from public.cart_items c
    join public.products p on p.id = c.product_id
    left join public.shops s on s.id = p.shop_id
    where c.user_id = v_buyer_id
  ) loop
    -- Non-self purchase check
    if v_item.product_seller_id = v_buyer_id then
      raise exception 'You cannot purchase your own listing ("%").', v_item.product_title;
    end if;

    -- Strict shop validation: must exist, have valid owner, and be 'active'
    if v_item.product_shop_id is null or v_item.shop_exists_id is null then
      raise exception 'Product "%" cannot be purchased because it does not belong to a valid shop.', v_item.product_title;
    end if;

    if v_item.shop_owner_id <> v_item.product_seller_id then
      raise exception 'Product "%" shop owner mismatch.', v_item.product_title;
    end if;

    if v_item.shop_status <> 'active' then
      raise exception 'Product "%" cannot be purchased because its shop is currently %.', v_item.product_title, coalesce(v_item.shop_status, 'inactive');
    end if;

    -- Product status and inventory checks
    if v_item.product_status <> 'active' then
      raise exception 'Product "%" is no longer available.', v_item.product_title;
    end if;

    if v_item.current_stock <= 0 then
      raise exception 'Product "%" is sold out.', v_item.product_title;
    end if;

    if v_item.requested_qty > v_item.current_stock then
      raise exception 'Only % units of "%" remain in stock.', v_item.current_stock, v_item.product_title;
    end if;
  end loop;

  perform f.id from public.chat_offers f join public.cart_items c on c.offer_id=f.id where c.user_id=v_buyer_id order by f.id for update of f;

  -- 7. Group cart by shop/seller and create separate orders
  for v_group in (
    select
      p.seller_id,
      p.shop_id,
      sum(private.cart_unit_price(v_buyer_id,p.id,c.quantity,c.offer_id) * c.quantity) as subtotal
    from public.cart_items c
    join public.products p on p.id = c.product_id
    where c.user_id = v_buyer_id
    group by p.seller_id, p.shop_id
  ) loop
    if v_group.shop_id is null then
      raise exception 'Cannot create order: missing shop identifier.';
    end if;

    v_group_subtotal := v_group.subtotal;

    -- Calculate shipping fee per shop (Free shipping if meetup or subtotal >= 10,000)
    if p_delivery_method = 'meetup' or v_group_subtotal >= 10000 then
      v_group_shipping := 0;
    else
      v_group_shipping := 150;
    end if;

    v_group_total := v_group_subtotal + v_group_shipping;

    -- Create order for this seller/shop with authoritative payment state
    insert into public.orders (
      buyer_id,
      shop_id,
      seller_id,
      status,
      subtotal,
      shipping_fee,
      total,
      delivery_method,
      payment_method,
      payment_status,
      payment_reference,
      shipping_name,
      shipping_phone,
      shipping_address,
      buyer_note
    ) values (
      v_buyer_id,
      v_group.shop_id,
      v_group.seller_id,
      'pending',
      v_group_subtotal,
      v_group_shipping,
      v_group_total,
      p_delivery_method,
      v_payment_method,
      'pending',
      null,
      p_shipping_name,
      p_shipping_phone,
      p_shipping_address,
      p_buyer_note
    ) returning id into v_new_order_id;

    -- Insert snapshot order items and decrement inventory
    for v_item in (
      select
        c.quantity,
        p.id as product_id,
        p.title,
        private.cart_unit_price(v_buyer_id,p.id,c.quantity,c.offer_id) as price,
        c.offer_id,
        p.stock
      from public.cart_items c
      join public.products p on p.id = c.product_id
      where c.user_id = v_buyer_id
        and p.seller_id = v_group.seller_id
        and p.shop_id = v_group.shop_id
    ) loop
      -- Fetch primary image for snapshot
      select storage_path into v_primary_image
      from public.product_images
      where product_id = v_item.product_id
      order by sort_order asc
      limit 1;

      -- Insert historical snapshot
      insert into public.order_items (
        order_id,
        product_id,
        product_title,
        product_image_path,
        unit_price,
        quantity,
        line_total,
        offer_id
      ) values (
        v_new_order_id,
        v_item.product_id,
        v_item.title,
        v_primary_image,
        v_item.price,
        v_item.quantity,
        (v_item.price * v_item.quantity),
        v_item.offer_id
      );

      -- Decrement inventory transactionally
      update public.products
      set
        stock = stock - v_item.quantity,
        status = case when (stock - v_item.quantity) <= 0 then 'sold_out' else status end
      where id = v_item.product_id;
    end loop;

    -- Return order ID to caller
    order_id := v_new_order_id;
    return next;
  end loop;

  -- 8. Delete purchased cart items for this buyer
  delete from public.cart_items
  where user_id = v_buyer_id;

  return;
end;
$$;

create or replace function public.finance_record_order() returns trigger
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
  if new.payment_method in ('demo_card','maya_online') and new.payment_status in ('paid','partially_paid') then
    select * into v_tx from public.payment_transactions where id=new.payment_transaction_id;
    if v_tx.status is distinct from 'paid' or v_tx.buyer_id is distinct from new.buyer_id then
      raise exception 'Verified parent payment required.';
    end if;
    if not exists(select 1 from public.seller_payouts where order_id=new.id) then
      select commission_rate_bps into strict v_rate from public.platform_settings where id = true;
      v_fee := round(new.subtotal*v_rate/10000,2);
      insert into public.platform_commissions(order_id,seller_id,shop_id,payment_transaction_id,payment_method,
        gross_amount,commission_base,commission_rate_bps,commission_amount,settlement_mode,collection_status,is_sandbox)
      values(new.id,new.seller_id,new.shop_id,new.payment_transaction_id,new.payment_method,new.total,new.subtotal,
        v_rate,v_fee,'platform_collected','collected',v_tx.sandbox or v_tx.provider in ('circuitcart_sandbox','maya'));
      insert into public.seller_payouts(order_id,seller_id,payment_transaction_id,gross_amount,commission_base,
        commission_rate_bps,platform_fee,net_amount,status)
      values(new.id,new.seller_id,new.payment_transaction_id,coalesce(new.deposit_amount,new.total),new.subtotal,v_rate,v_fee,coalesce(new.deposit_amount,new.total)-v_fee,'pending');
    end if;
    if new.status='completed' then
      update public.seller_payouts set status='eligible',eligible_at=coalesce(eligible_at,clock_timestamp())
      where order_id=new.id and status='pending';
    end if;
  elsif new.payment_method in ('cash_on_delivery','cash_on_meetup','manual_gcash','manual_maya')
      and new.status='completed' then
    -- Completion of seller-direct cash fulfillment is the authoritative collection event.
    select commission_rate_bps into strict v_rate from public.platform_settings where id = true;
    insert into public.platform_commissions(order_id,seller_id,shop_id,payment_method,gross_amount,
      commission_base,commission_rate_bps,commission_amount,settlement_mode,collection_status,is_sandbox)
    values(new.id,new.seller_id,new.shop_id,new.payment_method,new.total,new.subtotal,v_rate,
      round(new.subtotal*v_rate/10000,2),'seller_direct','receivable',false)
    on conflict(order_id) do nothing;
  end if;
  return new;
end $$;

create or replace function public.get_payment_financial_receipt(p_payment_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tx public.payment_transactions; v_ok boolean; v_ids uuid[];
begin
  select * into v_tx from public.payment_transactions where id=p_payment_transaction_id;
  if not found or (coalesce(auth.jwt()->>'role','') <> 'service_role' and
      (auth.uid() is null or v_tx.buyer_id is distinct from auth.uid())) then
    raise exception 'Payment not accessible.' using errcode='42501';
  end if;
  select array_agg(o.id order by o.id),
    count(*)>0 and sum(coalesce(o.deposit_amount,o.total))=v_tx.amount and bool_and(
      o.buyer_id=v_tx.buyer_id and o.payment_status in ('paid','partially_paid') and o.status in ('confirmed','preparing','ready','shipped','completed')
      and p.id is not null and c.id is not null and p.status not in ('cancelled','refunded')
      and p.payment_transaction_id=v_tx.id and p.seller_id=o.seller_id
      and p.gross_amount=coalesce(o.deposit_amount,o.total) and p.net_amount=p.gross_amount-p.platform_fee
      and c.payment_transaction_id=v_tx.id and c.seller_id=o.seller_id and c.shop_id=o.shop_id
      and c.gross_amount=o.total and c.commission_amount=p.platform_fee and c.collection_status='collected'
    ) into v_ids,v_ok
    from public.orders o left join public.seller_payouts p on p.order_id=o.id
    left join public.platform_commissions c on c.order_id=o.id where o.payment_transaction_id=v_tx.id;
  return jsonb_build_object('success',v_tx.status='paid' and coalesce(v_ok,false), 'status',v_tx.status,
    'paymentTransactionId',v_tx.id,'orderIds',coalesce(to_jsonb(v_ids),'[]'::jsonb));
end $$;

create or replace function public.confirm_online_payment(p_payment_transaction_id uuid,p_provider_payment_id text default null,
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
    or (select sum(coalesce(deposit_amount,total)) from public.orders where payment_transaction_id=v_tx.id) is distinct from v_tx.amount
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
  if not v_already then
    update public.payment_transactions set status='paid',paid_at=clock_timestamp(),
      provider_payment_id=coalesce(p_provider_payment_id,provider_payment_id),provider_checkout_id=coalesce(p_provider_checkout_id,provider_checkout_id),updated_at=clock_timestamp() where id=v_tx.id;
    update public.orders set payment_status=case when deposit_amount is null then 'paid' else 'partially_paid' end,
      status='confirmed',payment_reference=coalesce(p_receipt_number,p_provider_payment_id,p_provider_checkout_id,payment_reference),updated_at=clock_timestamp()
      where payment_transaction_id=v_tx.id;
    insert into public.notifications(user_id,type,title,message,link,entity_id)
    select seller_id,'order_new','Payment verified',case when deposit_amount is null then 'Order payment verified. Prepare the item.' else '50% meetup deposit verified. The remaining balance is paid directly at handover.' end,
      '/seller/orders?orderId='||id::text,id from public.orders where payment_transaction_id=v_tx.id;
    insert into public.notifications(user_id,type,title,message,link,entity_id)
    select buyer_id,'payment_confirmed',case when deposit_amount is null then 'Payment verified' else 'Meetup deposit verified' end,
      case when deposit_amount is null then 'Payment verified. View your order for fulfillment updates.' else '50% deposit verified. Pay the remaining balance to the seller at meetup.' end||case when v_tx.sandbox or v_tx.provider='circuitcart_sandbox' then ' Sandbox only; no real money was charged.' else '' end,
      '/marketplace/orders?orderId='||id::text,id from public.orders where payment_transaction_id=v_tx.id;
  end if;
  v_result:=public.get_payment_financial_receipt(v_tx.id);
  if (v_result->>'success')::boolean is distinct from true then raise exception 'Payment requires reconciliation.'; end if;
  return v_result || jsonb_build_object('alreadyPaid',v_already);
end $$;

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
           new.shop_id, new.subtotal, new.shipping_fee, new.total,new.deposit_amount)
       is distinct from
       row(old.payment_method, old.payment_transaction_id, old.buyer_id, old.seller_id,
           old.shop_id, old.subtotal, old.shipping_fee, old.total,old.deposit_amount) then
      raise exception 'Online checkout financial fields cannot be changed.';
    end if;
  end if;
  if new.payment_method in ('maya_online', 'demo_card') and new.status = 'cancelled'
     and (tg_op = 'INSERT' or old.status <> 'cancelled') and not exists (
       select 1 from public.payment_transactions t where t.id = new.payment_transaction_id
       and ((t.status in ('cancelled', 'expired') and t.inventory_released_at is null) or
          (new.deposit_refunded_at is not null and new.payment_status='refunded' and t.provider='circuitcart_sandbox' and t.sandbox and t.status='paid'))
     ) then
    raise exception 'Cancel the whole unpaid online checkout through its trusted lifecycle.';
  end if;
  if new.payment_method in ('maya_online', 'demo_card')
     and new.status not in ('pending', 'cancelled') then
    if new.payment_status not in ('paid','partially_paid') or not exists (
      select 1 from public.payment_transactions t
      where t.id = new.payment_transaction_id and t.buyer_id = new.buyer_id and t.status = 'paid'
    ) then
      raise exception 'Awaiting Payment: online orders cannot be fulfilled before verified payment.';
    end if;
  end if;
  if new.payment_status='partially_paid' and (new.deposit_amount is null or new.balance_received_at is not null) then
    raise exception 'Invalid partial-payment state.'; end if;
  if new.deposit_amount is not null and new.payment_status='paid' and new.balance_received_at is null then
    raise exception 'Seller must confirm the meetup balance first.'; end if;
  if new.deposit_amount is not null and new.status='completed' and (new.payment_status<>'paid' or new.balance_received_at is null) then
    raise exception 'Meetup balance must be received before completion.'; end if;
  return new;
end;
$$;

create or replace function public.buyer_confirm_order_received(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_buyer uuid := auth.uid();
begin
  if v_buyer is null then
    raise exception 'Authentication required.';
  end if;

  if p_order_id is null then
    raise exception 'Order is required.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  -- Ownership first: even an already-completed order must belong to the caller.
  if v_order.buyer_id is distinct from v_buyer then
    raise exception 'Order not found.';
  end if;

  -- Idempotent success for repeat confirmations by the same buyer.
  if v_order.status = 'completed' then
    return jsonb_build_object(
      'success', true,
      'alreadyCompleted', true,
      'orderId', v_order.id,
      'status', 'completed'
    );
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Cancelled orders cannot be completed.';
  end if;

  if v_order.payment_status = 'refunded' then
    raise exception 'Refunded orders cannot be completed.';
  end if;

  -- Online payments must be verified-paid before the buyer can complete.
  if v_order.payment_method in ('maya_online', 'demo_card')
     and v_order.payment_status not in ('paid', 'partially_paid') then
    raise exception 'Awaiting Payment: this order cannot be completed before verified payment.';
  end if;

  if v_order.deposit_amount is not null and v_order.balance_received_at is null then raise exception 'The seller must confirm the remaining meetup balance first.'; end if;

  -- Fulfillment gate per delivery method.
  if v_order.delivery_method = 'delivery' then
    if v_order.status is distinct from 'shipped' then
      raise exception 'Delivery orders can only be completed after they are shipped. Confirm receipt once the item arrives.';
    end if;
  elsif v_order.delivery_method = 'meetup' then
    if v_order.status is distinct from 'ready' then
      raise exception 'Meetup orders can only be completed after they are ready. Confirm the handover with the seller.';
    end if;
  else
    raise exception 'Unknown delivery method.';
  end if;

  update public.orders
  set status = 'completed',
      updated_at = clock_timestamp()
  where id = v_order.id;

  return jsonb_build_object(
    'success', true,
    'alreadyCompleted', false,
    'orderId', v_order.id,
    'status', 'completed'
  );
end;
$$;

create function private.confirm_meetup_balance(p_order_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_o public.orders; v_tx public.payment_transactions;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 select * into v_o from public.orders where id=p_order_id;
 if v_o.id is null or v_o.seller_id is distinct from auth.uid() then raise exception 'Order not accessible.' using errcode='42501'; end if;
 select * into v_tx from public.payment_transactions where id=v_o.payment_transaction_id for update;
 select * into v_o from public.orders where id=p_order_id for update;
 if v_o.deposit_amount is null or v_o.status not in ('ready','completed') or v_tx.status is distinct from 'paid'
   or v_o.payment_status not in ('partially_paid','paid') then raise exception 'A verified deposit and ready meetup order are required.'; end if;
 if v_o.balance_received_at is not null then return true; end if;
 update public.orders set balance_received_at=clock_timestamp(),payment_status='paid',updated_at=clock_timestamp() where id=v_o.id;
 insert into public.notifications(user_id,type,title,message,link,entity_id)
 values(v_o.buyer_id,'order_update','Meetup balance confirmed','The seller confirmed the remaining cash payment. Confirm receipt after inspecting and receiving your item.','/marketplace/orders?orderId='||v_o.id::text,v_o.id);
 return true;
end $$;
create function public.confirm_meetup_balance(p_order_id uuid)
returns boolean language sql security invoker set search_path='' as $$ select private.confirm_meetup_balance(p_order_id) $$;
revoke all on function private.confirm_meetup_balance(uuid),public.confirm_meetup_balance(uuid) from public,anon;
grant execute on function private.confirm_meetup_balance(uuid),public.confirm_meetup_balance(uuid) to authenticated;

-- Offer references and deposit/balance evidence cannot be changed via direct client writes.
revoke update on public.orders,public.order_items from authenticated,anon;
-- The existing trusted RPCs retain their own narrow ownership checks.

-- Sandbox-only paid-deposit refunds; never claim a gateway refund happened.
create function private.refund_meetup_deposit(p_order_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_o public.orders; v_tx public.payment_transactions;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 select * into v_o from public.orders where id=p_order_id;
 if v_o.id is null or auth.uid() not in (v_o.buyer_id,v_o.seller_id) then raise exception 'Order not accessible.' using errcode='42501'; end if;
 select * into v_tx from public.payment_transactions where id=v_o.payment_transaction_id for update;
 select * into v_o from public.orders where id=p_order_id for update;
 perform id from public.seller_payouts where order_id=v_o.id for update;
 if v_o.deposit_refunded_at is not null then return true; end if;
 if v_o.deposit_amount is null or v_tx.provider is distinct from 'circuitcart_sandbox' or v_tx.sandbox is distinct from true
   or v_tx.status is distinct from 'paid' or v_o.status not in ('confirmed','preparing','ready')
   or v_o.payment_status<>'partially_paid' or v_o.balance_received_at is not null
   or exists(select 1 from public.seller_payouts where order_id=v_o.id and status in ('processing','released')) then
   raise exception 'Only an uncompleted sandbox meetup deposit can be refunded here. Gateway payments require verified provider refund.'; end if;
 perform p.id from public.products p join public.order_items i on i.product_id=p.id where i.order_id=v_o.id order by p.id for update of p;
 update public.products p set stock=p.stock+r.quantity,status=case when p.status='sold_out' then 'active' else p.status end
  from (select product_id,sum(quantity)::integer quantity from public.order_items where order_id=v_o.id group by product_id) r where p.id=r.product_id;
 update public.orders set status='cancelled',payment_status='refunded',deposit_refunded_at=clock_timestamp(),updated_at=clock_timestamp() where id=v_o.id;
 insert into public.notifications(user_id,type,title,message,link,entity_id)
 values(v_o.buyer_id,'order_update','Meetup cancelled — simulated refund','Your sandbox deposit was reversed and the order cancelled. No real money was charged or transferred.','/marketplace/orders?orderId='||v_o.id::text,v_o.id);
 return true;
end $$;
create function public.refund_meetup_deposit(p_order_id uuid)
returns boolean language sql security invoker set search_path='' as $$ select private.refund_meetup_deposit(p_order_id) $$;
revoke all on function private.refund_meetup_deposit(uuid),public.refund_meetup_deposit(uuid) from public,anon;
grant execute on function private.refund_meetup_deposit(uuid),public.refund_meetup_deposit(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
