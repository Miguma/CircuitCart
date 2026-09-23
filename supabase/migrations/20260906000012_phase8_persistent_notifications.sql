-- CircuitCart — Phase 8: Persistent Notifications Backend Foundation
-- Date: 2026-09-06
-- Description:
-- 1. Create public.notifications table with strict foreign keys, check constraints, and indexes
-- 2. Add single source of truth read_at timestamptz (read_at is null = unread)
-- 3. Row Level Security: Authenticated SELECT only for own rows; direct REST INSERT/UPDATE/DELETE default-denied
-- 4. Secure read-mutation RPCs: mark_notification_read and mark_all_notifications_read
-- 5. Trusted order notification generation trigger on public.orders
-- 6. Trusted verification notification generation in review_seller_verification
-- 7. Trusted message notification generation with 15-minute anti-spam deduplication in handle_message_inserted
-- 8. Auto-mark message notifications read in mark_conversation_messages_read

-- ========================================================
-- 1. NOTIFICATIONS TABLE
-- ========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  entity_id uuid,
  read_at timestamptz default null,
  created_at timestamptz not null default now(),
  check (length(trim(title)) > 0 and length(title) <= 200),
  check (length(trim(message)) > 0 and length(message) <= 1000)
);

-- Indexes for efficient timeline, unread count, and message deduplication
create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_dedup
  on public.notifications(user_id, type, entity_id, created_at desc)
  where read_at is null;

-- ========================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ========================================================

alter table public.notifications enable row level security;

-- Authenticated users can view only their own notifications
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

-- Direct client INSERT, UPDATE, and DELETE are strictly disallowed via REST API.
-- Trusted creation occurs via database triggers and SECURITY DEFINER RPCs.
-- Read mutations occur via mark_notification_read and mark_all_notifications_read RPCs.

-- ========================================================
-- 3. SECURE READ-MUTATION RPCs
-- ========================================================

-- Mark a single notification as read
create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = v_user_id;

  return true;
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- Mark all unread notifications as read for current user
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = v_user_id
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ========================================================
-- 4. TRUSTED ORDER NOTIFICATIONS TRIGGER
-- ========================================================

create or replace function public.handle_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_ref text;
  v_actor_id uuid;
begin
  v_order_ref := 'CC-' || upper(substring(replace(new.id::text, '-', ''), 1, 8));
  v_actor_id := auth.uid();

  -- A. New order created with status 'pending'
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      entity_id,
      created_at
    ) values (
      new.seller_id,
      'order_new',
      'New Order Received',
      'You received new order ' || v_order_ref || ' totaling ₱' || to_char(new.total, 'FM999,999,999') || '.',
      '/seller/orders',
      new.id,
      now()
    );
    return new;
  end if;

  -- B. Order status changes on UPDATE
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    -- Order Confirmed
    if new.status = 'confirmed' then
      insert into public.notifications (
        user_id, type, title, message, link, entity_id, created_at
      ) values (
        new.buyer_id,
        'order_status',
        'Order Confirmed',
        'Seller confirmed order ' || v_order_ref || '. Preparation is underway.',
        '/marketplace/orders',
        new.id,
        now()
      );

    -- Order Preparing / Packed
    elsif new.status = 'preparing' then
      insert into public.notifications (
        user_id, type, title, message, link, entity_id, created_at
      ) values (
        new.buyer_id,
        'order_status',
        'Order Being Prepared',
        'Your items for order ' || v_order_ref || ' are being packed for fulfillment.',
        '/marketplace/orders',
        new.id,
        now()
      );

    -- Order Ready (Dispatch or Meetup)
    elsif new.status = 'ready' then
      insert into public.notifications (
        user_id, type, title, message, link, entity_id, created_at
      ) values (
        new.buyer_id,
        'order_status',
        case when new.delivery_method = 'meetup' then 'Ready for Meetup' else 'Ready for Dispatch' end,
        case when new.delivery_method = 'meetup'
          then 'Order ' || v_order_ref || ' is ready for scheduled meetup.'
          else 'Order ' || v_order_ref || ' is packaged and ready for courier pickup.'
        end,
        '/marketplace/orders',
        new.id,
        now()
      );

    -- Order Shipped
    elsif new.status = 'shipped' then
      insert into public.notifications (
        user_id, type, title, message, link, entity_id, created_at
      ) values (
        new.buyer_id,
        'order_status',
        'Order Shipped',
        'Order ' || v_order_ref || ' has been dispatched and is on the way.',
        '/marketplace/orders',
        new.id,
        now()
      );

    -- Order Completed
    elsif new.status = 'completed' then
      insert into public.notifications (
        user_id, type, title, message, link, entity_id, created_at
      ) values (
        new.buyer_id,
        'order_completed',
        'Order Completed',
        'Order ' || v_order_ref || ' has been completed. You can now leave a verified review!',
        '/marketplace/orders',
        new.id,
        now()
      );

    -- Order Cancelled: notify appropriate counterparty
    elsif new.status = 'cancelled' then
      if v_actor_id = new.buyer_id then
        -- Cancelled by buyer -> notify seller
        insert into public.notifications (
          user_id, type, title, message, link, entity_id, created_at
        ) values (
          new.seller_id,
          'order_cancelled',
          'Order Cancelled',
          'Buyer cancelled pending order ' || v_order_ref || '.',
          '/seller/orders',
          new.id,
          now()
        );
      else
        -- Cancelled by seller or system -> notify buyer
        insert into public.notifications (
          user_id, type, title, message, link, entity_id, created_at
        ) values (
          new.buyer_id,
          'order_cancelled',
          'Order Cancelled',
          'Order ' || v_order_ref || ' was cancelled.',
          '/marketplace/orders',
          new.id,
          now()
        );
      end if;
    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists trigger_order_notification on public.orders;
create trigger trigger_order_notification
  after insert or update on public.orders
  for each row
  execute function public.handle_order_notification();

revoke execute on function public.handle_order_notification() from public, anon, authenticated;

-- ========================================================
-- 5. TRUSTED SELLER VERIFICATION NOTIFICATIONS
-- ========================================================

create or replace function public.review_seller_verification(
  p_request_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.seller_verification_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_admin_role text;
  v_req public.seller_verification_requests;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null then
    raise exception 'Authentication required';
  end if;

  -- Verify admin role
  select role into v_admin_role from public.profiles where id = v_admin_id;
  if v_admin_role != 'admin' then
    raise exception 'Unauthorized: Only administrators can review seller verifications';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision. Must be approved or rejected';
  end if;

  if p_decision = 'rejected' and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'Rejection reason is required when rejecting a verification request';
  end if;

  -- Lock row FOR UPDATE
  select * into v_req
  from public.seller_verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Verification request not found';
  end if;

  if v_req.status != 'pending' then
    raise exception 'Verification request has already been reviewed (status: %)', v_req.status;
  end if;

  if p_decision = 'rejected' then
    update public.seller_verification_requests
    set
      status = 'rejected',
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      rejection_reason = trim(p_reason),
      updated_at = now()
    where id = p_request_id
    returning * into v_req;

    -- Notification to applicant: rejected
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      entity_id,
      created_at
    ) values (
      v_req.user_id,
      'verification_rejected',
      'Seller Verification Update',
      'Your seller application was not approved: ' || trim(p_reason),
      '/seller/verification',
      v_req.id,
      now()
    );

  elsif p_decision = 'approved' then
    update public.seller_verification_requests
    set
      status = 'approved',
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      rejection_reason = null,
      updated_at = now()
    where id = p_request_id
    returning * into v_req;

    -- Update applicant profile role to 'seller'
    update public.profiles
    set
      role = 'seller',
      updated_at = now()
    where id = v_req.user_id;

    -- If shop exists for user, mark is_verified = true
    update public.shops
    set
      is_verified = true,
      updated_at = now()
    where owner_id = v_req.user_id;

    -- Notification to applicant: approved
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      entity_id,
      created_at
    ) values (
      v_req.user_id,
      'verification_approved',
      'Seller Verification Approved',
      'Congratulations! Your seller verification has been approved. You can now publish listings on CircuitCart.',
      '/seller',
      v_req.id,
      now()
    );

  end if;

  return v_req;
end;
$$;

revoke execute on function public.review_seller_verification from public, anon;
grant execute on function public.review_seller_verification to authenticated;

-- ========================================================
-- 6. TRUSTED MESSAGE NOTIFICATIONS WITH ANTI-SPAM
-- ========================================================

create or replace function public.handle_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conv record;
  v_recipient_id uuid;
  v_sender_name text;
  v_snippet text;
  v_link text;
  v_existing_id uuid;
begin
  -- 1. Update conversation last_message_at
  update public.conversations
  set
    last_message_at = new.created_at,
    updated_at = now()
  where id = new.conversation_id;

  -- 2. Identify conversation participants
  select id, buyer_id, seller_id
  into v_conv
  from public.conversations
  where id = new.conversation_id;

  if not found then
    return new;
  end if;

  -- 3. Determine recipient (the counterparty)
  if new.sender_id = v_conv.buyer_id then
    v_recipient_id := v_conv.seller_id;
    v_link := '/seller/messages?conversationId=' || new.conversation_id::text;
  else
    v_recipient_id := v_conv.buyer_id;
    v_link := '/marketplace/messages?conversationId=' || new.conversation_id::text;
  end if;

  if v_recipient_id is null then
    return new;
  end if;

  -- 4. Get sender display name
  select coalesce(full_name, username, 'Someone')
  into v_sender_name
  from public.profiles
  where id = new.sender_id;

  v_snippet := substring(trim(new.body), 1, 100);
  if length(trim(new.body)) > 100 then
    v_snippet := v_snippet || '…';
  end if;

  -- 5. Anti-spam deduplication check:
  -- If an unread message notification already exists for this conversation in the last 15 minutes,
  -- update that notification instead of inserting a duplicate row.
  select id
  into v_existing_id
  from public.notifications
  where user_id = v_recipient_id
    and type = 'message'
    and entity_id = new.conversation_id
    and read_at is null
    and created_at > (now() - interval '15 minutes')
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    update public.notifications
    set
      title = 'New message from ' || coalesce(v_sender_name, 'a user'),
      message = v_snippet,
      link = v_link,
      created_at = now()
    where id = v_existing_id;
  else
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      entity_id,
      created_at
    ) values (
      v_recipient_id,
      'message',
      'New message from ' || coalesce(v_sender_name, 'a user'),
      v_snippet,
      v_link,
      new.conversation_id,
      now()
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_message_inserted() from public, anon, authenticated;

-- 7. Auto-mark message notification as read when conversation is marked read
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

  -- Automatically mark matching unread message notification as read
  update public.notifications
  set read_at = now()
  where user_id = v_user_id
    and type = 'message'
    and entity_id = p_conversation_id
    and read_at is null;

  return true;
end;
$$;

revoke execute on function public.mark_conversation_messages_read(uuid) from public, anon;
grant execute on function public.mark_conversation_messages_read(uuid) to authenticated;
