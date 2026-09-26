import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { onlineCheckoutAction, onlineCheckoutResult } from "@/lib/checkout/online-contract";

// Bound bytes while streaming, including requests without Content-Length.
const MAX_BODY_BYTES = 16 * 1024;
async function readBoundedJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  let length = 0;
  let body = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError(); }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { reader.releaseLock(); }
}

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : supabase;
}

function rpcError(code: string, message: string) {
  // Only known validation messages are public; never return raw database internals.
  const safeMessages = [
    "Your cart is empty.", "A product is no longer available. Refresh your cart.",
    "You cannot purchase your own listing.", "A product does not belong to an active, valid shop.",
    "Stock changed or quantity is invalid. Refresh your cart.", "A product price is invalid.",
    "Online checkout limit reached. Try again later.", "Online checkout supports up to 100 cart items.",
    "Reservation expired. Recover payment status before retrying.",
    "Checkout not found.", "Checkout cannot be cancelled without payment reconciliation.",
  ];
  if (code === "P0001" && safeMessages.includes(message)) return respond({ error: message }, 409);
  if (code === "42501" || code === "PGRST301") return respond({ error: "Your session expired. Sign in again." }, 401);
  return respond({ error: "Online checkout is unavailable. Check payment status before retrying; your attempt can be recovered." }, 503);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await authenticatedClient();
    if (!supabase) return respond({ error: "Sign in to view your payment status." }, 401);
    const attemptId = request.nextUrl.searchParams.get("attemptId");
    if ([...request.nextUrl.searchParams.keys()].some((key) => key !== "attemptId") || request.nextUrl.searchParams.getAll("attemptId").length > 1) {
      return respond({ error: "Invalid checkout query." }, 400);
    }
    if (attemptId !== null && !z.uuid().safeParse(attemptId).success) return respond({ error: "Invalid checkout attempt." }, 400);
    const { data, error } = await supabase.rpc("get_online_checkout", { p_attempt_id: attemptId });
    if (error) return rpcError(error.code, error.message);
    const result = onlineCheckoutResult.nullable().safeParse(data);
    if (!result.success) return respond({ error: "Unable to verify payment status. Please retry." }, 503);
    return respond({ checkout: result.data });
  } catch {
    return respond({ error: "Unable to load payment status. Check your connection and retry." }, 503);
  }
}

export async function POST(request: NextRequest) {
  // This deployment-controlled origin can be set for a trusted reverse proxy.
  const expectedOrigin = process.env.CHECKOUT_TRUSTED_ORIGIN || request.nextUrl.origin;
  if (request.headers.get("origin") !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    return respond({ error: "Invalid request origin." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return respond({ error: "Content-Type must be application/json." }, 415);
  }
  try {
    const supabase = await authenticatedClient();
    if (!supabase) return respond({ error: "Your session expired. Sign in again." }, 401);
    let body: unknown;
    try { body = await readBoundedJson(request); } catch (error) {
      return respond({ error: error instanceof RangeError ? "Checkout request is too large." : "Invalid checkout request." }, error instanceof RangeError ? 413 : 400);
    }
    const parsed = onlineCheckoutAction.safeParse(body);
    if (!parsed.success) return respond({ error: "Check your delivery details. Only checkout intent and fulfillment details are accepted." }, 400);
    const input = parsed.data;
    if ("action" in input) {
      if (input.action === "recover") {
        const cleanup = await supabase.rpc("expire_online_checkouts");
        if (cleanup.error) return rpcError(cleanup.error.code, cleanup.error.message);
      }
      const { data, error } = await supabase.rpc(
        input.action === "cancel" ? "cancel_online_checkout" : "recover_online_checkout",
        { p_attempt_id: input.attemptId || null },
      );
      if (error) return rpcError(error.code, error.message);
      const result = onlineCheckoutResult.nullable().safeParse(data);
      if (!result.success) return respond({ error: "Unable to verify payment status. Please retry." }, 503);
      return respond({ checkout: result.data });
    }
    // Creation only is gated. Recovery/cancellation work even after the preview is disabled.
    if (process.env.ONLINE_CHECKOUT_FOUNDATION_ENABLED !== "true") {
      return respond({ error: "Online checkout is not available yet. Choose an existing payment method." }, 503);
    }
    // Separate RPC transactions: cleanup locks must be released before taking new cart/product locks.
    const cleanup = await supabase.rpc("expire_online_checkouts");
    if (cleanup.error) return rpcError(cleanup.error.code, cleanup.error.message);
    const recovery = await supabase.rpc("recover_online_checkout", { p_attempt_id: null });
    if (recovery.error) return rpcError(recovery.error.code, recovery.error.message);
    const { data, error } = await supabase.rpc("create_online_checkout", {
      p_attempt_id: input.attemptId,
      p_delivery_method: input.deliveryMethod,
      p_shipping_name: input.shippingName || null,
      p_shipping_phone: input.shippingPhone || null,
      p_shipping_address: input.shippingAddress || null,
      p_buyer_note: input.buyerNote || null,
    });
    if (error) return rpcError(error.code, error.message);
    const result = onlineCheckoutResult.safeParse(data);
    if (!result.success) return respond({ error: "Checkout response could not be verified. Recover payment status before retrying." }, 503);
    return respond({ checkout: result.data });
  } catch {
    return respond({ error: "Connection interrupted. Check payment status or retry the same attempt; do not start another checkout." }, 503);
  }
}
