/**
 * CircuitCart — Buyer confirms receipt lifecycle contracts
 * ========================================================
 * Pure-logic mirrors of supabase/migrations/20260927161106_buyer_confirm_order_received.sql:
 * buyer_confirm_order_received gates + the hardened update_seller_order_status
 * wrapper (seller-initiated 'completed' rejected) + the existing
 * finance_record_order pending → eligible conversion on completion.
 *
 * Run: node --test tests/orders/buyer-confirm-receipt.test.mjs
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ─── Mirror of buyer_confirm_order_received gate logic ───────────────────────
function buyerConfirm(order, callerId) {
  if (!callerId) throw new Error("Authentication required.");
  if (!order) throw new Error("Order not found.");
  if (order.buyer_id !== callerId) throw new Error("Order not found.");
  if (order.status === "completed") {
    return { success: true, alreadyCompleted: true, status: "completed" };
  }
  if (order.status === "cancelled") {
    throw new Error("Cancelled orders cannot be completed.");
  }
  if (order.payment_status === "refunded") {
    throw new Error("Refunded orders cannot be completed.");
  }
  if (
    (order.payment_method === "maya_online" ||
      order.payment_method === "demo_card") &&
    order.payment_status !== "paid"
  ) {
    throw new Error("Awaiting Payment: this order cannot be completed before verified payment.");
  }
  if (order.delivery_method === "delivery") {
    if (order.status !== "shipped") {
      throw new Error("Delivery orders can only be completed after they are shipped.");
    }
  } else if (order.delivery_method === "meetup") {
    if (order.status !== "ready") {
      throw new Error("Meetup orders can only be completed after they are ready.");
    }
  } else {
    throw new Error("Unknown delivery method.");
  }
  return { success: true, alreadyCompleted: false, status: "completed" };
}

// ─── Mirror of hardened update_seller_order_status wrapper ──────────────────
function sellerUpdateStatus(order, callerId, newStatus) {
  if (!callerId || order.seller_id !== callerId) {
    throw new Error("Order not found or not permitted.");
  }
  if (newStatus === "completed") {
    throw new Error("Only the buyer can confirm receipt and complete an order.");
  }
  return true;
}

// ─── Mirror of finance_record_order pending → eligible on completion ────────
function financeOnCompleted({ paymentMethod, paymentStatus, payoutStatus }) {
  if (
    (paymentMethod === "demo_card" || paymentMethod === "maya_online") &&
    paymentStatus === "paid" &&
    payoutStatus === "pending"
  ) {
    return "eligible";
  }
  return payoutStatus;
}

function deliveredOrder(overrides = {}) {
  return {
    buyer_id: "buyer-1",
    seller_id: "seller-1",
    delivery_method: "delivery",
    payment_method: "demo_card",
    payment_status: "paid",
    status: "shipped",
    ...overrides,
  };
}

describe("seller cannot complete orders (wrapper hardening)", () => {
  it("seller cannot complete a shipped delivery order", () => {
    assert.throws(
      () => sellerUpdateStatus(deliveredOrder(), "seller-1", "completed"),
      /Only the buyer can confirm receipt/
    );
  });

  it("seller cannot complete a ready meetup order", () => {
    const order = deliveredOrder({ delivery_method: "meetup", status: "ready" });
    assert.throws(
      () => sellerUpdateStatus(order, "seller-1", "completed"),
      /Only the buyer can confirm receipt/
    );
  });

  it("seller non-completion transitions still allowed", () => {
    assert.equal(
      sellerUpdateStatus(deliveredOrder({ status: "confirmed" }), "seller-1", "preparing"),
      true
    );
  });
});

describe("buyer confirmation gates", () => {
  it("shipped paid delivery can be confirmed by the buyer", () => {
    const res = buyerConfirm(deliveredOrder(), "buyer-1");
    assert.equal(res.success, true);
    assert.equal(res.alreadyCompleted, false);
    assert.equal(res.status, "completed");
  });

  it("ready meetup can be confirmed by the buyer (paid or cash)", () => {
    for (const payment of [
      { payment_method: "demo_card", payment_status: "paid" },
      { payment_method: "cash_on_meetup", payment_status: "pending" },
    ]) {
      const res = buyerConfirm(
        deliveredOrder({ delivery_method: "meetup", status: "ready", ...payment }),
        "buyer-1"
      );
      assert.equal(res.success, true, JSON.stringify(payment));
    }
  });

  it("wrong buyer cannot confirm", () => {
    assert.throws(
      () => buyerConfirm(deliveredOrder(), "buyer-2"),
      /Order not found/
    );
  });

  it("wrong buyer cannot confirm an already-completed order", () => {
    assert.throws(
      () => buyerConfirm(deliveredOrder({ status: "completed" }), "buyer-2"),
      /Order not found/
    );
  });

  it("unpaid online delivery cannot be confirmed", () => {
    assert.throws(
      () => buyerConfirm(deliveredOrder({ payment_status: "pending" }), "buyer-1"),
      /Awaiting Payment/
    );
  });

  it("non-shipped delivery cannot be confirmed", () => {
    for (const status of ["pending", "confirmed", "preparing", "ready"]) {
      assert.throws(
        () => buyerConfirm(deliveredOrder({ status }), "buyer-1"),
        /only be completed after they are shipped/,
        `status=${status} must be rejected`
      );
    }
  });

  it("non-ready meetup cannot be confirmed", () => {
    assert.throws(
      () => buyerConfirm(deliveredOrder({ delivery_method: "meetup", status: "confirmed" }), "buyer-1"),
      /only be completed after they are ready/
    );
  });

  it("already completed confirmation is idempotent for the same buyer", () => {
    const res = buyerConfirm(deliveredOrder({ status: "completed" }), "buyer-1");
    assert.equal(res.success, true);
    assert.equal(res.alreadyCompleted, true);
  });

  it("cancelled order cannot be completed", () => {
    assert.throws(
      () => buyerConfirm(deliveredOrder({ status: "cancelled" }), "buyer-1"),
      /Cancelled orders cannot be completed/
    );
  });

  it("refunded order cannot be completed", () => {
    assert.throws(
      () =>
        buyerConfirm(
          deliveredOrder({ status: "shipped", payment_status: "refunded" }),
          "buyer-1"
        ),
      /Refunded orders cannot be completed/
    );
  });

  it("unauthenticated callers are rejected", () => {
    assert.throws(() => buyerConfirm(deliveredOrder(), null), /Authentication required/);
  });
});

describe("seller payout becomes eligible through the existing finance trigger", () => {
  it("paid online completion converts payout pending → eligible", () => {
    assert.equal(
      financeOnCompleted({
        paymentMethod: "demo_card",
        paymentStatus: "paid",
        payoutStatus: "pending",
      }),
      "eligible"
    );
  });

  it("no payout row is fabricated for cash methods by this path", () => {
    assert.equal(
      financeOnCompleted({
        paymentMethod: "cash_on_meetup",
        paymentStatus: "pending",
        payoutStatus: "none",
      }),
      "none",
      "cash completion records commission receivable, not a payout transition"
    );
  });

  it("non-pending payouts are left alone", () => {
    assert.equal(
      financeOnCompleted({
        paymentMethod: "demo_card",
        paymentStatus: "paid",
        payoutStatus: "held",
      }),
      "held"
    );
  });
});
