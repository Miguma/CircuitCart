import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a service-role Supabase client for authoritative webhook mutations.
 * confirm_online_payment and fail_online_payment are revoked from anon/authenticated
 * after the finance migration — service_role is required.
 * Returns null when the key is not configured so the caller can return a safe error.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getServiceRoleClient(): SupabaseClient<any, any, any> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    if (!payload) {
      return NextResponse.json({ error: "Empty or invalid JSON webhook payload." }, { status: 400 });
    }

    console.log("Maya Webhook received:", JSON.stringify(payload, null, 2));

    const checkoutId = payload.id || payload.checkoutId || payload.paymentTokenId;
    const paymentId = payload.paymentId || payload.receiptNumber || payload.transactionReferenceNumber || checkoutId;
    const receiptNumber = payload.receiptNumber || payload.transactionReferenceNumber;
    const requestReferenceNumber = payload.requestReferenceNumber;
    const status = (payload.paymentStatus || payload.status || "").toUpperCase();
    const isPaid = payload.isPaid === true || status === "PAYMENT_SUCCESS" || status === "COMPLETED";

    const supabase = getServiceRoleClient();
    if (!supabase) {
      console.error("Maya Webhook: SUPABASE_SERVICE_ROLE_KEY is not configured. Cannot process payment mutations.");
      return NextResponse.json({ error: "Server payment configuration error." }, { status: 500 });
    }

    // Look up parent payment_transaction by checkout ID or payment ID
    let paymentTransactionId: string | null = null;

    if (checkoutId) {
      const { data: tx } = await supabase
        .from("payment_transactions")
        .select("id, status, amount")
        .or(`provider_checkout_id.eq.${checkoutId},provider_payment_id.eq.${checkoutId}`)
        .maybeSingle();

      if (tx) {
        paymentTransactionId = tx.id;
      }
    }

    // Fallback search by order reference if transaction not found directly
    if (!paymentTransactionId && requestReferenceNumber) {
      // Extract UUID or prefix matching
      const cleanRef = requestReferenceNumber.replace(/^CC-/, "").toLowerCase();
      const { data: matchedOrder } = await supabase
        .from("orders")
        .select("payment_transaction_id")
        .ilike("id", `${cleanRef}%`)
        .maybeSingle();

      if (matchedOrder?.payment_transaction_id) {
        paymentTransactionId = matchedOrder.payment_transaction_id;
      }
    }

    if (!paymentTransactionId) {
      console.warn("Maya Webhook: Could not find matching payment transaction for reference:", {
        checkoutId,
        requestReferenceNumber,
      });
      // Return 200 to acknowledge webhook even if transaction was not local
      return NextResponse.json({ received: true, matched: false }, { status: 200 });
    }

    // Process payment status transition
    if (isPaid) {
      const { data: result, error: rpcErr } = await supabase.rpc("confirm_online_payment", {
        p_payment_transaction_id: paymentTransactionId,
        p_provider_payment_id: String(paymentId || checkoutId),
        p_provider_checkout_id: String(checkoutId || ""),
        p_receipt_number: receiptNumber ? String(receiptNumber) : null,
      });

      if (rpcErr) {
        console.error("Error executing confirm_online_payment RPC:", rpcErr);
        return NextResponse.json({ error: "Failed to confirm payment in database." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "confirmed",
        result,
      });
    } else if (status === "PAYMENT_FAILED" || status === "FAILED") {
      await supabase.rpc("fail_online_payment", {
        p_payment_transaction_id: paymentTransactionId,
        p_status: "failed",
      });

      return NextResponse.json({ success: true, action: "marked_failed" });
    } else if (status === "PAYMENT_CANCELLED" || status === "CANCELLED") {
      await supabase.rpc("fail_online_payment", {
        p_payment_transaction_id: paymentTransactionId,
        p_status: "cancelled",
      });

      return NextResponse.json({ success: true, action: "marked_cancelled" });
    } else if (status === "PAYMENT_EXPIRED" || status === "EXPIRED") {
      await supabase.rpc("fail_online_payment", {
        p_payment_transaction_id: paymentTransactionId,
        p_status: "expired",
      });

      return NextResponse.json({ success: true, action: "marked_expired" });
    }

    return NextResponse.json({ received: true, status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook handler exception";
    console.error("Maya Webhook Exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
