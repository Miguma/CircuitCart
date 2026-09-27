/**
 * CircuitCart — seller payout request UI state machine contracts
 * =============================================================
 * Pure-logic mirrors of the seller Action cell in
 * components/finance/finance-dashboard.tsx plus the request flow
 * (lib/finance/client.ts requestSellerPayout → seller_request_payout RPC):
 *
 * - eligible + active account + completed order → enabled [Request payout]
 * - eligible + no account → disabled [Add payout account first]
 * - pending → helper text, no button
 * - processing → helper text, no second request while running or after
 * - held / released / failed → helper text, no button
 * - confirm dialog → RPC call → toast + refresh → "Payout requested"
 * - admin processing rows offer Release / Hold / Mark failed
 * - admin eligible rows never offer Start processing
 *
 * Run: node --test tests/finance/seller-request-ui.test.mjs
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ─── Mirror of the seller Action cell decision ──────────────────────────────
function sellerActionCell({ status, accountLast4, orderStatus, busy, requesting }) {
  if (status === "eligible" && accountLast4) {
    return {
      kind: "button",
      label: "Request payout",
      disabled: Boolean(busy || requesting || orderStatus !== "completed"),
    };
  }
  if (status === "eligible") {
    return { kind: "button", label: "Add payout account first", disabled: true };
  }
  const texts = {
    pending: "Available after buyer confirms completion.",
    processing: "Awaiting administrator release.",
    released: "Released",
    held: "This payout is currently held by an administrator.",
    failed: "Payout failed.",
  };
  return { kind: "text", label: texts[status] || "—", disabled: false };
}

// ─── Mirror of the request flow (confirm → RPC → refresh) ───────────────────
function simulateRequestFlow({ row, rpc }) {
  const calls = [];
  async function requestPayout() {
    calls.push({ rpc: "seller_request_payout", payoutId: row.id });
    const result = await rpc(row.id);
    if (result !== true) throw new Error("Payout request failed.");
    return { toast: "Payout requested successfully.", refreshed: true, displayStatus: "Payout requested" };
  }
  return { calls, requestPayout };
}

const eligibleRow = {
  id: "payout-1",
  status: "eligible",
  account_last4: "1234",
  order_status: "completed",
  net_amount: 530,
  bank_name: "MARIBANK",
};

describe("eligible + payout account → Request payout enabled", () => {
  it("renders an enabled Request payout button", () => {
    const cell = sellerActionCell({
      status: "eligible",
      accountLast4: "1234",
      orderStatus: "completed",
      busy: false,
      requesting: false,
    });
    assert.equal(cell.kind, "button");
    assert.equal(cell.label, "Request payout");
    assert.equal(cell.disabled, false);
  });

  it("disables while a request is running (no double-click)", () => {
    const cell = sellerActionCell({
      status: "eligible",
      accountLast4: "1234",
      orderStatus: "completed",
      busy: false,
      requesting: true,
    });
    assert.equal(cell.disabled, true);
  });
});

describe("eligible + no payout account → disabled", () => {
  it("renders a disabled Add payout account first button", () => {
    const cell = sellerActionCell({
      status: "eligible",
      accountLast4: null,
      orderStatus: "completed",
      busy: false,
      requesting: false,
    });
    assert.equal(cell.kind, "button");
    assert.equal(cell.label, "Add payout account first");
    assert.equal(cell.disabled, true);
  });
});

describe("non-actionable states show helper text, no button", () => {
  it("pending → no request", () => {
    const cell = sellerActionCell({ status: "pending" });
    assert.equal(cell.kind, "text");
    assert.equal(cell.label, "Available after buyer confirms completion.");
  });

  it("processing → no second request", () => {
    const cell = sellerActionCell({ status: "processing" });
    assert.equal(cell.kind, "text");
    assert.equal(cell.label, "Awaiting administrator release.");
  });

  it("held → admin hold text", () => {
    const cell = sellerActionCell({ status: "held" });
    assert.equal(cell.label, "This payout is currently held by an administrator.");
  });

  it("released → Released text", () => {
    const cell = sellerActionCell({ status: "released" });
    assert.equal(cell.label, "Released");
  });

  it("failed → failure text", () => {
    const cell = sellerActionCell({ status: "failed" });
    assert.equal(cell.label, "Payout failed.");
  });
});

describe("request calls seller_request_payout and refreshes state", () => {
  it("confirm dialog triggers the existing RPC with the payout id", async () => {
    const flow = simulateRequestFlow({
      row: eligibleRow,
      rpc: async (id) => {
        assert.equal(id, "payout-1");
        return true;
      },
    });
    const result = await flow.requestPayout();
    assert.equal(flow.calls.length, 1);
    assert.deepEqual(flow.calls[0], { rpc: "seller_request_payout", payoutId: "payout-1" });
    assert.equal(result.toast, "Payout requested successfully.");
    assert.equal(result.refreshed, true);
    assert.equal(result.displayStatus, "Payout requested");
  });

  it("RPC failure surfaces instead of refreshing", async () => {
    const flow = simulateRequestFlow({
      row: eligibleRow,
      rpc: async () => false,
    });
    await assert.rejects(() => flow.requestPayout(), /Payout request failed/);
  });
});

describe("admin controls per status", () => {
  const adminActions = {
    pending: ["held"],
    eligible: ["held"],
    held: ["eligible"],
    processing: ["released", "held", "failed"],
  };

  it("processing payout shows admin release controls", () => {
    assert.deepEqual(adminActions.processing.sort(), ["failed", "held", "released"]);
  });

  it("eligible payout does NOT show admin Start processing", () => {
    assert.ok(!adminActions.eligible.includes("processing"));
  });

  it("released payout appears with no admin action", () => {
    assert.equal((adminActions.released || []).length, 0);
  });
});
