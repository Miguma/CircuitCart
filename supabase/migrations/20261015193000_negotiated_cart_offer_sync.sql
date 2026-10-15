-- CircuitCart — Negotiated Private Offer Cart Sync & Integrity Guard
-- Ensures accepted seller-to-buyer private offers are reliably associated with cart items,
-- prevents normal Add to Cart, cart refreshes, or cart recreation from losing valid offers,
-- provides an explicit buyer-level dismissal mechanism to prevent unwanted offer reattachment,
-- and ensures expired/withdrawn offers cannot silently cause a buyer to pay a higher price without confirmation.

begin;

-- 1. Explicit buyer-level dismissal registry
create table if not exists public.cart_offer_dismissals (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null references public.chat_offers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  dismissed_at timestamptz not null default clock_timestamp(),
  constraint cart_offer_dismissals_buyer_offer_uniq unique(buyer_id, offer_id)
);

create index if not exists cart_offer_dismissals_lookup_idx
  on public.cart_offer_dismissals(buyer_id, product_id);

alter table public.cart_offer_dismissals enable row level security;
revoke all on public.cart_offer_dismissals from public, anon;
grant select, insert, delete on public.cart_offer_dismissals to authenticated, service_role;

drop policy if exists cart_offer_dismissals_buyer_policy on public.cart_offer_dismissals;
create policy cart_offer_dismissals_buyer_policy on public.cart_offer_dismissals
  for all to authenticated
  using (buyer_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()));

-- 2. Explicit buyer dismissal RPC
create or replace function public.dismiss_cart_offer(
  p_product_id uuid,
  p_offer_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer uuid := auth.uid();
  v_target_offer_id uuid := p_offer_id;
begin
  if v_buyer is null then
    raise exception 'Authentication required.';
  end if;

  -- If offer_id is not passed, find the offer currently associated or latest offer for this buyer & product
  if v_target_offer_id is null then
    select offer_id into v_target_offer_id
    from public.cart_items
    where user_id = v_buyer and product_id = p_product_id;
  end if;

  if v_target_offer_id is null then
    select id into v_target_offer_id
    from public.chat_offers
    where buyer_id = v_buyer and product_id = p_product_id
    order by created_at desc
    limit 1;
  end if;

  if v_target_offer_id is not null then
    insert into public.cart_offer_dismissals(buyer_id, offer_id, product_id)
    values (v_buyer, v_target_offer_id, p_product_id)
    on conflict (buyer_id, offer_id) do update set dismissed_at = clock_timestamp();
  end if;

  -- Clear offer_id from the cart item so buyer can proceed at standard catalog price
  update public.cart_items
  set offer_id = null
  where user_id = v_buyer and product_id = p_product_id;

  return true;
end;
$$;

revoke all on function public.dismiss_cart_offer(uuid, uuid) from public;
grant execute on function public.dismiss_cart_offer(uuid, uuid) to authenticated, service_role, anon;

-- 3. Function to synchronize cart_items with active accepted chat_offers
create or replace function public.sync_cart_item_offer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer public.chat_offers;
  v_active_offer public.chat_offers;
  v_is_dismissed boolean;
begin
  -- Scenario A: An offer_id was explicitly provided or already attached
  if new.offer_id is not null then
    select * into v_offer from public.chat_offers where id = new.offer_id;

    -- Check if buyer explicitly dismissed this offer
    select exists (
      select 1 from public.cart_offer_dismissals
      where buyer_id = new.user_id and offer_id = new.offer_id
    ) into v_is_dismissed;

    if v_is_dismissed then
      -- Explicitly dismissed by buyer: leave offer_id null and do not reattach
      new.offer_id := null;
    elsif v_offer.id is null
       or v_offer.buyer_id <> new.user_id
       or v_offer.product_id <> new.product_id then
      -- Mismatched or non-existent offer
      new.offer_id := null;
    elsif v_offer.status <> 'accepted' or v_offer.expires_at <= clock_timestamp() then
      -- Expired or withdrawn: Keep offer_id intact until the buyer explicitly confirms
      -- proceeding at the catalog price (via dismiss_cart_offer).
      -- Keeping offer_id ensures server-authoritative checkout (private.cart_unit_price)
      -- will STOP checkout and abort payment initialization if unconfirmed.
      null;
    else
      -- Offer is valid: lock cart quantity strictly to the negotiated agreement quantity
      new.quantity := v_offer.quantity;
    end if;
  end if;

  -- Scenario B: No offer_id is currently attached (or was cleared above)
  if new.offer_id is null then
    -- Check if the buyer has an active, accepted, unexpired private offer for this product
    -- that has NOT been explicitly dismissed
    select * into v_active_offer
    from public.chat_offers o
    where o.buyer_id = new.user_id
      and o.product_id = new.product_id
      and o.status = 'accepted'
      and o.expires_at > clock_timestamp()
      and not exists (
        select 1 from public.cart_offer_dismissals d
        where d.buyer_id = new.user_id and d.offer_id = o.id
      )
    order by o.created_at desc
    limit 1;

    if v_active_offer.id is not null then
      -- Automatically attach the valid accepted private offer and lock quantity
      new.offer_id := v_active_offer.id;
      new.quantity := v_active_offer.quantity;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.sync_cart_item_offer() is
  'Automatically binds active accepted chat offers to cart items, respects explicit buyer dismissals, and stops checkout if unconfirmed expired offers exist.';

-- 4. Attach trigger to public.cart_items
drop trigger if exists trg_sync_cart_item_offer on public.cart_items;
create trigger trg_sync_cart_item_offer
  before insert or update on public.cart_items
  for each row
  execute function public.sync_cart_item_offer();

-- 5. Update respond_chat_offer to manage dismissals and cart items
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

    -- Clear any past dismissal record for this offer so the newly accepted offer binds cleanly
    delete from public.cart_offer_dismissals
    where buyer_id = v_o.buyer_id and offer_id = v_o.id;

    insert into public.cart_items (user_id, product_id, quantity, offer_id)
    values (v_o.buyer_id, v_o.product_id, v_o.quantity, v_o.id)
    on conflict (user_id, product_id)
    do update set quantity = excluded.quantity, offer_id = excluded.offer_id;
  else
    update public.chat_offers
    set status = case when p_action = 'withdraw' then 'withdrawn' else 'declined' end,
        updated_at = clock_timestamp()
    where id = v_o.id;

    -- Keep offer_id intact so checkout RPC (private.cart_unit_price) prevents unconfirmed checkout,
    -- or if buyer explicitly dismisses, dismiss_cart_offer clears it.
  end if;

  return true;
end $$;

revoke all on function public.respond_chat_offer(uuid, text) from public;
grant execute on function public.respond_chat_offer(uuid, text) to authenticated, service_role, anon;

commit;
