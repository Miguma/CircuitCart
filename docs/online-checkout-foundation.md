# Step 5E.2 — audited local foundation, not a payment integration

Status: migration 000015 is for review only. Do not deploy automatically. No live database changes, provider requests, service-role credentials, webhook, refund, payout release, commit or push are part of this step.

## Authority and flow

1. Existing `cash_on_delivery`, `cash_on_meetup`, `manual_gcash`, and `manual_maya` keep using migration 000013's unchanged `checkout_cart`.
2. `maya_online` is separate. Cart UI sends only an attempt UUID, payment choice and fulfillment details to `POST /api/checkout/online`. The strict request schema rejects additional properties.
3. The route validates same-origin requests, rejects cross-site fetches, bounds streamed JSON bodies to 16 KiB, and verifies the cookie session using `auth.getUser()`. It uses the existing user-scoped Supabase server client, never a service-role key. Invalid JSON, unsupported media types and unexpected schema fields are rejected without database writes.
4. `create_online_checkout` derives buyer identity from `auth.uid()`. Definer rights are needed for the atomic writes prohibited to clients. Its search path is fixed, and only authenticated callers can execute it.
5. The database serializes attempts per buyer, snapshots and locks cart rows, locks products in ID order, and locks the relevant shops. Price, stock, seller, shop and quantity come from those rows, not the browser.
6. Shipping matches legacy checkout: per shop, zero for meetup or subtotal >= PHP 10,000; otherwise PHP 150. NUMERIC arithmetic creates a parent transaction and one order per seller/shop. Shops have unique owners in the existing schema.
7. Exactly the created order IDs must belong to the buyer and their totals must sum to the parent amount. Orders/items, stock decrement and deletion of only the captured cart rows are one transaction. Any failure rolls everything back, including existing notification triggers.
8. The initial parent status is `created`; child payment and order statuses are `pending`. Provider IDs and evidence timestamps stay NULL. No payout rows are created.
9. The UI receives amount as decimal text and displays **Payment Required / Awaiting Payment**, with a disabled payment button. It never runs the legacy success modal/toast for online checkout.

## Retry and recovery rules

- Unique `(buyer_id, checkout_attempt_id)` plus a buyer-scoped transaction advisory lock protects simultaneous same-key retries.
- At most one unresolved foundation checkout per buyer (`created`, `pending`, `authorized`). A different key returns only that active checkout without consuming a newly added cart. A due reservation must be released before a new attempt; the API performs cleanup and recovery as separate RPC transactions before creation. A direct creation RPC call with a different key receives a recovery-required error when its active reservation is overdue, never a historical terminal transaction.
- Same-key replay returns the original result, including terminal status, regardless of changed request details. To start a genuinely new attempt after a terminal result requires a new key. The recovery UI clears the stored terminal key.
- Only the UUID is stored locally, namespaced by user. No address, credentials or amounts are stored in the recovery record.
- `GET /api/checkout/online` is strictly read-only and uses invoker `get_online_checkout` with existing RLS plus `auth.uid()`. The browser uses POST `{action: "recover", attemptId?}` because recovery may expire a due reservation. `recover_online_checkout` derives the buyer, expires only their selected due checkout, and returns their data. Exact-key recovery may show terminal history; active-only reads exclude terminal/due-created records. All responses are private/no-store.
- A failed POST is ambiguous (the database may have committed before the network failed). The UI retains the cart and key, blocks further submit until status recovery, and offers **Recover payment status**. Refreshing cart during online recovery preserves local items on a fetch error.
- Terminal checkouts show released inventory and clear the local attempt key. No payment action is enabled. Cancelled rows, amounts and snapshots remain as history; cancellation does not automatically refill the cart.

## Reservation lifecycle (20 minutes)

- `expires_at` is set by SQL to creation time plus 20 minutes: enough for a short pre-defense checkout without indefinite stock holds. Legacy financial rows may keep NULL expiry.
- `finish_unpaid_online_checkout` is an internal invoker helper with no client execute rights. Authorized wrappers acquire the parent lock first, then child orders by ID and products by ID. It only releases `created` transactions with **no** provider IDs/evidence timestamps and with pending/unpaid children.
- It atomically cancels all pending child orders, restores their product quantities, marks the parent `cancelled`/`expired`, and records `inventory_released_at`. The parent lock, terminal-state checks and release marker make repeated cancellation/expiry no-ops. Cancelled orders cannot be reopened. Restock only reactivates `sold_out` products; archived products stay archived.
- Buyer `cancel_online_checkout(attemptId)` is strictly buyer-scoped. Existing `cancel_order` and seller status RPC signatures remain unchanged, with online-aware wrappers. Cancelling one unpaid online seller order cancels the **whole checkout**, including other seller orders. Both buyer and seller confirmation prompts explain this. Legacy functions retain their original bodies under renamed, non-client-callable helpers; historical migration files are untouched.
- `expire_online_checkouts()` is an authenticated, bounded cleanup RPC: it releases at most one database-due, eligible reservation using SKIP LOCKED, takes no buyer/amount/status parameters, and returns only 0/1. Any authenticated caller can help expire an overdue reservation, never cancel a fresh or provider-started reservation owned by somebody else. The API runs it before creation and recovery in a separate transaction.
- An open payment-stage screen recovers its checkout when its deadline arrives. Closed/idle browsers rely on the next online checkout/recovery activity or an explicit cleanup RPC call. **There is no scheduler and no promise that physical restoration occurs at exactly minute 20 without traffic.** Cleanup is bounded to avoid introducing a job system or holding many reservation locks at once.
- Direct creation RPC callers get the same one-active-checkout rule, a limit of **3 new attempts per buyer per rolling hour**, and at most **100 distinct cart rows** per attempt. Retries/recovery do not consume another attempt. This is a minimal per-account control, not complete multi-account abuse protection.
- Future payment processing MUST lock the parent first, revalidate that the reservation remains open/unreleased, then lock orders/products in the same order. Existing `pending`/`authorized`/`paid`/other non-created parents and any provider evidence are never blindly expired/cancelled here; they require future provider reconciliation. The release constraint also prevents transitioning a released parent into a payable state.

## Fulfillment and financial access

- Seller list/detail mark unpaid online orders **Awaiting Payment**. Fulfillment buttons are disabled; cancellation of a pending order remains available.
- A database trigger also rejects advancement beyond pending/cancelled unless the order is paid AND its matching parent transaction is paid. Online lifecycle wrappers lock the parent before legacy order locking; fulfillment safety is not just a frontend button.
- Online order buyer/seller/shop, monetary fields, payment method and parent linkage cannot be edited after creation. Migration 000014's buyer linkage and payout integrity guards remain in place.
- No new financial table mutation grants or RLS policies. All RPCs revoke PUBLIC/anon execute; authenticated execute is limited to create/get/recover/cancel/expire and the two existing-signature lifecycle wrappers. Internal release/trigger functions and preserved legacy helpers revoke authenticated execute too. Every definer has fixed `search_path = public, pg_temp`; no new dynamic SQL.
- Payout creation is deferred to later verified-payment processing. No escrow claims are made.

## Feature switches and limits

Both switches default off and were NOT enabled in `.env.local`:

- `NEXT_PUBLIC_ONLINE_CHECKOUT_FOUNDATION_ENABLED=true`: show the explicit foundation preview option. Requires rebuilding client assets.
- `ONLINE_CHECKOUT_FOUNDATION_ENABLED=true`: allow creation through the server route.

Use these only in a controlled test environment AFTER migration review and authorized deployment. Existing checkout remains usable with both off. GET and POST recovery/cancellation remain available to authenticated users even if creation is later disabled. `CHECKOUT_TRUSTED_ORIGIN` may specify a deployment-controlled canonical origin behind a reverse proxy; otherwise requests must match the Next request origin.

**The switches are UI/API release controls, not database authorization.** After deployment, an authenticated caller can call the granted RPC directly. Financial validation, per-account limits and reservation lifecycle checks therefore live in SQL.

Before real provider integration/public availability:

- Security-review and separately authorize migration deployment; regenerate/check live schema types and run staging/browser acceptance tests.
- Decide whether unattended cleanup needs a small scheduled sweeper before increasing traffic; add monitoring and stronger multi-account abuse controls. Current cleanup is opportunistic, not a production scheduling guarantee.
- Implement provider session idempotency and reconciliation for timeouts. Re-read and lock exact child orders, validate lifecycle eligibility and re-check their NUMERIC sum immediately before creating a provider session.
- Add server-side Maya credential management, verified webhook/return handling, amount/currency/order-set verification, and replay-safe payment transitions. No browser status or return URL is payment evidence.
- Design cancellation/payment races, refunds and payout creation separately. Do not release funds just because an order is completed.
- Verify same-origin validation behind the intended reverse proxy/host configuration.

## Local verification

No packages are installed. Test schema uses local PostgreSQL 18 with small Supabase auth/storage shims. It loads the repository schema and all migrations through 000015, including notification triggers. These checks are not a substitute for testing hosted Supabase Auth/PostgREST or a real browser journey after authorized deployment.

Fresh **disposable local database only**, configured at `127.0.0.1:55432` with test owner `postgres`:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -h 127.0.0.1 -p 55432 -U postgres -d postgres -f tests/online-checkout/bootstrap.sql
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -h 127.0.0.1 -p 55432 -U postgres -d postgres -f tests/online-checkout/security.sql
node tests/online-checkout/concurrency.mjs
node tests/online-checkout/api.test.mjs
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

`bootstrap.sql` creates test-only roles/schemas and must not run against an existing or live project. `security.sql` rolls back all fixtures. `concurrency.mjs` requires an empty test auth table, pins the loopback connection, and removes its exact fixture rows afterward. `api.test.mjs` runs actual TS request schemas, mocked route dependencies and server-rendered payment-stage markup without network access.

Coverage: unauthorized creation, forged financial parameters, empty cart, invalid delivery, stock and availability changes, active-shop validation, forced late failure rollback, decimal/multi-seller sums, NULL provider evidence, same/different-key recovery, cross-buyer reads/links, direct financial writes, seller fulfillment rejection, cancellation detection, four legacy methods, concurrent same-key requests, and two buyers racing for the last unit.

Step 5E.2 adds expired/terminal recovery isolation, same-key independence across buyers, exactly-once release, forced restoration rollback, concurrent expiry, buyer/seller cancellation versus expiry, rate limits, revoked legacy-helper execution, catalog privilege/search-path checks, pending-provider-state refusal, bounded API bodies and mutation-capable recovery/cancel actions. Paid/authorized-state refusal is additionally reviewed through the explicit `status = created` allowlist; no fake successful provider payment is manufactured for the test.

Migration 000014 was preserved byte-for-byte (SHA-256 `42F80420920F7F4314566E27C365F2BF196B4A8B8BAFA6BB9AEE3B29F465432E`). Historical migrations 000008/11/12/13 were not edited. Supabase CLI was unavailable; the new file follows the inspected sequence and the filename specified in the request; no CLI/package was installed.
