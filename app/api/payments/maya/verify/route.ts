import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMayaSandboxCheckoutDetails } from "@/lib/payments/maya";
import { formatOrderReference } from "@/lib/supabase/orders";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get("orderId");
    const txId = searchParams.get("txId");
    const checkoutId = searchParams.get("checkoutId");

    if (!orderId && !txId && !checkoutId) {
      return NextResponse.json({ error: "Missing order, transaction, or checkout identifier." }, { status: 400 });
    }

    // 1. Fetch from Supabase
    let query = supabase
      .from("orders")
      .select(`
        id,
        buyer_id,
        seller_id,
        total,
        status,
        payment_method,
        payment_status,
        payment_reference,
        payment_transaction_id,
        created_at,
        order_items (
          product_title,
          quantity,
          unit_price,
          line_total
        ),
        payment_transactions:payment_transaction_id (
          id,
          status,
          amount,
          provider_checkout_id,
          provider_payment_id,
          paid_at
        )
      `)
      .eq("buyer_id", user.id);

    if (orderId) {
      query = query.eq("id", orderId);
    } else if (txId) {
      query = query.eq("payment_transaction_id", txId);
    }

    const { data: orders, error: dbErr } = await query;
    if (dbErr || !orders || orders.length === 0) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const firstOrder = orders[0];
    const parentTxId = firstOrder.payment_transaction_id;
    // Extract payment transaction details if present
    const txData = Array.isArray(firstOrder.payment_transactions)
      ? firstOrder.payment_transactions[0]
      : firstOrder.payment_transactions;

    const mayaCheckoutId =
      checkoutId ||
      txData?.provider_checkout_id ||
      firstOrder.payment_reference;

    let isPaid = firstOrder.payment_status === "paid" || txData?.status === "paid";
    let mayaStatus = isPaid ? "PAYMENT_SUCCESS" : "PENDING";
    let receiptNumber = firstOrder.payment_reference || txData?.provider_payment_id;

    // 2. If not already marked paid in DB, attempt active verification with Maya Sandbox API
    if (!isPaid && mayaCheckoutId && process.env.MAYA_SECRET_KEY && process.env.MAYA_SECRET_KEY !== "YOUR_MAYA_SANDBOX_SECRET_KEY") {
      try {
        const mayaDetails = await getMayaSandboxCheckoutDetails(mayaCheckoutId);
        mayaStatus = mayaDetails.paymentStatus;
        receiptNumber = mayaDetails.receiptNumber || mayaDetails.id;

        if (mayaDetails.paymentStatus === "PAYMENT_SUCCESS" || mayaDetails.status === "COMPLETED") {
          // Authoritatively confirm payment in Supabase
          if (parentTxId) {
            await supabase.rpc("confirm_online_payment", {
              p_payment_transaction_id: parentTxId,
              p_provider_payment_id: String(mayaDetails.id || mayaCheckoutId),
              p_provider_checkout_id: String(mayaCheckoutId),
              p_receipt_number: receiptNumber ? String(receiptNumber) : null,
            });
            isPaid = true;
          }
        } else if (mayaDetails.paymentStatus === "PAYMENT_FAILED" || mayaDetails.status === "FAILED") {
          if (parentTxId) {
            await supabase.rpc("fail_online_payment", {
              p_payment_transaction_id: parentTxId,
              p_status: "failed",
            });
          }
        } else if (mayaDetails.paymentStatus === "PAYMENT_CANCELLED" || mayaDetails.status === "CANCELLED") {
          if (parentTxId) {
            await supabase.rpc("fail_online_payment", {
              p_payment_transaction_id: parentTxId,
              p_status: "cancelled",
            });
          }
        }
      } catch (mayaErr) {
        console.warn("Could not actively poll Maya API (waiting for webhook or user):", mayaErr);
      }
    }

    const totalAmount = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const orderReference = formatOrderReference(firstOrder.id);

    return NextResponse.json({
      success: true,
      isPaid,
      paymentStatus: isPaid ? "paid" : firstOrder.payment_status,
      orderStatus: isPaid ? "confirmed" : firstOrder.status,
      mayaStatus,
      receiptNumber,
      orderReference,
      orderId: firstOrder.id,
      ordersCount: orders.length,
      totalAmount,
      orders: orders.map((o) => ({
        id: o.id,
        orderReference: formatOrderReference(o.id),
        total: Number(o.total),
        status: isPaid ? "confirmed" : o.status,
        paymentStatus: isPaid ? "paid" : o.payment_status,
        items: o.order_items || [],
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
