-- ============================================================================
-- CIRCUITCART MIGRATION: BUYER CONFIRMS RECEIPT (SELLER STOPS AT SHIPPED)
-- Date: 2026-09-28
--
-- The buyer — not the seller — completes an order by confirming receipt:
--   Delivery: Paid → Confirmed → Preparing/Packed → Ready → Shipped
--             → (buyer confirms) Completed → payout pending → eligible
--   Meetup:   Paid/Cash → Confirmed → Packed → Ready for Meetup
--             → (buyer confirms handover) Completed
--
-- 1. New SECURITY DEFINER RPC buyer_confirm_order_received(p_order_id):
--    buyer-owned, status-gated, payment-gated completion. Existing triggers
--    (finance_record_order converts pending → eligible on completion;
--    guard_online_order_fulfillment; order notifications) are preserved and
--    do the payout/finance work — this migration never touches
--    seller_payouts directly.
-- 2. Harden update_seller_order_status: the wrapper already guarantees the
--    caller is the order's seller, so seller-initiated 'completed' is now
--    rejected for every payment method. Completion belongs to the buyer RPC.
-- ============================================================================

begin;

-- ============================================================================
-- 1. BUYER CONFIRM ORDER RECEIVED
-- ============================================================================

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
     and v_order.payment_status is distinct from 'paid' then
    raise exception 'Awaiting Payment: this order cannot be completed before verified payment.';
  end if;

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

revoke all on function public.buyer_confirm_order_received(uuid) from public, anon;
grant execute on function public.buyer_confirm_order_received(uuid) to authenticated;

-- ============================================================================
-- 2. SELLER STATUS WRAPPER: REJECT SELLER-INITIATED COMPLETION
-- ============================================================================
-- The ownership check below already guarantees the caller is the seller, so
-- any p_new_status = 'completed' here is seller-initiated and must be
-- rejected. Buyers complete via buyer_confirm_order_received. All other
-- behavior (cancel path, legacy delegation, grants) is unchanged.
-- ============================================================================

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
  if p_new_status = 'completed' then
    raise exception 'Only the buyer can confirm receipt and complete an order.';
  end if;
  if v_order.payment_method in ('maya_online', 'demo_card') then
    perform id from public.payment_transactions where id = v_order.payment_transaction_id for update;
    if p_new_status = 'cancelled' then return public.cancel_order(p_order_id); end if;
  end if;
  return public.checkout_seller_status_legacy(p_order_id, p_new_status, p_tracking_number, p_courier_name);
end;
$$;
revoke all on function public.update_seller_order_status(uuid, text, text, text) from public, anon;
grant execute on function public.update_seller_order_status(uuid, text, text, text) to authenticated;

commit;
