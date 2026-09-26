import { z } from "zod";

// Only intent and fulfillment details cross this boundary, never financial authority.
export const onlineCheckoutInput = z.object({
  attemptId: z.uuid(),
  paymentMethod: z.literal("maya_online"),
  deliveryMethod: z.enum(["delivery", "meetup"]),
  shippingName: z.string().trim().max(150).optional(),
  shippingPhone: z.string().trim().max(50).optional(),
  shippingAddress: z.string().trim().max(1000).optional(),
  buyerNote: z.string().trim().max(1000).optional(),
}).strict().refine((input) => input.deliveryMethod !== "delivery" ||
  Boolean(input.shippingName && input.shippingPhone && input.shippingAddress), {
  message: "Recipient, phone and address are required for delivery.",
});

export const onlineCheckoutResult = z.object({
  paymentTransactionId: z.uuid(),
  attemptId: z.uuid(),
  orderIds: z.array(z.uuid()).min(1),
  // SQL NUMERIC travels as text. JS never calculates the payable amount.
  amount: z.string().regex(/^\d+\.\d{2}$/),
  currency: z.literal("PHP"),
  paymentStatus: z.enum(["created", "pending", "authorized", "paid", "failed", "cancelled", "expired", "refunded"]),
  hasCancelledOrders: z.boolean(),
  expiresAt: z.iso.datetime({ offset: true }),
  inventoryReleasedAt: z.iso.datetime({ offset: true }).nullable(),
});
export const onlineCheckoutAction = z.union([
  onlineCheckoutInput,
  z.object({ action: z.literal("recover"), attemptId: z.uuid().optional() }).strict(),
  z.object({ action: z.literal("cancel"), attemptId: z.uuid() }).strict(),
]);
export type OnlineCheckout = z.infer<typeof onlineCheckoutResult>;
export type OnlineCheckoutInput = z.infer<typeof onlineCheckoutInput>;
