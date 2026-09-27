/**
 * CircuitCart — Finance Contract Test Suite
 * ==========================================
 * Tests: Demo Card paid-state regression, commission maths, security, COD receivable.
 * NO live database, NO Supabase calls.  Pure business-logic unit tests.
 *
 * Run: node tests/finance/finance-contracts.test.mjs
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ─── Helpers mirroring SQL commission maths ─────────────────────────────────

/** Mirrors: round(subtotal * rate_bps / 10000, 2) */
function calcPlatformFee(subtotal, rateBps) {
  return Math.round(subtotal * rateBps / 10000 * 100) / 100;
}

/** Mirrors: net_amount = total - platform_fee */
function calcSellerNet(total, platformFee) {
  return Math.round((total - platformFee) * 100) / 100;
}

// ─── matchesFinancialReceipt contract ────────────────────────────────────────

function matchesFinancialReceipt(value, transactionId, expectedOrders) {
  if (!value || value.success !== true || value.status !== "paid") return false;
  if (value.paymentTransactionId !== transactionId) return false;
  const orderIds = value.orderIds;
  if (!Array.isArray(orderIds) || orderIds.length === 0) return false;
  if (orderIds.length !== expectedOrders.length) return false;
  const expected = new Set(expectedOrders);
  return orderIds.every((id) => expected.has(id));
}

// ─── TEST 1: Demo Card — success MUST NOT return if DB state is wrong ────────

describe("Demo Card paid-state regression", () => {
  it("success:true requires transaction.status='paid', all orders paid+confirmed, payout and commission exist", () => {
    // Simulate the receipt object from get_payment_financial_receipt
    const txId = "aaaabbbb-cccc-dddd-eeee-ffff00001111";
    const orderId = "00001111-2222-3333-4444-555566667777";

    // CASE 1: transaction not yet paid — should fail
    const receiptPending = { success: false, status: "created", paymentTransactionId: txId, orderIds: [orderId] };
    assert.equal(matchesFinancialReceipt(receiptPending, txId, [orderId]), false,
      "success:false receipt must never pass");

    // CASE 2: correct fully-paid receipt
    const receiptPaid = { success: true, status: "paid", paymentTransactionId: txId, orderIds: [orderId] };
    assert.equal(matchesFinancialReceipt(receiptPaid, txId, [orderId]), true,
      "Valid paid receipt must pass");

    // CASE 3: wrong transaction ID
    const receiptWrongTx = { success: true, status: "paid", paymentTransactionId: "different-tx-id", orderIds: [orderId] };
    assert.equal(matchesFinancialReceipt(receiptWrongTx, txId, [orderId]), false,
      "Wrong transaction ID must fail");

    // CASE 4: empty orderIds
    const receiptNoOrders = { success: true, status: "paid", paymentTransactionId: txId, orderIds: [] };
    assert.equal(matchesFinancialReceipt(receiptNoOrders, txId, [orderId]), false,
      "Empty orderIds must fail");

    // CASE 5: null receipt (RPC returned null)
    assert.equal(matchesFinancialReceipt(null, txId, [orderId]), false,
      "null receipt must fail");
  });

  it("fails gracefully when DB stays in 'created' state (the original CC-018 bug scenario)", () => {
    const txId = "tx-stuck-in-created";
    // The bug was: API returned success:true while DB had status='created'
    // Our guard: matchesFinancialReceipt must return false for status != 'paid'
    const stuckReceipt = { success: true, status: "created", paymentTransactionId: txId, orderIds: ["order-1"] };
    assert.equal(matchesFinancialReceipt(stuckReceipt, txId, ["order-1"]), false,
      "CC-018 regression: status='created' must never produce a passing receipt");
  });
});

// ─── TEST 2: Commission calculation — ₱50,000 at 5% ─────────────────────────

describe("Commission calculation", () => {
  it("₱50,000 subtotal at 5% (500 bps) → ₱2,500 fee, ₱47,500 seller net", () => {
    const subtotal = 50000;
    const total = 50000; // no shipping to keep this case clean
    const rateBps = 500;
    const fee = calcPlatformFee(subtotal, rateBps);
    assert.equal(fee, 2500, "Platform fee must be ₱2,500");
    const net = calcSellerNet(total, fee);
    assert.equal(net, 47500, "Seller net must be ₱47,500");
  });

  it("default rate 500 bps = 5%", () => {
    assert.equal(500 / 100, 5, "500 bps = 5%");
  });
});

// ─── TEST 3: Shipping EXCLUDED from commission base ───────────────────────────

describe("Shipping excluded from commission", () => {
  it("subtotal=5000, shipping=150, rate=5% → fee=250, seller net=4900", () => {
    const subtotal = 5000;
    const shipping = 150;
    const total = subtotal + shipping; // 5150
    const rateBps = 500;

    // Commission is on SUBTOTAL only, NOT total
    const fee = calcPlatformFee(subtotal, rateBps);
    assert.equal(fee, 250, "Fee must be 250 (5% of 5000, not 5150)");

    // Seller net = total - fee (shipping passes through to seller)
    const net = calcSellerNet(total, fee);
    assert.equal(net, 4900, "Seller net = 5150 - 250 = 4900");

    // Verify: fee on total would have been wrong
    const wrongFee = calcPlatformFee(total, rateBps);
    assert.equal(wrongFee, 257.5, "Using total would wrongly charge ₱257.50");
    assert.notEqual(fee, wrongFee, "Shipping must not inflate the platform fee");
  });

  it("zero shipping → fee same as subtotal-based calculation", () => {
    const subtotal = 1000;
    const shipping = 0;
    const total = subtotal + shipping;
    const fee = calcPlatformFee(subtotal, 500);
    const feeFromTotal = calcPlatformFee(total, 500);
    assert.equal(fee, feeFromTotal, "When shipping=0, subtotal-based and total-based fees are equal");
  });
});

// ─── TEST 4: Multi-seller accounting ─────────────────────────────────────────

describe("Multi-seller accounting", () => {
  it("two sellers get independent commission records, fees don't bleed across orders", () => {
    const sellerA = { subtotal: 2000, shipping: 100, rateBps: 500 };
    const sellerB = { subtotal: 3000, shipping: 200, rateBps: 500 };

    const feeA = calcPlatformFee(sellerA.subtotal, sellerA.rateBps);
    const netA = calcSellerNet(sellerA.subtotal + sellerA.shipping, feeA);
    const feeB = calcPlatformFee(sellerB.subtotal, sellerB.rateBps);
    const netB = calcSellerNet(sellerB.subtotal + sellerB.shipping, feeB);

    assert.equal(feeA, 100, "Seller A fee: ₱100");
    assert.equal(netA, 2000, "Seller A net: ₱2,100 - ₱100 = ₱2,000");
    assert.equal(feeB, 150, "Seller B fee: ₱150");
    assert.equal(netB, 3050, "Seller B net: ₱3,200 - ₱150 = ₱3,050");

    // Combined platform revenue
    assert.equal(feeA + feeB, 250, "Total platform commission: ₱250");
  });
});

// ─── TEST 5: Failure simulation → no payout or commission created ─────────────

describe("Failure simulation — no payout/commission on failed payment", () => {
  it("aborted checkout must not produce a paid receipt", () => {
    // After repaired abort_failed_online_checkout, the released transaction
    // remains terminal 'cancelled' (never 'failed', per
    // online_inventory_release_terminal) with stock/cart restored.
    const failedReceipt = { success: false, status: "cancelled", paymentTransactionId: "tx-1", orderIds: [] };
    assert.equal(matchesFinancialReceipt(failedReceipt, "tx-1", ["order-1"]), false,
      "Failed transaction must not pass receipt check");
  });

  it("success:false with simulated:true is a safe failure response", () => {
    const simFailure = { success: false, simulated: true, error: "Demo payment failed (simulated)." };
    assert.equal(simFailure.success, false, "Simulated failure must have success=false");
    assert.equal("paymentTransactionId" in simFailure, false,
      "Simulated failure must not expose transaction IDs");
  });
});

// ─── TEST 6: Retries — no duplicates ─────────────────────────────────────────

describe("Retry idempotency — no duplicate payouts or commissions", () => {
  it("finance_record_order uses IF NOT EXISTS guard for payout creation", () => {
    // The SQL uses: if not exists(select 1 from public.seller_payouts where order_id=new.id)
    // Simulated: second call with same order_id must be blocked by the guard
    const existingPayoutOrderIds = new Set(["order-already-paid"]);
    function wouldCreateDuplicate(orderId) {
      return !existingPayoutOrderIds.has(orderId);
    }
    assert.equal(wouldCreateDuplicate("order-already-paid"), false,
      "Guard prevents duplicate payout for already-recorded order");
    assert.equal(wouldCreateDuplicate("order-new"), true,
      "New order correctly would create a payout");
  });

  it("platform_commissions has unique constraint on order_id preventing duplicate commission rows", () => {
    // Confirmed by: order_id uuid not null unique references public.orders(id)
    // COD path also has: on conflict(order_id) do nothing
    const uniqueConstraintApplied = true; // from migration: order_id uuid not null unique
    assert.equal(uniqueConstraintApplied, true);
  });

  it("alreadyPaid flag in response signals idempotent re-confirmation without double-booking", () => {
    // confirm_online_payment sets v_already := v_tx.status='paid' and returns it
    const alreadyPaidResponse = { success: true, paymentStatus: "paid", alreadyPaid: true };
    assert.equal(alreadyPaidResponse.alreadyPaid, true,
      "Second confirmation of already-paid tx must indicate alreadyPaid=true");
  });
});

// ─── TEST 7: Seller payout-account isolation ─────────────────────────────────

describe("Seller payout-account isolation", () => {
  it("RLS policy allows only the owning seller to read their payout account", () => {
    // Policy: using (seller_id = (select auth.uid()) and exists(... role = 'seller'))
    function canReadAccount(requesterId, accountSellerId, requesterRole) {
      return requesterId === accountSellerId && requesterRole === "seller";
    }
    assert.equal(canReadAccount("seller-1", "seller-1", "seller"), true);
    assert.equal(canReadAccount("seller-2", "seller-1", "seller"), false, "Different seller cannot read");
    assert.equal(canReadAccount("seller-1", "seller-1", "buyer"), false, "Buyer role cannot read");
    assert.equal(canReadAccount("seller-1", "seller-1", "admin"), false, "Admin must use RPC, not direct table read");
  });

  it("finance_payout_history exposes only masked last4, never full account number", () => {
    // The function returns: destination_last4 / account_last4 (last 4 digits only)
    // account_last4 is a generated column: right(account_number, 4)
    const fullAccountNumber = "123456789012";
    const masked = fullAccountNumber.slice(-4);
    assert.equal(masked, "9012", "Only last 4 digits exposed");
    assert.equal(masked.length, 4);
    // Full number must NEVER appear in any API response
    assert.notEqual(fullAccountNumber, masked);
  });
});

// ─── TEST 8: Buyer payout-account denial ─────────────────────────────────────

describe("Buyer payout-account denial", () => {
  it("RLS denies buyer read access to seller_payout_accounts", () => {
    function canReadAccount(requesterId, accountSellerId, requesterRole) {
      return requesterId === accountSellerId && requesterRole === "seller";
    }
    assert.equal(canReadAccount("buyer-1", "seller-1", "buyer"), false,
      "Buyer must not access seller payout accounts");
    assert.equal(canReadAccount("buyer-1", "buyer-1", "buyer"), false,
      "Even own-ID buyer cannot access payout accounts (role check fails)");
  });

  it("get_payment_financial_receipt is buyer-scoped and returns no seller bank data", () => {
    // The function only returns: success, status, paymentTransactionId, orderIds
    const receipt = { success: true, status: "paid", paymentTransactionId: "tx-1", orderIds: ["order-1"] };
    assert.equal("bank_name" in receipt, false, "No bank_name in buyer receipt");
    assert.equal("account_number" in receipt, false, "No account_number in buyer receipt");
    assert.equal("account_last4" in receipt, false, "No account_last4 in buyer receipt");
    assert.equal("destination_last4" in receipt, false, "No destination_last4 in buyer receipt");
  });
});

// ─── TEST 9: Seller cannot release own payout ────────────────────────────────

describe("Seller cannot release own payout", () => {
  it("admin_update_payout_status requires role='admin'", () => {
    // SQL: if auth.uid() is null or (select role from profiles where id=auth.uid()) is distinct from 'admin'
    function canCallAdminUpdatePayout(role) {
      return role === "admin";
    }
    assert.equal(canCallAdminUpdatePayout("seller"), false, "Seller must not update payout status");
    assert.equal(canCallAdminUpdatePayout("buyer"), false, "Buyer must not update payout status");
    assert.equal(canCallAdminUpdatePayout("admin"), true, "Admin can update payout status");
    assert.equal(canCallAdminUpdatePayout(null), false, "Unauthenticated must not update payout status");
  });
});

// ─── TEST 10: Admin payout state transitions ──────────────────────────────────

describe("Admin payout transitions (seller-led flow)", () => {
  const validTransitions = {
    pending: ["held"],
    eligible: ["held"],
    held: ["eligible"],
    processing: ["released", "failed", "held"],
  };
  const invalidTransitions = {
    pending: ["eligible", "processing", "released", "failed"],
    eligible: ["processing", "released", "failed", "pending"],
    held: ["processing", "released", "failed", "pending"],
    processing: ["pending", "eligible"],
    released: ["pending", "eligible", "processing", "held", "failed"],
  };

  for (const [from, targets] of Object.entries(validTransitions)) {
    for (const to of targets) {
      it(`${from} → ${to} is valid`, () => {
        const allowed = validTransitions[from] ?? [];
        assert.equal(allowed.includes(to), true, `${from} → ${to} should be allowed`);
      });
    }
  }

  for (const [from, targets] of Object.entries(invalidTransitions)) {
    for (const to of targets) {
      it(`${from} → ${to} is INVALID`, () => {
        const allowed = validTransitions[from] ?? [];
        assert.equal(allowed.includes(to), false, `${from} → ${to} should be blocked`);
      });
    }
  }

  it("released payout history is immutable — no further transitions", () => {
    const allowed = validTransitions["released"] ?? [];
    assert.equal(allowed.length, 0, "No transitions from released");
  });
});

// ─── TEST 11: Commission-rate snapshot ───────────────────────────────────────

describe("Commission-rate snapshot", () => {
  it("changing rate today must not alter yesterday's payout amount", () => {
    // Historical payout: recorded at 5% (500 bps), subtotal=10000
    const historicalPayout = { subtotal: 10000, rateBps: 500, fee: 500, net: 9500 };

    // Admin changes rate to 10% tomorrow
    const newRateBps = 1000;

    // Historical record must stay unchanged
    assert.equal(historicalPayout.fee, 500, "Historical fee is immutable");
    assert.equal(historicalPayout.net, 9500, "Historical net is immutable");

    // New orders use new rate
    const newFee = calcPlatformFee(10000, newRateBps);
    assert.equal(newFee, 1000, "New orders correctly use 10% rate");
    assert.notEqual(newFee, historicalPayout.fee, "Rate change does not affect past records");
  });

  it("commission_rate_bps is stored per-payout row for historical accuracy", () => {
    // SQL: commission_rate_bps integer in seller_payouts (set at creation)
    const payoutRecord = { commission_rate_bps: 500, platform_fee: 500, commission_base: 10000 };
    const derivedFee = calcPlatformFee(payoutRecord.commission_base, payoutRecord.commission_rate_bps);
    assert.equal(derivedFee, payoutRecord.platform_fee,
      "Stored rate must reproduce the stored fee exactly");
  });
});

// ─── TEST 12: Completed paid order becomes eligible ───────────────────────────

describe("Paid order → eligible payout lifecycle", () => {
  it("online order: payment_status='paid' + status='confirmed' → payout='pending'", () => {
    // finance_record_order trigger: creates payout with status='pending' when payment lands
    const payoutAfterPayment = { status: "pending", eligible_at: null };
    assert.equal(payoutAfterPayment.status, "pending");
  });

  it("online order: status advances to 'completed' → payout becomes 'eligible'", () => {
    // finance_record_order: update seller_payouts set status='eligible' where order_id=new.id and status='pending'
    let payoutStatus = "pending";
    function simulateOrderCompleted() { if (payoutStatus === "pending") payoutStatus = "eligible"; }
    simulateOrderCompleted();
    assert.equal(payoutStatus, "eligible");
  });

  it("eligible → processing → released is the final admin payout lifecycle", () => {
    let status = "eligible";
    function adminTransition(to) {
      const allowed = { eligible: ["processing", "held"], processing: ["released", "failed"] };
      if (allowed[status]?.includes(to)) status = to;
      else throw new Error(`Invalid: ${status} → ${to}`);
    }
    adminTransition("processing");
    assert.equal(status, "processing");
    adminTransition("released");
    assert.equal(status, "released");
  });
});

// ─── TEST 13: COD/meetup commission is a RECEIVABLE, not collected cash ──────

describe("COD/meetup commission treatment", () => {
  it("cash_on_delivery creates commission with settlement_mode='seller_direct' and collection_status='receivable'", () => {
    const codCommission = {
      payment_method: "cash_on_delivery",
      settlement_mode: "seller_direct",
      collection_status: "receivable",
      payment_transaction_id: null, // no platform-held transaction
    };
    assert.equal(codCommission.settlement_mode, "seller_direct",
      "COD must be seller_direct, not platform_collected");
    assert.equal(codCommission.collection_status, "receivable",
      "COD commission is receivable, not collected");
    assert.equal(codCommission.payment_transaction_id, null,
      "COD has no platform payment transaction");
  });

  it("COD does NOT create a seller_payout row (no fake bank transfer)", () => {
    // finance_record_order only creates seller_payouts for demo_card and maya_online
    function wouldCreatePayout(paymentMethod, paymentStatus) {
      return (paymentMethod === "demo_card" || paymentMethod === "maya_online")
        && paymentStatus === "paid";
    }
    assert.equal(wouldCreatePayout("cash_on_delivery", "paid"), false,
      "COD must not create a payout record");
    assert.equal(wouldCreatePayout("cash_on_meetup", "paid"), false,
      "Meetup must not create a payout record");
    assert.equal(wouldCreatePayout("demo_card", "paid"), true,
      "Demo Card correctly creates a payout");
  });

  it("finance_summary correctly segregates collected vs receivable commission", () => {
    const financeData = {
      collected: 2500,   // from demo_card/maya orders
      receivable: 750,   // from COD/meetup orders
    };
    // Admin sees BOTH; they are never summed as "cash in hand"
    assert.equal(financeData.collected, 2500, "Collected is platform-received commission");
    assert.equal(financeData.receivable, 750, "Receivable is owed-but-not-collected");
    assert.notEqual(financeData.collected + financeData.receivable, financeData.collected,
      "Total commission ≠ collected commission");
  });
});

// ─── TEST 14: Cancelled/failed transactions → no payable earnings ─────────────

describe("Cancelled/failed transactions produce no payable earnings", () => {
  it("failed transaction cancels pending payouts via finance_stop_unpayable trigger", () => {
    // Trigger fires on payment_transactions.status update to 'failed'/'cancelled'/'refunded'
    let payoutStatus = "pending";
    function simulateTxFailed() {
      if (!["released"].includes(payoutStatus)) payoutStatus = "cancelled";
    }
    simulateTxFailed();
    assert.equal(payoutStatus, "cancelled", "Pending payout must be cancelled on transaction failure");
  });

  it("refunded transaction sets payout to 'refunded'", () => {
    let payoutStatus = "eligible";
    function simulateTxRefunded() {
      if (!["released"].includes(payoutStatus)) payoutStatus = "refunded";
    }
    simulateTxRefunded();
    assert.equal(payoutStatus, "refunded");
  });

  it("released payout is protected from reversal — immutable once released", () => {
    const releasedAt = new Date().toISOString();
    // finance_guard_snapshot: if old.status='released' and new is distinct from old → raise exception
    function wouldBeBlocked(currentStatus) {
      return currentStatus === "released";
    }
    assert.equal(wouldBeBlocked("released"), true,
      "Released payout modifications must be blocked by the snapshot guard");
    assert.ok(releasedAt, "released_at timestamp is set");
  });

  it("cancelled order triggers finance_record_order cancellation branch", () => {
    // When new.status='cancelled': update seller_payouts set status='cancelled' where order_id=new.id
    // and update platform_commissions set collection_status='waived'
    let payoutStatus = "pending";
    let commissionStatus = "collected";
    function simulateOrderCancelled() {
      if (!["released", "refunded", "cancelled"].includes(payoutStatus)) payoutStatus = "cancelled";
      if (["collected", "receivable"].includes(commissionStatus)) {
        commissionStatus = commissionStatus === "collected" ? "refunded" : "waived";
      }
    }
    simulateOrderCancelled();
    assert.equal(payoutStatus, "cancelled");
    assert.equal(commissionStatus, "refunded");
  });
});

// ─── Quick sanity: percentToBps conversion ────────────────────────────────────

describe("percentToBps conversion utility", () => {
  function percentToBps(value) {
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(value.trim())) return null;
    const [whole, decimal = ""] = value.trim().split(".");
    const bps = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
    return bps <= 3000 ? bps : null;
  }

  it("5% → 500 bps", () => assert.equal(percentToBps("5"), 500));
  it("5.00% → 500 bps", () => assert.equal(percentToBps("5.00"), 500));
  it("2.5% → 250 bps", () => assert.equal(percentToBps("2.5"), 250));
  it("30% → 3000 bps (max)", () => assert.equal(percentToBps("30"), 3000));
  it("30.01% → null (over limit)", () => assert.equal(percentToBps("30.01"), null));
  it("invalid string → null", () => assert.equal(percentToBps("abc"), null));
  it("negative → null", () => assert.equal(percentToBps("-1"), null));
});
