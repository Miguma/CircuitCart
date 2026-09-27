import { z } from "zod";

export const financialReceipt = z.object({
  success: z.literal(true), status: z.literal("paid"),
  paymentTransactionId: z.uuid(), orderIds: z.array(z.uuid()).min(1),
});

export function matchesFinancialReceipt(value: unknown, transactionId: string, expectedOrders: string[]) {
  const parsed = financialReceipt.safeParse(value);
  return parsed.success && parsed.data.paymentTransactionId === transactionId &&
    expectedOrders.length > 0 && new Set(expectedOrders).size === expectedOrders.length &&
    parsed.data.orderIds.length === expectedOrders.length &&
    new Set(parsed.data.orderIds).size === expectedOrders.length &&
    parsed.data.orderIds.every((id) => expectedOrders.includes(id));
}

export function percentToBps(value: string): number | null {
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, decimal = ""] = value.trim().split(".");
  const bps = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return bps <= 3000 ? bps : null;
}

export const payoutAccountInput = z.object({
  bankName: z.string().trim().min(2).max(100),
  accountName: z.string().trim().min(2).max(150),
  accountNumber: z.string().trim().regex(/^\d{6,34}$/),
});

export const payoutActions: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: "held", label: "Hold" }],
  eligible: [{ status: "held", label: "Hold" }],
  held: [{ status: "eligible", label: "Restore / resume" }],
  processing: [{ status: "released", label: "Mark released (simulated)" }, { status: "held", label: "Hold" }, { status: "failed", label: "Mark failed" }],
};
