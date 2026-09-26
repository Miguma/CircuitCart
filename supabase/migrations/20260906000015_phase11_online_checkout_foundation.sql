-- Step 5E.2: LOCAL ONLY. Audited reservation lifecycle; no provider integration.
-- Historical files and checkout_cart remain unchanged. Legacy cancellation/status
-- bodies are preserved as private helpers behind parent-first locking wrappers.
begin;

alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (
  payment_method in ('cash_on_delivery', 'cash_on_meetup', 'manual_gcash', 'manual_maya', 'maya_online')
);
alter table public.orders add constraint orders_online_transaction_required check (
  payment_method <> 'maya_online' or payment_transaction_id is not null
);

alter table public.payment_transactions add column checkout_attempt_id uuid;
alter table public.payment_transactions add column expires_at timestamptz;
alter table public.payment_transactions add column inventory_released_at timestamptz;
alter table public.payment_transactions add constraint online_reservation_expiry_required
  check (checkout_attempt_id is null or expires_at is not null);
alter table public.payment_transactions add constraint online_inventory_release_terminal
  check (inventory_released_at is null or (checkout_attempt_id is not null and status in ('expired', 'cancelled')));
create unique index idx_payment_transactions_checkout_attempt
  on public.payment_transactions (buyer_id, checkout_attempt_id)
  where checkout_attempt_id is not null;
-- One unresolved foundation checkout per buyer, even across tabs/different keys.
create unique index idx_payment_transactions_active_checkout
  on public.payment_transactions (buyer_id)
  where checkout_attempt_id is not null and status in ('created', 'pending', 'authorized');
create index idx_payment_transactions_reservation_expiry on public.payment_transactions(expires_at, id)
  where checkout_attempt_id is not null and status = 'created' and inventory_released_at is null;
create index idx_payment_transactions_buyer_attempts on public.payment_transactions(buyer_id, created_at)
  where checkout_attempt_id is not null;

-- Read under the caller's existing RLS; explicitly restrict even admin callers to self.
create function public.get_online_checkout(p_attempt_id uuid default null)
returns jsonb language sql stable security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'paymentTransactionId', t.id,
    'attemptId', t.checkout_attempt_id,
    'orderIds', (select coalesce(jsonb_agg(o.id order by o.id), '[]'::jsonb)
                 from public.orders o where o.payment_transaction_id = t.id and o.buyer_id = auth.uid()),
    'amount', t.amount::text,
    'currency', t.currency,
    'paymentStatus', t.status,
    'expiresAt', t.expires_at,
    'inventoryReleasedAt', t.inventory_released_at,
    'hasCancelledOrders', exists (select 1 from public.orders o
      where o.payment_transaction_id = t.id and o.status = 'cancelled')
  )
  from public.payment_transactions t
  where t.buyer_id = auth.uid() and t.checkout_attempt_id is not null
    and ((p_attempt_id is not null and t.checkout_attempt_id = p_attempt_id)
      or (p_attempt_id is null and t.status in ('created', 'pending', 'authorized')
          and (t.status <> 'created' or t.expires_at > statement_timestamp())))
  order by t.created_at desc, t.id limit 1;
$$;
revoke all on function public.get_online_checkout(uuid) from public, anon;
grant execute on function public.get_online_checkout(uuid) to authenticated;

-- This also protects existing seller/admin lifecycle RPCs without replacing them.
create function public.guard_online_order_fulfillment()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.payment_method = 'maya_online' then
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
  if new.payment_method = 'maya_online' and new.status = 'cancelled'
     and (tg_op = 'INSERT' or old.status <> 'cancelled') and not exists (
       select 1 from public.payment_transactions t where t.id = new.payment_transaction_id
       and t.status in ('cancelled', 'expired') and t.inventory_released_at is null
     ) then
    raise exception 'Cancel the whole unpaid online checkout through its trusted lifecycle.';
  end if;
  if new.payment_method = 'maya_online'
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
create trigger guard_online_order_fulfillment
  before insert or update on public.orders
  for each row execute function public.guard_online_order_fulfillment();

-- Internal only. Caller must authorize intent before invoking this helper.
-- Lock order: parent transaction -> child orders by id -> products by id.
-- There is no provider cancellation here: any provider evidence fails closed.
create function public.finish_unpaid_online_checkout(p_transaction_id uuid, p_terminal text)
returns boolean language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare v_tx public.payment_transactions;
begin
  if p_terminal is null or p_terminal not in ('expired', 'cancelled') then
    raise exception 'Invalid checkout terminal state.';
  end if;
  select * into v_tx from public.payment_transactions where id = p_transaction_id for update;
  if not found or v_tx.checkout_attempt_id is null then return false; end if;
  if v_tx.inventory_released_at is not null then return false; end if;
  if v_tx.status <> 'created' or v_tx.provider_checkout_id is not null
     or v_tx.provider_payment_id is not null or v_tx.authorized_at is not null or v_tx.paid_at is not null then
    return false;
  end if;
  if p_terminal = 'expired' and v_tx.expires_at > clock_timestamp() then return false; end if;
  perform id from public.orders where payment_transaction_id = v_tx.id order by id for update;
  if exists (select 1 from public.orders where payment_transaction_id = v_tx.id
             and (status not in ('pending', 'cancelled') or payment_status <> 'pending')) then
    raise exception 'Checkout needs payment reconciliation before stock can be released.';
  end if;
  perform p.id from public.products p where p.id in (
    select i.product_id from public.order_items i join public.orders o on o.id = i.order_id
    where o.payment_transaction_id = v_tx.id and o.status = 'pending'
  ) order by p.id for update;

  update public.payment_transactions set status = p_terminal where id = v_tx.id;
  -- Cancelled children have already been restored; only pending children contribute.
  update public.products p set stock = p.stock + restored.quantity,
    status = case when p.status = 'sold_out' then 'active' else p.status end
  from (
    select i.product_id, sum(i.quantity)::integer as quantity
    from public.order_items i join public.orders o on o.id = i.order_id
    where o.payment_transaction_id = v_tx.id and o.status = 'pending' and i.product_id is not null
    group by i.product_id
  ) restored where p.id = restored.product_id;
  update public.orders set status = 'cancelled'
    where payment_transaction_id = v_tx.id and status = 'pending';
  update public.payment_transactions set inventory_released_at = clock_timestamp() where id = v_tx.id;
  return true;
end;
$$;
revoke all on function public.finish_unpaid_online_checkout(uuid, text) from public, anon, authenticated;

-- Bounded opportunistic cleanup. Only database-due, never-provider-started
-- reservations can change. Returns no other buyer's identifiers or financial data.
-- One parent per transaction avoids batch lock inversions and keeps work bounded.
create function public.expire_online_checkouts()
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select id into v_id from public.payment_transactions
    where checkout_attempt_id is not null and status = 'created' and expires_at <= clock_timestamp()
      and inventory_released_at is null and provider_checkout_id is null and provider_payment_id is null
      and authorized_at is null and paid_at is null
    order by expires_at, id limit 1 for update skip locked;
  if v_id is null then return 0; end if;
  return case when public.finish_unpaid_online_checkout(v_id, 'expired') then 1 else 0 end;
end;
$$;
revoke all on function public.expire_online_checkouts() from public, anon;
grant execute on function public.expire_online_checkouts() to authenticated;

create function public.recover_online_checkout(p_attempt_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_id uuid; v_attempt uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('online-checkout:' || auth.uid()::text, 0));
  select id, checkout_attempt_id into v_id, v_attempt from public.payment_transactions
    where buyer_id = auth.uid() and checkout_attempt_id is not null
      and ((p_attempt_id is not null and checkout_attempt_id = p_attempt_id)
        or (p_attempt_id is null and status in ('created', 'pending', 'authorized')))
    order by created_at desc, id limit 1 for update;
  if v_id is null then return null; end if;
  perform public.finish_unpaid_online_checkout(v_id, 'expired');
  return public.get_online_checkout(v_attempt);
end;
$$;
revoke all on function public.recover_online_checkout(uuid) from public, anon;
grant execute on function public.recover_online_checkout(uuid) to authenticated;

create function public.cancel_online_checkout(p_attempt_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_tx public.payment_transactions;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_tx from public.payment_transactions
    where buyer_id = auth.uid() and checkout_attempt_id = p_attempt_id for update;
  if not found then raise exception 'Checkout not found.'; end if;
  if v_tx.inventory_released_at is null and not public.finish_unpaid_online_checkout(v_tx.id, 'cancelled') then
    raise exception 'Checkout cannot be cancelled without payment reconciliation.';
  end if;
  return public.get_online_checkout(p_attempt_id);
end;
$$;
revoke all on function public.cancel_online_checkout(uuid) from public, anon;
grant execute on function public.cancel_online_checkout(uuid) to authenticated;

-- Preserve legacy function bodies and signatures, but remove their public entry
-- points so online cancellation cannot take order locks before the parent lock.
alter function public.cancel_order(uuid, text) rename to checkout_cancel_order_legacy;
revoke all on function public.checkout_cancel_order_legacy(uuid, text) from public, anon, authenticated;
create function public.cancel_order(p_order_id uuid, p_reason text default null)
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
  if v_order.payment_method <> 'maya_online' then
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

alter function public.update_seller_order_status(uuid, text, text, text) rename to checkout_seller_status_legacy;
revoke all on function public.checkout_seller_status_legacy(uuid, text, text, text) from public, anon, authenticated;
create function public.update_seller_order_status(
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
  if v_order.payment_method = 'maya_online' then
    perform id from public.payment_transactions where id = v_order.payment_transaction_id for update;
    if p_new_status = 'cancelled' then return public.cancel_order(p_order_id); end if;
  end if;
  return public.checkout_seller_status_legacy(p_order_id, p_new_status, p_tracking_number, p_courier_name);
end;
$$;
revoke all on function public.update_seller_order_status(uuid, text, text, text) from public, anon;
grant execute on function public.update_seller_order_status(uuid, text, text, text) to authenticated;

-- No amount, buyer, cart snapshot, seller, status or provider-ID parameters.
-- Definer is needed for atomic writes to tables that intentionally deny client writes.
create function public.create_online_checkout(
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

  insert into public.payment_transactions (buyer_id, provider, currency, amount, status, checkout_attempt_id, expires_at)
  values (v_buyer, 'maya', 'PHP', v_amount, 'created', p_attempt_id, clock_timestamp() + interval '20 minutes') returning id into v_tx;

  for v_group in select * from jsonb_to_recordset(v_groups)
    as g(seller_id uuid, shop_id uuid, subtotal numeric, shipping numeric)
  loop
    insert into public.orders (
      buyer_id, seller_id, shop_id, status, subtotal, shipping_fee, total,
      delivery_method, payment_method, payment_status, payment_transaction_id,
      shipping_name, shipping_phone, shipping_address, buyer_note
    ) values (
      v_buyer, v_group.seller_id, v_group.shop_id, 'pending', v_group.subtotal,
      v_group.shipping, v_group.subtotal + v_group.shipping,
      p_delivery_method, 'maya_online', 'pending', v_tx,
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

  -- No payouts, provider IDs, payment evidence or payment success in this stage.
  return public.get_online_checkout(p_attempt_id);
end;
$$;
revoke all on function public.create_online_checkout(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_online_checkout(uuid, text, text, text, text, text) to authenticated;

commit;
