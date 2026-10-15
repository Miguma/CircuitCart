-- CircuitCart — Negotiated Private Offer Cart Sync & Integrity Guard
-- Ensures accepted seller-to-buyer private offers are reliably associated with cart items
-- and prevents normal Add to Cart, cart refreshes, or cart recreation from losing valid offers.

begin;

-- 1. Function to synchronize cart_items with active accepted chat_offers
create or replace function public.sync_cart_item_offer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer public.chat_offers;
  v_active_offer public.chat_offers;
begin
  -- Scenario A: An offer_id was explicitly provided or already attached
  if new.offer_id is not null then
    select * into v_offer from public.chat_offers where id = new.offer_id;

    -- Validate offer integrity: must match buyer, product, be accepted, and not expired
    if v_offer.id is null
       or v_offer.buyer_id <> new.user_id
       or v_offer.product_id <> new.product_id
       or v_offer.status <> 'accepted'
       or v_offer.expires_at <= clock_timestamp() then
      -- The offer is expired, withdrawn, or invalid for this buyer/product.
      -- Revert offer_id to NULL so the cart item safely returns to standard listing price
      -- without failing subsequent checkout RPC validations.
      new.offer_id := null;
    else
      -- Offer is valid: lock cart quantity strictly to the negotiated agreement quantity
      new.quantity := v_offer.quantity;
    end if;
  end if;

  -- Scenario B: No offer_id is currently attached (or was cleared above)
  if new.offer_id is null then
    -- Check if the buyer has an active, accepted, unexpired private offer for this product
    select * into v_active_offer
    from public.chat_offers
    where buyer_id = new.user_id
      and product_id = new.product_id
      and status = 'accepted'
      and expires_at > clock_timestamp()
    order by created_at desc
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
  'Automatically binds active accepted chat offers to cart items and clears expired/withdrawn offer references.';

-- 2. Attach trigger to public.cart_items
drop trigger if exists trg_sync_cart_item_offer on public.cart_items;
create trigger trg_sync_cart_item_offer
  before insert or update on public.cart_items
  for each row
  execute function public.sync_cart_item_offer();

-- 3. Update respond_chat_offer to clear cart offer_id on withdraw or decline
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

    -- Clear offer_id on matching cart item so item reverts to standard listing price
    update public.cart_items
    set offer_id = null
    where user_id = v_o.buyer_id and product_id = v_o.product_id and offer_id = v_o.id;
  end if;

  return true;
end $$;

revoke all on function public.respond_chat_offer(uuid, text) from public;
grant execute on function public.respond_chat_offer(uuid, text) to authenticated, service_role, anon;

commit;
