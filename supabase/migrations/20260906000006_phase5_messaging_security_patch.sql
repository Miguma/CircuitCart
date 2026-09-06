-- CircuitCart — Phase 5 Final Messaging Security Patch Migration
-- Date: 2026-09-06
-- Description:
-- 1. Removes direct client INSERT and UPDATE RLS policies on public.conversations (conversations created exclusively via trusted RPCs).
-- 2. Removes direct client UPDATE RLS policy on public.messages (read states managed exclusively via mark_conversation_messages_read RPC).
-- 3. Hardens get_or_create_product_conversation() to strictly require active product, valid non-null shop, matching shop owner, active shop status, and non-seller caller.
-- 4. Hardens get_or_create_shop_conversation() to strictly require active shop, valid owner, and non-owner caller.
-- 5. Re-asserts strict EXECUTE permissions (REVOKE from public & anon, GRANT to authenticated).

-- 1. Remove direct INSERT and UPDATE policies on public.conversations
drop policy if exists "Participants can insert their conversations" on public.conversations;
drop policy if exists "Participants can update their conversations" on public.conversations;

-- Re-assert select policy on conversations
drop policy if exists "Participants can view their conversations" on public.conversations;
create policy "Participants can view their conversations"
  on public.conversations
  for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());


-- 2. Remove direct UPDATE policy on public.messages
drop policy if exists "Recipients can mark messages as read" on public.messages;

-- Re-assert select and insert policies on messages
drop policy if exists "Conversation participants can view messages" on public.messages;
create policy "Conversation participants can view messages"
  on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

drop policy if exists "Conversation participants can insert their own messages" on public.messages;
create policy "Conversation participants can insert their own messages"
  on public.messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );


-- 3. Harden get_or_create_product_conversation RPC
create or replace function public.get_or_create_product_conversation(
  p_product_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_product record;
  v_shop record;
  v_conv_id uuid;
begin
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Authentication required.';
  end if;

  -- 1. Fetch product
  select id, seller_id, shop_id, status, title
  into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found.';
  end if;

  -- 2. Validate product status is active
  if v_product.status <> 'active' then
    raise exception 'This product listing is not currently active for messaging.';
  end if;

  -- 3. Validate seller is not messaging self
  if v_product.seller_id = v_buyer_id then
    raise exception 'You cannot start a conversation on your own listing.';
  end if;

  -- 4. Require non-null shop_id
  if v_product.shop_id is null then
    raise exception 'Product does not belong to a valid shop.';
  end if;

  -- 5. Fetch and validate matching shop
  select id, owner_id, status, name
  into v_shop
  from public.shops
  where id = v_product.shop_id;

  if not found then
    raise exception 'Product shop not found.';
  end if;

  -- 6. Validate shop ownership matches product seller
  if v_shop.owner_id <> v_product.seller_id then
    raise exception 'Shop owner mismatch for this product.';
  end if;

  -- 7. Validate shop is active (reject vacation / suspended)
  if v_shop.status <> 'active' then
    raise exception 'This shop is currently inactive or not accepting inquiries.';
  end if;

  -- 8. Look for existing product conversation
  select id into v_conv_id
  from public.conversations
  where buyer_id = v_buyer_id
    and seller_id = v_product.seller_id
    and product_id = p_product_id
    and order_id is null;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- 9. Create new conversation with conflict safety
  insert into public.conversations (
    buyer_id,
    seller_id,
    shop_id,
    product_id
  ) values (
    v_buyer_id,
    v_product.seller_id,
    v_product.shop_id,
    p_product_id
  )
  on conflict (buyer_id, seller_id, product_id)
    where product_id is not null and order_id is null
  do update set updated_at = now()
  returning id into v_conv_id;

  return v_conv_id;
end;
$$;


-- 4. Harden get_or_create_shop_conversation RPC
create or replace function public.get_or_create_shop_conversation(
  p_shop_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_shop record;
  v_conv_id uuid;
begin
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Authentication required.';
  end if;

  -- 1. Fetch shop
  select id, owner_id, status, name
  into v_shop
  from public.shops
  where id = p_shop_id;

  if not found then
    raise exception 'Shop not found.';
  end if;

  -- 2. Validate shop has valid owner
  if v_shop.owner_id is null then
    raise exception 'Shop has no registered owner.';
  end if;

  -- 3. Validate shop is active (reject vacation / suspended)
  if v_shop.status <> 'active' then
    raise exception 'This shop is currently inactive or not accepting inquiries.';
  end if;

  -- 4. Prevent shop owner messaging own shop
  if v_shop.owner_id = v_buyer_id then
    raise exception 'You cannot start a conversation with your own store.';
  end if;

  -- 5. Look for existing general shop conversation
  select id into v_conv_id
  from public.conversations
  where buyer_id = v_buyer_id
    and seller_id = v_shop.owner_id
    and shop_id = p_shop_id
    and product_id is null
    and order_id is null;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- 6. Create new shop conversation
  insert into public.conversations (
    buyer_id,
    seller_id,
    shop_id
  ) values (
    v_buyer_id,
    v_shop.owner_id,
    p_shop_id
  )
  on conflict (buyer_id, seller_id, shop_id)
    where product_id is null and order_id is null and shop_id is not null
  do update set updated_at = now()
  returning id into v_conv_id;

  return v_conv_id;
end;
$$;


-- 5. Maintain order conversation RPC
create or replace function public.get_or_create_order_conversation(
  p_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid;
  v_order record;
  v_conv_id uuid;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Authentication required.';
  end if;

  -- Fetch and validate order
  select id, buyer_id, seller_id, shop_id
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found.';
  end if;

  -- Caller must be buyer or seller of the order
  if v_order.buyer_id <> v_caller_id and v_order.seller_id <> v_caller_id then
    raise exception 'You are not a participant of this order.';
  end if;

  -- Look for existing order conversation
  select id into v_conv_id
  from public.conversations
  where order_id = p_order_id;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- Create new order conversation
  insert into public.conversations (
    buyer_id,
    seller_id,
    shop_id,
    order_id
  ) values (
    v_order.buyer_id,
    v_order.seller_id,
    v_order.shop_id,
    p_order_id
  )
  on conflict (order_id)
    where order_id is not null
  do update set updated_at = now()
  returning id into v_conv_id;

  return v_conv_id;
end;
$$;


-- 6. Maintain mark_conversation_messages_read RPC
create or replace function public.mark_conversation_messages_read(
  p_conversation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_conv record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  -- Verify user belongs to conversation
  select id, buyer_id, seller_id
  into v_conv
  from public.conversations
  where id = p_conversation_id;

  if not found then
    raise exception 'Conversation not found.';
  end if;

  if v_conv.buyer_id <> v_user_id and v_conv.seller_id <> v_user_id then
    raise exception 'You do not participate in this conversation.';
  end if;

  -- Mark messages sent by OTHER participant as read
  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> v_user_id
    and read_at is null;

  return true;
end;
$$;


-- 7. Explicit RPC Permissions
revoke execute on function public.get_or_create_product_conversation(uuid) from public;
revoke execute on function public.get_or_create_product_conversation(uuid) from anon;
grant execute on function public.get_or_create_product_conversation(uuid) to authenticated;

revoke execute on function public.get_or_create_order_conversation(uuid) from public;
revoke execute on function public.get_or_create_order_conversation(uuid) from anon;
grant execute on function public.get_or_create_order_conversation(uuid) to authenticated;

revoke execute on function public.get_or_create_shop_conversation(uuid) from public;
revoke execute on function public.get_or_create_shop_conversation(uuid) from anon;
grant execute on function public.get_or_create_shop_conversation(uuid) to authenticated;

revoke execute on function public.mark_conversation_messages_read(uuid) from public;
revoke execute on function public.mark_conversation_messages_read(uuid) from anon;
grant execute on function public.mark_conversation_messages_read(uuid) to authenticated;
