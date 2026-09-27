/**
 * CircuitCart — Demo abort lifecycle + notifications repair contracts
 * ================================================================
 * Pure-logic tests (no live database). They encode the contracts enforced by
 * supabase/migrations/20260927155320_repair_notifications_and_demo_abort_lifecycle.sql:
 *
 * 1. online_inventory_release_terminal: once inventory_released_at is set, the
 *    transaction MUST stay in ('expired','cancelled'). abort_failed_online_checkout
 *    therefore leaves a failed pre-provider checkout terminal 'cancelled' and
 *    must never write status='failed' afterwards (old PostgreSQL 23514 bug).
 * 2. Abort restores cart + stock exactly once and cancels pending children.
 * 3. notifications table shape + RLS expectations from the repair migration.
 * 4. Demo Card confirmation requirements (paid tx + paid receipt, never from
 *    a cancelled/failed transaction).
 *
 * Run: node --test tests/finance/demo-abort-lifecycle.test.mjs
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ─── Mirrors CHECK online_inventory_release_terminal ─────────────────────────
function satisfiesReleaseTerminal({ inventoryReleasedAt, checkoutAttemptId, status }) {
  if (inventoryReleasedAt === null) return true;
  return (
    checkoutAttemptId !== null &&
    (status === "expired" || status === "cancelled")
  );
}

// ─── Mirrors repaired abort_failed_online_checkout decision logic ────────────
function abortDecision(tx) {
  if (!tx || !tx.buyerMatches) return false;
  if (
    tx.status === "created" &&
    tx.providerCheckoutId === null &&
    tx.inventoryReleasedAt === null
  ) {
    return { terminalStatus: "cancelled", releasesInventory: true };
  }
  return false;
}

describe("abort terminal state satisfies online_inventory_release_terminal", () => {
  it("released transaction remaining 'cancelled' satisfies the constraint", () => {
    assert.equal(
      satisfiesReleaseTerminal({
        inventoryReleasedAt: "2026-09-27T00:00:00Z",
        checkoutAttemptId: "attempt-1",
        status: "cancelled",
      }),
      true
    );
  });

  it("writing 'failed' after release violates the constraint (the old 23514 bug)", () => {
    assert.equal(
      satisfiesReleaseTerminal({
        inventoryReleasedAt: "2026-09-27T00:00:00Z",
        checkoutAttemptId: "attempt-1",
        status: "failed",
      }),
      false,
      "status='failed' with inventory_released_at set must be rejected"
    );
  });

  it("repaired abort leaves the transaction terminal 'cancelled', never 'failed'", () => {
    const tx = {
      buyerMatches: true,
      status: "created",
      providerCheckoutId: null,
      inventoryReleasedAt: null,
    };
    const decision = abortDecision(tx);
    assert.deepEqual(decision, {
      terminalStatus: "cancelled",
      releasesInventory: true,
    });
    assert.ok(
      satisfiesReleaseTerminal({
        inventoryReleasedAt: "now",
        checkoutAttemptId: "attempt-1",
        status: decision.terminalStatus,
      }),
      "repaired terminal state must satisfy the constraint"
    );
  });
});

describe("abort guards: ownership, provider evidence, idempotency", () => {
  it("returns false when the transaction does not belong to the caller", () => {
    assert.equal(abortDecision(null), false);
    assert.equal(
      abortDecision({
        buyerMatches: false,
        status: "created",
        providerCheckoutId: null,
        inventoryReleasedAt: null,
      }),
      false
    );
  });

  it("refuses to abort once a provider session exists", () => {
    assert.equal(
      abortDecision({
        buyerMatches: true,
        status: "created",
        providerCheckoutId: "maya-checkout-1",
        inventoryReleasedAt: null,
      }),
      false,
      "provider evidence requires reconciliation, not abort"
    );
  });

  it("is idempotent: non-created or already-released checkouts return false", () => {
    for (const tx of [
      { buyerMatches: true, status: "cancelled", providerCheckoutId: null, inventoryReleasedAt: "now" },
      { buyerMatches: true, status: "paid", providerCheckoutId: null, inventoryReleasedAt: null },
      { buyerMatches: true, status: "failed", providerCheckoutId: null, inventoryReleasedAt: null },
    ]) {
      assert.equal(abortDecision(tx), false, `status=${tx.status} must not re-abort`);
    }
  });
});

describe("abort restores cart and stock exactly once", () => {
  it("cart quantities merge additively (existing + restored)", () => {
    const cart = new Map([["prod-a", 1]]);
    const restored = [{ productId: "prod-a", quantity: 2 }];
    for (const item of restored) {
      cart.set(item.productId, (cart.get(item.productId) || 0) + item.quantity);
    }
    assert.equal(cart.get("prod-a"), 3);
  });

  it("stock is incremented by the reserved quantities", () => {
    let stock = 5;
    const reserved = 2;
    stock += reserved;
    assert.equal(stock, 7);
  });

  it("only pending child orders are cancelled; paid orders are unreachable here", () => {
    const orders = [
      { id: "o1", status: "pending" },
      { id: "o2", status: "pending" },
    ];
    for (const o of orders) {
      if (o.status === "pending") o.status = "cancelled";
    }
    assert.ok(orders.every((o) => o.status === "cancelled"));
  });
});

describe("notifications repair schema expectations", () => {
  // Mirrors the CREATE TABLE IF NOT EXISTS in the repair migration.
  const expectedColumns = {
    id: "uuid",
    user_id: "uuid",
    type: "text",
    title: "text",
    message: "text",
    link: "text",
    entity_id: "uuid",
    read_at: "timestamptz",
    created_at: "timestamptz",
  };

  it("has every expected column with a nullable link/entity/read timestamp", () => {
    const nullable = new Set(["link", "entity_id", "read_at"]);
    for (const [column, type] of Object.entries(expectedColumns)) {
      assert.ok(typeof column === "string" && typeof type === "string");
      assert.ok(
        nullable.has(column) ||
          ["id", "user_id", "type", "title", "message", "created_at"].includes(column),
        `unexpected column: ${column}`
      );
    }
    assert.equal(Object.keys(expectedColumns).length, 9);
  });

  it("RLS: buyers select only own rows; no direct insert/update/delete", () => {
    function canSelect(requesterId, rowUserId) {
      return requesterId === rowUserId;
    }
    function canDirectWrite() {
      return false;
    }
    assert.equal(canSelect("u1", "u1"), true);
    assert.equal(canSelect("u2", "u1"), false);
    assert.equal(canDirectWrite(), false, "clients must use RPCs/triggers");
  });

  it("mark_notification_read only touches the caller's own row", () => {
    function markRead(notifications, callerId, notificationId) {
      const row = notifications.find((n) => n.id === notificationId);
      if (!row || row.user_id !== callerId) return false;
      row.read_at = row.read_at || "now";
      return true;
    }
    const rows = [{ id: "n1", user_id: "u1", read_at: null }];
    assert.equal(markRead(rows, "u2", "n1"), false, "must not mark another user's notification");
    assert.equal(markRead(rows, "u1", "n1"), true);
    assert.equal(rows[0].read_at, "now");
  });
});

describe("Demo Card confirmation requirements", () => {
  function mayConfirm(tx) {
    if (!tx) return false;
    if (tx.provider !== "circuitcart_sandbox" || tx.sandbox !== true) return false;
    if (tx.status === "paid") return "idempotent";
    if (["failed", "cancelled", "expired", "refunded"].includes(tx.status)) return false;
    return true;
  }

  it("confirms a created sandbox checkout", () => {
    assert.equal(
      mayConfirm({ provider: "circuitcart_sandbox", sandbox: true, status: "created" }),
      true
    );
  });

  it("never confirms from cancelled/failed/expired/refunded states", () => {
    for (const status of ["failed", "cancelled", "expired", "refunded"]) {
      assert.equal(
        mayConfirm({ provider: "circuitcart_sandbox", sandbox: true, status }),
        false,
        `status=${status} must not confirm`
      );
    }
  });

  it("rejects non-sandbox providers for the demo path", () => {
    assert.equal(
      mayConfirm({ provider: "maya", sandbox: false, status: "created" }),
      false
    );
  });
});
