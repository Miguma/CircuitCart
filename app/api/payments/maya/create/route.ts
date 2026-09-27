import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createMayaSandboxCheckout,
  CreateMayaCheckoutPayload,
} from "@/lib/payments/maya";
import { formatOrderReference } from "@/lib/supabase/orders";

const createMayaSchema = z.object({
  orderId: z.string().uuid().optional(),
  attemptId: z.string().uuid().optional(),
  deliveryMethod: z.enum(["delivery", "meetup"]).optional(),
  shippingName: z.string().max(150).optional().nullable(),
  shippingPhone: z.string().max(50).optional().nullable(),
  shippingAddress: z.string().max(1000).optional().nullable(),
  buyerNote: z.string().max(1000).optional().nullable(),
});

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
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
    const parseResult = createMayaSchema.safeParse(body);
    if (!parseResult.success) {
      return jsonResponse({ error: "Invalid checkout request details.", details: parseResult.error.format() }, 400);
    }

    const input = parseResult.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || "http://localhost:3000";

    // Pre-flight check: validate Maya Sandbox configuration BEFORE mutating database or reserving inventory
    const configuredPublicKey = process.env.MAYA_PUBLIC_KEY;
    if (!configuredPublicKey || configuredPublicKey === "YOUR_MAYA_SANDBOX_PUBLIC_KEY" || configuredPublicKey.trim() === "") {
      return jsonResponse(
        {
          error: "Online payment is temporarily unavailable. Please choose another payment method or try again later.",
          recoveryRequired: false,
        },
        503
      );
    }

    let paymentTransactionId: string | null = null;
    let orderId: string | null = null;
    let totalAmount = 0;
    let itemsList: { name: string; quantity: number; price: number }[] = [];
    let ordersWithItemsData: { order_items: { product_id: string | null; quantity: number }[] | null }[] | null = null;
    let shippingFee = 0;
    let subtotal = 0;
    let recipientName = input.shippingName || user.user_metadata?.full_name || "CircuitCart Buyer";
    let recipientPhone = input.shippingPhone || user.phone || "+63 900 000 0000";
    let deliveryAddress = input.shippingAddress || "Cebu City, Central Visayas";
    let activeAttemptUuid: string | null = null;

    // Scenario A: Direct Order ID provided
    if (input.orderId) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select(`
          id,
          buyer_id,
          total,
          subtotal,
          shipping_fee,
          payment_status,
          payment_transaction_id,
          shipping_name,
          shipping_phone,
          shipping_address,
          order_items (
            product_title,
            quantity,
            unit_price
          )
        `)
        .eq("id", input.orderId)
        .eq("buyer_id", user.id)
        .maybeSingle();

      if (orderErr || !order) {
        return jsonResponse({ error: "Order not found or access denied." }, 404);
      }

      if (order.payment_status === "paid") {
        return jsonResponse({ error: "This order has already been paid." }, 400);
      }

      orderId = order.id;
      paymentTransactionId = order.payment_transaction_id;
      totalAmount = Number(order.total);
      subtotal = Number(order.subtotal);
      shippingFee = Number(order.shipping_fee);
      recipientName = order.shipping_name || recipientName;
      recipientPhone = order.shipping_phone || recipientPhone;
      deliveryAddress = order.shipping_address || deliveryAddress;

      itemsList = (order.order_items || []).map((it) => ({
        name: it.product_title,
        quantity: it.quantity,
        price: Number(it.unit_price),
      }));
    } else {
      // Scenario B: Checkout from Cart
      const attemptUuid = input.attemptId || crypto.randomUUID();
      activeAttemptUuid = attemptUuid;
      const deliveryMethod = input.deliveryMethod || "delivery";

      // 1. Ensure online checkout foundation creates / recovers pending orders atomically
      await supabase.rpc("expire_online_checkouts");
      await supabase.rpc("recover_online_checkout", { p_attempt_id: null });

      const { data: checkoutRes, error: checkoutErr } = await supabase.rpc("create_online_checkout", {
        p_attempt_id: attemptUuid,
        p_delivery_method: deliveryMethod,
        p_shipping_name: input.shippingName?.trim() || null,
        p_shipping_phone: input.shippingPhone?.trim() || null,
        p_shipping_address: input.shippingAddress?.trim() || null,
        p_buyer_note: input.buyerNote?.trim() || null,
      });

      if (checkoutErr || !checkoutRes) {
        return jsonResponse({ error: checkoutErr?.message || "Failed to initialize order checkout." }, 400);
      }

      paymentTransactionId = checkoutRes.paymentTransactionId;
      totalAmount = Number(checkoutRes.amount);
      const orderIds: string[] = checkoutRes.orderIds || [];
      orderId = orderIds[0] || paymentTransactionId;

      // Fetch line items for Maya checkout summary
      if (orderIds.length > 0) {
        const { data: ordersWithItems } = await supabase
          .from("orders")
          .select(`
            id,
            subtotal,
            shipping_fee,
            order_items (
              product_id,
              product_title,
              quantity,
              unit_price
            )
          `)
          .in("id", orderIds);

        if (ordersWithItems) {
          ordersWithItemsData = ordersWithItems;
          for (const ord of ordersWithItems) {
            subtotal += Number(ord.subtotal);
            shippingFee += Number(ord.shipping_fee);
            for (const it of ord.order_items || []) {
              itemsList.push({
                name: it.product_title,
                quantity: it.quantity,
                price: Number(it.unit_price),
              });
            }
          }
        }
      }
    }

    if (totalAmount <= 0) {
      return jsonResponse({ error: "Authoritative order total must be greater than zero." }, 400);
    }

    // Reference number (e.g. CC-A1B2C3D4)
    const referenceNumber = formatOrderReference(orderId || paymentTransactionId || "00000000");

    // Build Maya Sandbox Checkout Payload
    const mayaPayload: CreateMayaCheckoutPayload = {
      totalAmount: {
        value: totalAmount,
        currency: "PHP",
        details: {
          subtotal: subtotal > 0 ? subtotal : totalAmount,
          shippingFee: shippingFee > 0 ? shippingFee : 0,
        },
      },
      buyer: {
        firstName: recipientName.split(" ")[0] || "Buyer",
        lastName: recipientName.split(" ").slice(1).join(" ") || "User",
        contact: {
          phone: recipientPhone,
          email: user.email,
        },
        shippingAddress: {
          line1: deliveryAddress,
          city: "Cebu City",
          state: "Cebu",
          countryCode: "PH",
        },
      },
      items: itemsList.length > 0
        ? itemsList.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            amount: { value: it.price },
            totalAmount: { value: it.price * it.quantity },
          }))
        : [
            {
              name: `CircuitCart Order (${referenceNumber})`,
              quantity: 1,
              amount: { value: totalAmount },
              totalAmount: { value: totalAmount },
            },
          ],
      redirectUrl: {
        success: `${appUrl}/marketplace/payment/success?orderId=${orderId || ""}&txId=${paymentTransactionId || ""}`,
        failure: `${appUrl}/marketplace/payment/failed?orderId=${orderId || ""}&txId=${paymentTransactionId || ""}`,
        cancel: `${appUrl}/marketplace/payment/cancelled?orderId=${orderId || ""}&txId=${paymentTransactionId || ""}`,
      },
      requestReferenceNumber: referenceNumber,
    };

    // 4. Request Maya Hosted Sandbox Checkout
    let mayaResult;
    try {
      mayaResult = await createMayaSandboxCheckout(mayaPayload);
    } catch (mayaApiErr: unknown) {
      const rawMsg = mayaApiErr instanceof Error ? mayaApiErr.message : "Maya API request failed";
      console.error("Maya Sandbox Checkout API Call Failed:", {
        status: (mayaApiErr as { status?: number })?.status || 503,
        error: rawMsg.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "[REDACTED]"),
      });

      // Rollback unstarted online checkout: restores stock, cancels orders and payment transaction
      const attemptToCancel = input.attemptId || activeAttemptUuid;
      if (attemptToCancel) {
        try {
          await supabase.rpc("cancel_online_checkout", {
            p_attempt_id: attemptToCancel,
          });
        } catch (cancelErr) {
          console.warn("Failed to cancel online checkout attempt on Maya failure:", cancelErr);
        }
      }

      // Restore buyer's cart items in database so the cart is not left empty
      if (user.id && ordersWithItemsData) {
        const cartRestoreRows = ordersWithItemsData
          .flatMap((o) => o.order_items || [])
          .filter((it): it is { product_id: string; quantity: number } => Boolean(it.product_id && it.quantity > 0))
          .map((it) => ({
            user_id: user.id,
            product_id: it.product_id,
            quantity: it.quantity,
          }));

        if (cartRestoreRows.length > 0) {
          try {
            await supabase
              .from("cart_items")
              .upsert(cartRestoreRows, { onConflict: "user_id,product_id" });
          } catch (restoreErr) {
            console.warn("Failed to restore cart items on Maya failure:", restoreErr);
          }
        }
      }

      // User-friendly message — never expose developer-internal details to the buyer
      const userFriendlyMessage =
        "Online payment is temporarily unavailable. Please choose another payment method or try again later.";

      return jsonResponse(
        {
          error: userFriendlyMessage,
          recoveryRequired: false,
        },
        503
      );
    }

    // 5. Update Maya Checkout ID in Supabase
    if (paymentTransactionId) {
      await supabase.rpc("record_online_checkout_id", {
        p_payment_transaction_id: paymentTransactionId,
        p_checkout_id: mayaResult.checkoutId,
      });
    }

    return jsonResponse({
      success: true,
      redirectUrl: mayaResult.redirectUrl,
      checkoutId: mayaResult.checkoutId,
      orderId,
      paymentTransactionId,
      referenceNumber,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process checkout.";
    console.error("Maya Checkout Create General Error:", message);
    return jsonResponse({ error: message, recoveryRequired: false }, 500);
  }
}
