/**
 * CircuitCart — seller-led payout workflow contracts
 * ==================================================
 * Pure-logic mirrors of:
 * - finance_record_order trigger (buyer completion → payout pending→eligible)
 * - seller_request_payout() gates (eligible → processing, seller-initiated)
 * - admin_update_payout_status allowlist AFTER
 *   20260927165627_restrict_admin_payout_transitions.sql
 * - lib/finance/contracts.ts payoutActions (admin buttons offered per status)
 *
 * Run: node --test tests/finance/payout-transitions.test.mjs
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ─── Mirror of the repaired admin allowlist ─────────────────────────────────
const ADMIN_ALLOWED = {
  pending: ["held"],
  eligible: ["held"],
  held: ["eligible"],
  processing: ["released", "failed", "held"],
};
function adminTransition(from, to) {
  return (ADMIN_ALLOWED[from] || []).includes(to);
}

// ─── Mirror of seller_request_payout() gates ────────────────────────────────
function sellerRequestPayout({ callerIsSeller, payoutStatus, orderStatus, paymentStatus, hasAccount }) {
  if (!callerIsSeller) throw new Error("Seller access required.");
  if (payoutStatus !== "eligible") throw new Error("Only eligible payouts can be requested.");
  if (orderStatus !== "completed" || paymentStatus !== "paid") {
    throw new Error("Payout requires a completed, paid order.");
  }
  if (!hasAccount) throw new Error("Save an active payout account before requesting payout.");
  return "processing";
}

// ─── Mirror of finance_record_order completion branch ───────────────────────
function payoutAfterBuyerCompletion({ paymentMethod, paymentStatus, payoutStatus }) {
  if (
    (paymentMethod === "demo_card" || paymentMethod === "maya_online") &&
    paymentStatus === "paid" &&
    payoutStatus === "pending"
  ) {
    return "eligible";
  }
  return payoutStatus;
}

// ─── Mirror of lib/finance/contracts.ts payoutActions ───────────────────────
const payoutActions = {
  pending: [{ status: "held", label: "Hold" }],
  eligible: [{ status: "held", label: "Hold" }],
  held: [{ status: "eligible", label: "Restore / resume" }],
  processing: [
    { status: "released", label: "Mark released (simulated)" },
    { status: "held", label: "Hold" },
    { status: "failed", label: "Mark failed" },
  ],
};

describe("buyer completion automatically makes payout eligible", () => {
  it("completed buyer-confirmed paid order: pending → eligible", () => {
    assert.equal(
      payoutAfterBuyerCompletion({
        paymentMethod: "demo_card",
        paymentStatus: "paid",
        payoutStatus: "pending",
      }),
      "eligible"
    );
  });

  it("no admin step is required for pending → eligible", () => {
    assert.equal(adminTransition("pending", "eligible"), false);
    assert.equal(
      payoutAfterBuyerCompletion({
        paymentMethod: "demo_card",
        paymentStatus: "paid",
        payoutStatus: "pending",
      }),
      "eligible",
      "trigger does it without admin"
    );
  });
});

describe("admin cannot bypass the seller request flow", () => {
  it("admin cannot manually convert pending → eligible", () => {
    assert.equal(adminTransition("pending", "eligible"), false);
  });

  it("admin cannot start eligible → processing", () => {
    assert.equal(adminTransition("eligible", "processing"), false);
  });

  it("admin UI offers no bypass buttons for pending/eligible", () => {
    for (const status of ["pending", "eligible"]) {
      const offered = (payoutActions[status] || []).map((a) => a.status);
      assert.ok(!offered.includes("eligible"), `${status}: no Mark eligible`);
      assert.ok(!offered.includes("processing"), `${status}: no Start processing`);
    }
  });
});

describe("seller requests eligible → processing", () => {
  const base = {
    callerIsSeller: true,
    payoutStatus: "eligible",
    orderStatus: "completed",
    paymentStatus: "paid",
    hasAccount: true,
  };

  it("seller with account requests payout", () => {
    assert.equal(sellerRequestPayout(base), "processing");
  });

  it("seller without account is blocked with guidance", () => {
    assert.throws(
      () => sellerRequestPayout({ ...base, hasAccount: false }),
      /active payout account/
    );
  });

  it("non-seller cannot request", () => {
    assert.throws(
      () => sellerRequestPayout({ ...base, callerIsSeller: false }),
      /Seller access required/
    );
  });

  it("non-eligible payouts cannot be requested", () => {
    assert.throws(
      () => sellerRequestPayout({ ...base, payoutStatus: "pending" }),
      /Only eligible payouts/
    );
  });
});

describe("admin handles processing payouts", () => {
  it("admin can release a processing payout", () => {
    assert.equal(adminTransition("processing", "released"), true);
  });

  it("admin can hold a processing payout", () => {
    assert.equal(adminTransition("processing", "held"), true);
  });

  it("admin can fail a processing payout", () => {
    assert.equal(adminTransition("processing", "failed"), true);
  });

  it("admin UI offers Release / Hold / Mark failed for processing", () => {
    const offered = payoutActions.processing.map((a) => a.status).sort();
    assert.deepEqual(offered, ["failed", "held", "released"]);
  });
});

describe("held/released safeguards remain intact", () => {
  it("held resumes only to eligible", () => {
    assert.equal(adminTransition("held", "eligible"), true);
    assert.equal(adminTransition("held", "processing"), false);
    assert.equal(adminTransition("held", "released"), false);
  });

  it("released is terminal", () => {
    for (const to of ["pending", "eligible", "processing", "held", "failed"]) {
      assert.equal(adminTransition("released", to), false, `released → ${to} blocked`);
    }
  });

  it("admin UI offers only Restore / resume for held", () => {
    assert.deepEqual(
      payoutActions.held.map((a) => a.status),
      ["eligible"]
    );
  });
});
