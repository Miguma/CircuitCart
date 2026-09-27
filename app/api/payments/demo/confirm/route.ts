import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { matchesFinancialReceipt } from "@/lib/finance/contracts";

/**
 * CircuitCart — Demo Card Sandbox Payment (ACADEMIC DEFENSE ONLY)
 *
 * Offline demo checkout. No real money is charged and no external gateway is
 * contacted. The client NEVER sends the full PAN, CVV, or expiry — only the
 * non-sensitive card_last4 reaches this endpoint.
 */

const demoConfirmSchema = z.object({
  attemptId: z.string().uuid().optional(),
  deliveryMethod: z.enum(["delivery", "meetup"]),
  shippingName: z.string().max(150).optional().nullable(),
  shippingPhone: z.string().max(50).optional().nullable(),
  shippingAddress: z.string().max(1000).optional().nullable(),
  buyerNote: z.string().max(1000).optional().nullable(),
  cardLast4: z.string().regex(/^\d{4}$/),
  simulateFailure: z.boolean().optional(),
}).strict();

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function rpcError(code: string, message: string) {
  const safeMessages = [
    "Your cart is empty.",
    "A product is no longer available. Refresh your cart.",
    "You cannot purchase your own listing.",
    "A product does not belong to an active, valid shop.",
    "Stock changed or quantity is invalid. Refresh your cart.",
    "A product price is invalid.",
    "Online checkout limit reached. Try again later.",
    "Online checkout supports up to 100 cart items.",
    "Reservation expired. Recover payment status before retrying.",
    "Recipient, phone and address are required for delivery.",
    "Checkout details exceed the allowed length.",
    "Demo card last4 digits are required.",
  ];
  if (code === "P0001" && safeMessages.includes(message)) {
    return jsonResponse({ error: message }, 409);
  }
  if (code === "42501" || code === "PGRST301") {
    return jsonResponse({ error: "Your session expired. Sign in again." }, 401);
  }
  return jsonResponse(
    { success: false, error: "Unable to verify payment. Check your orders before retrying; the checkout may need reconciliation." },
    503
  );
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }
  // Demo method must be explicitly enabled; otherwise it does not exist.
  if (process.env.NEXT_PUBLIC_DEMO_PAYMENT_ENABLED !== "true") {
    return jsonResponse({ error: "Demo payment is not available." }, 503);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized. Please log in to complete payment." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = demoConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: "Invalid demo payment request." }, 400);
    }
    const input = parsed.data;

    // Failure simulation is strictly development-only and never production.
    const simulateFailure =
      input.simulateFailure === true && process.env.NODE_ENV === "development";

    const attemptUuid = input.attemptId || crypto.randomUUID();

    // Settle any previous reservation before taking new cart/product locks.
    await supabase.rpc("expire_online_checkouts");
    await supabase.rpc("recover_online_checkout", { p_attempt_id: null });

    // 1. Server-authoritative reservation: validates cart + stock, creates the
    //    sandbox transaction + orders, decrements stock, clears the cart.
    const { data: checkoutRes, error: checkoutErr } = await supabase.rpc(
      "create_demo_checkout",
      {
        p_attempt_id: attemptUuid,
        p_delivery_method: input.deliveryMethod,
        p_shipping_name: input.shippingName?.trim() || null,
        p_shipping_phone: input.shippingPhone?.trim() || null,
        p_shipping_address: input.shippingAddress?.trim() || null,
        p_buyer_note: input.buyerNote?.trim() || null,
        p_card_last4: input.cardLast4,
      }
    );

    if (checkoutErr || !checkoutRes) {
      return rpcError(checkoutErr?.code || "", checkoutErr?.message || "");
    }

    const paymentTransactionId: string = checkoutRes.paymentTransactionId;
    const orderIds: string[] = Array.isArray(checkoutRes.orderIds) ? checkoutRes.orderIds : [];
    if (!z.uuid().safeParse(paymentTransactionId).success || !z.array(z.uuid()).min(1).safeParse(orderIds).success) {
      return rpcError("", "");
    }

    // Read the server-generated DEMO reference so confirmation evidence
    // carries it (never a UUID) into orders.payment_reference.
    const { data: pendingTx, error: pendingErr } = await supabase
      .from("payment_transactions")
      .select("transaction_reference, provider, sandbox, status")
      .eq("id", paymentTransactionId)
      .eq("buyer_id", user.id)
      .maybeSingle();
    if (pendingErr || !pendingTx || pendingTx.provider !== "circuitcart_sandbox" || pendingTx.sandbox !== true) {
      return rpcError("", "");
    }
    const demoReference: string | null =
      pendingTx?.transaction_reference || null;

    // 3a. Simulated failure: roll everything back — stock released, cart
    //     restored, orders cancelled, transaction marked failed. No paid
    //     record is ever created on this path.
    if (simulateFailure) {
      const { data: aborted, error: abortError } = await supabase.rpc("abort_failed_online_checkout", {
        p_payment_transaction_id: paymentTransactionId,
      });
      if (abortError || aborted !== true) return rpcError("", "");
      return jsonResponse({
        success: false,
        simulated: true,
        error:
          "Demo payment failed (simulated). No money was charged, stock was released, and your cart was restored.",
      });
    }

    // 3b. Confirm payment: marks transaction paid, orders paid + confirmed,
    //     creates seller payouts and buyer/seller notifications.
    const { data: confirmed, error: confirmErr } = await supabase.rpc("confirm_online_payment", {
      p_payment_transaction_id: paymentTransactionId,
      p_provider_payment_id: demoReference,
      p_provider_checkout_id: attemptUuid,
      p_receipt_number: demoReference,
    });

    if (confirmErr || !matchesFinancialReceipt(confirmed, paymentTransactionId, orderIds)) {
      // Never leave a stuck reservation: release stock and restore the cart.
      try {
        await supabase.rpc("abort_failed_online_checkout", {
          p_payment_transaction_id: paymentTransactionId,
        });
      } catch {
        /* Abort is best-effort; recovery endpoints can still settle. */
      }
      return rpcError(confirmErr?.code || "", confirmErr?.message || "");
    }

    // 4. Read back the buyer-owned sandbox record for the receipt.
    const { data: tx, error: txErr } = await supabase
      .from("payment_transactions")
      .select("id, amount, currency, status, transaction_reference, card_last4")
      .eq("id", paymentTransactionId)
      .eq("buyer_id", user.id)
      .maybeSingle();

    // A narrow ownership-checked RPC verifies all child orders, payouts and commissions.
    // Buyers do not receive SELECT access to seller financial accounts.
    const { data: receipt, error: receiptError } = await supabase.rpc("get_payment_financial_receipt", {
      p_payment_transaction_id: paymentTransactionId,
    });
    if (txErr || !tx || tx.status !== "paid" || receiptError ||
        !matchesFinancialReceipt(receipt, paymentTransactionId, orderIds)) return rpcError("", "");

    return jsonResponse({
      success: true,
      paymentStatus: "paid",
      sandbox: true,
      provider: "circuitcart_sandbox",
      paymentMethod: "demo_card",
      paymentTransactionId,
      orderIds,
      amount: Number(tx.amount),
      currency: "PHP",
      reference: tx.transaction_reference,
      cardLast4: tx.card_last4,
    });
  } catch {
    return jsonResponse(
      { success: false, error: "Payment could not be verified. Check your orders before retrying." },
      500
    );
  }
}
