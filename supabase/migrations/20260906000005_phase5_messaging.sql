-- CircuitCart — Phase 5: Real Buyer ↔ Seller Messaging Migration
-- Date: 2026-09-06

-- 1. Create conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  last_message_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (product_id is not null or order_id is not null or shop_id is not null)
);

-- Unique indexes to prevent duplicate threads
create unique index if not exists idx_unique_buyer_seller_product
  on public.conversations(buyer_id, seller_id, product_id)
  where product_id is not null and order_id is null;

create unique index if not exists idx_unique_order_conversation
  on public.conversations(order_id)
  where order_id is not null;

create unique index if not exists idx_unique_buyer_seller_shop
  on public.conversations(buyer_id, seller_id, shop_id)
  where product_id is null and order_id is null and shop_id is not null;

-- General query indexes
create index if not exists idx_conversations_buyer_id on public.conversations(buyer_id);
create index if not exists idx_conversations_seller_id on public.conversations(seller_id);
create index if not exists idx_conversations_shop_id on public.conversations(shop_id);
create index if not exists idx_conversations_product_id on public.conversations(product_id);
create index if not exists idx_conversations_order_id on public.conversations(order_id);
create index if not exists idx_conversations_last_message_at on public.conversations(last_message_at desc);

-- Enable RLS on conversations
alter table public.conversations enable row level security;

-- Conversations RLS Policies
drop policy if exists "Participants can view their conversations" on public.conversations;
create policy "Participants can view their conversations"
  on public.conversations
  for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "Participants can insert their conversations" on public.conversations;
create policy "Participants can insert their conversations"
  on public.conversations
  for insert
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "Participants can update their conversations" on public.conversations;
create policy "Participants can update their conversations"
  on public.conversations
  for update
  using (buyer_id = auth.uid() or seller_id = auth.uid());


-- 2. Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (length(trim(body)) > 0 and length(body) <= 5000)
);

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at asc);

create index if not exists idx_messages_sender_id
  on public.messages(sender_id);

create index if not exists idx_messages_unread
  on public.messages(conversation_id, read_at)
  where read_at is null;

-- Enable RLS on messages
alter table public.messages enable row level security;

-- Messages RLS Policies
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

drop policy if exists "Recipients can mark messages as read" on public.messages;
create policy "Recipients can mark messages as read"
  on public.messages
  for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  )
  with check (
    sender_id <> auth.uid()
    and read_at is not null
  );


-- 3. Message triggers to update conversation timestamps
create or replace function public.handle_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
  set
    last_message_at = NEW.created_at,
    updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row
  execute function public.handle_message_inserted();


-- 4. Secure RPC Functions

-- A. Get or create conversation for a product
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
  v_conv_id uuid;
begin
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Authentication required.';
  end if;

  -- Fetch and validate product
  select id, seller_id, shop_id, status, title
  into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found.';
  end if;

  if v_product.seller_id = v_buyer_id then
    raise exception 'You cannot start a conversation on your own listing.';
  end if;

  -- Look for existing product conversation
  select id into v_conv_id
  from public.conversations
  where buyer_id = v_buyer_id
    and seller_id = v_product.seller_id
    and product_id = p_product_id
    and order_id is null;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- Create new conversation with conflict safety
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


-- B. Get or create conversation for an order
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


-- C. Get or create conversation for a shop
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

  -- Fetch and validate shop
  select id, owner_id, status, name
  into v_shop
  from public.shops
  where id = p_shop_id;

  if not found then
    raise exception 'Shop not found.';
  end if;

  if v_shop.owner_id = v_buyer_id then
    raise exception 'You cannot start a conversation with your own store.';
  end if;

  -- Look for existing general shop conversation
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

  -- Create new shop conversation
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


-- D. Mark incoming unread conversation messages as read
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


-- 5. Revoke from Public and grant to Authenticated
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

-- 6. Enable Realtime on messages
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
