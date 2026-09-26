// No installs / no network. Test actual TS contracts, route handlers and payment-stage markup.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const requireModule = createRequire(import.meta.url);

function loadTs(file, mocks = {}) {
  const source = fs.readFileSync(path.resolve(file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", js)((id) => id in mocks ? mocks[id] : requireModule(id), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const contract = loadTs("lib/checkout/online-contract.ts");
const input = { attemptId: "40000000-0000-4000-8000-000000000001", paymentMethod: "maya_online", deliveryMethod: "meetup" };
const checkout = {
  paymentTransactionId: "50000000-0000-4000-8000-000000000001", attemptId: input.attemptId,
  orderIds: ["60000000-0000-4000-8000-000000000001"], amount: "10449.95", currency: "PHP",
  paymentStatus: "created", hasCancelledOrders: false,
  expiresAt: "2026-09-26T10:20:00+00:00", inventoryReleasedAt: null,
};
let signedIn = true;
let rpcError = null;
const calls = [];
const handlers = loadTs("app/api/checkout/online/route.ts", {
  "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
  "@/lib/checkout/online-contract": contract,
  "@/lib/supabase/server": { createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "buyer-from-session" } : null }, error: null }) },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: checkout, error: rpcError }; },
  }) },
});
function request(body, origin = "http://localhost:3000") {
  const req = new Request("http://localhost:3000/api/checkout/online", {
    method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  req.nextUrl = new URL(req.url);
  return req;
}

(async () => {
  process.env.ONLINE_CHECKOUT_FOUNDATION_ENABLED = "false";
  assert.equal((await handlers.POST(request(input))).status, 503);
  process.env.ONLINE_CHECKOUT_FOUNDATION_ENABLED = "true";
  assert.equal((await handlers.POST(request(input, "https://attacker.invalid"))).status, 403);
  signedIn = false;
  assert.equal((await handlers.POST(request(input))).status, 401);
  signedIn = true;
  for (const field of ["amount", "buyer_id", "buyerId", "user_id", "seller_id", "total", "subtotal", "shipping_fee", "price", "platform_fee", "transaction_status", "payment_status", "paymentStatus", "provider_checkout_id", "provider_payment_id", "payout_amount", "cart"]) {
    assert.equal((await handlers.POST(request({ ...input, [field]: "forged" }))).status, 400, field);
  }
  assert.equal(calls.length, 0, "rejected requests must not reach RPC");
  assert.equal((await handlers.POST(request({ ...input, deliveryMethod: "delivery" }))).status, 400);
  assert.equal((await handlers.POST(request({ ...input, buyerNote: "x".repeat(1001) }))).status, 400);
  assert.equal((await handlers.POST(request({ ...input, buyerNote: "x".repeat(17000) }))).status, 413);
  const malformed = request(input);
  const malformedRequest = new Request(malformed.url, { method: "POST", headers: malformed.headers, body: "{" });
  malformedRequest.nextUrl = malformed.nextUrl;
  assert.equal((await handlers.POST(malformedRequest)).status, 400);
  const noJson = request(input); noJson.headers.set("Content-Type", "text/plain");
  assert.equal((await handlers.POST(noJson)).status, 415);
  const noOrigin = request(input); noOrigin.headers.delete("origin");
  assert.equal((await handlers.POST(noOrigin)).status, 403);
  const crossSite = request(input); crossSite.headers.set("Sec-Fetch-Site", "cross-site");
  assert.equal((await handlers.POST(crossSite)).status, 403);
  for (const paymentMethod of ["manual_maya", "manual_gcash", "cash_on_delivery", "cash_on_meetup"]) {
    assert.equal((await handlers.POST(request({ ...input, paymentMethod }))).status, 400);
  }
  const response = await handlers.POST(request(input));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { checkout });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(calls.at(-1), { name: "create_online_checkout", args: {
    p_attempt_id: input.attemptId, p_delivery_method: "meetup", p_shipping_name: null,
    p_shipping_phone: null, p_shipping_address: null, p_buyer_note: null,
  } });
  rpcError = { code: "XX000", message: "private internal error details" };
  const failure = await handlers.POST(request(input));
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes("private internal"));
  rpcError = null;
  const getRequest = new Request(`http://localhost:3000/api/checkout/online?attemptId=${input.attemptId}`);
  getRequest.nextUrl = new URL(getRequest.url);
  assert.deepEqual(await (await handlers.GET(getRequest)).json(), { checkout });
  assert.deepEqual(calls.at(-1), { name: "get_online_checkout", args: { p_attempt_id: input.attemptId } });
  getRequest.nextUrl.searchParams.set("buyer_id", "victim");
  assert.equal((await handlers.GET(getRequest)).status, 400);
  getRequest.nextUrl.searchParams.delete("buyer_id");
  process.env.ONLINE_CHECKOUT_FOUNDATION_ENABLED = "false";
  assert.equal((await handlers.POST(request({ action: "recover", attemptId: input.attemptId }))).status, 200, "recovery available with creation disabled");
  assert.equal((await handlers.POST(request({ action: "cancel", attemptId: input.attemptId }))).status, 200, "cancellation available with creation disabled");
  assert.equal((await handlers.POST(request({ action: "cancel", attemptId: input.attemptId, amount: 1 }))).status, 400);
  signedIn = false;
  assert.equal((await handlers.GET(getRequest)).status, 401);

  const { OnlinePaymentStage } = loadTs("components/marketplace/online-payment-stage.tsx", {
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
  });
  const markup = renderToStaticMarkup(React.createElement(OnlinePaymentStage, { checkout }));
  assert.ok(markup.includes("Payment Required") && markup.includes("Awaiting Payment"));
  assert.ok(markup.includes("₱10,449.95"));
  assert.ok(markup.includes('disabled=""'));
  assert.ok(!markup.includes("Order Placed Successfully"));
  const cancelled = renderToStaticMarkup(React.createElement(OnlinePaymentStage, { checkout: { ...checkout, hasCancelledOrders: true } }));
  assert.ok(cancelled.includes("an order was cancelled"));
  const expired = renderToStaticMarkup(React.createElement(OnlinePaymentStage, { checkout: { ...checkout, paymentStatus: "expired", hasCancelledOrders: true, inventoryReleasedAt: "2026-09-26T10:21:00Z" } }));
  assert.ok(expired.includes("Reservation released") && !expired.includes("Payment Required"));
  const cartHelpers = loadTs("lib/supabase/cart.ts", {
    "./auth": { getCurrentUser: async () => ({ id: "test-buyer" }) },
    "./client": { createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({
      order: async () => ({ data: null, error: { message: "simulated connection failure" } }),
    }) }) }) }) },
    "@/lib/marketplace/product-adapter": {},
  });
  const originalWarn = console.warn;
  try {
    console.warn = () => {};
    await assert.rejects(cartHelpers.getCartItems({ throwOnError: true }), /displayed items have been kept/);
    assert.deepEqual(await cartHelpers.getCartItems(), [], "legacy read behavior unchanged");
  } finally { console.warn = originalWarn; }
  console.log("PASS: API auth, strict input, legacy separation, RPC parameters, recovery, safe errors, no-store, payment-stage rendering");
})().catch((error) => { console.error(error); process.exitCode = 1; });
