-- CircuitCart research delivery-duration export.
-- Values derive only from recorded order placement and first confirmed receipt.
-- Historical completed orders with no observed completion timestamp remain NULL.
-- No fake/backfilled dates; no changes to payment, checkout, or fulfillment logic.
begin;

alter table public.orders
  add column if not exists delivery_time numeric(12,6)
  generated always as (
    case
      when status = 'completed'
        and completed_at is not null
        and completed_at >= created_at
      then round(extract(epoch from (completed_at - created_at)) / 86400.0, 6)
      else null
    end
  ) stored;

comment on column public.orders.delivery_time is
  'Elapsed decimal days from order creation to first buyer-confirmed receipt. NULL for uncompleted orders, invalid timestamps and legacy completions without recorded completed_at. Applies to delivery and meetup handovers.';

-- Canonical seven-column research export. No PII, identifiers for buyers or sellers,
-- shipping details, or payment references are included.
-- security_invoker means the caller must have SELECT on orders and passes its RLS.
create view public.research_order_delivery
  with (security_invoker = true)
as
select
  o.id as order_id,
  o.total as total_amount,
  o.delivery_method,
  o.status as order_status,
  o.created_at as order_placed_at,
  case when o.status = 'completed' then o.completed_at else null end as delivered_at,
  o.delivery_time
from public.orders o;

comment on view public.research_order_delivery is
  'RLS-respecting, PII-minimized source for authorized research export; apply period and test/demo exclusion filters during authorized export.';

revoke all on public.research_order_delivery from public, anon;
grant select on public.research_order_delivery to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
