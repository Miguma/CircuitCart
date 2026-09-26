import Link from "next/link";
import type { OnlineCheckout } from "@/lib/checkout/online-contract";

export function OnlinePaymentStage({ checkout, onCancel, onRefresh, busy }: {
  checkout: OnlineCheckout; onCancel?: () => void; onRefresh?: () => void; busy?: boolean;
}) {
  const awaiting = ["created", "pending", "authorized"].includes(checkout.paymentStatus);
  const unavailable = checkout.hasCancelledOrders || !awaiting;
  const [whole, cents] = checkout.amount.split(".");
  return (
    <section aria-labelledby="payment-stage-title" className="mb-6 rounded-3xl border border-[#e59bc9]/30 bg-[#241c27] p-6 sm:p-8 space-y-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[#e59bc9]">Maya Online · Foundation preview</p>
      <h2 id="payment-stage-title" className="text-2xl font-bold text-[#fffafa]">{unavailable ? "Payment Status" : "Payment Required"}</h2>
      <dl className="space-y-2 text-sm text-[#b9adb6]">
        <div className="flex justify-between gap-4"><dt>Authoritative order total</dt><dd className="text-xl font-bold text-[#fffafa]">₱{whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.{cents}</dd></div>
        <div className="flex justify-between gap-4"><dt>Payment status</dt><dd>{!awaiting ? checkout.paymentStatus : checkout.hasCancelledOrders ? "Checkout needs review — an order was cancelled" : "Awaiting Payment"}</dd></div>
        <div className="flex justify-between gap-4"><dt>Seller orders</dt><dd>{checkout.orderIds.length}</dd></div>
      </dl>
      {awaiting && <p className="text-sm text-amber-200">Reservation ends {new Date(checkout.expiresAt).toLocaleString()}. Unpaid reservations last 20 minutes.</p>}
      {checkout.inventoryReleasedAt && <p className="text-sm text-[#b9adb6]">Reservation released. Available product stock has been restored; no payment was processed by this checkout.</p>}
      <p className="text-sm text-[#b9adb6]">Online payment processing is not connected yet. This checkout does not confirm payment, and this screen cannot charge you. Do not send money based on this preview.</p>
      <button type="button" disabled className="rounded-xl bg-[#65486f]/50 px-5 py-3 text-sm font-bold text-white/50 cursor-not-allowed">Continue to Secure Payment — unavailable</button>
      <div className="flex flex-wrap gap-4 text-sm text-[#e59bc9]">
        {onRefresh && <button type="button" disabled={busy} onClick={onRefresh} className="underline disabled:opacity-50">Refresh payment status</button>}
        {checkout.paymentStatus === "created" && onCancel && <button type="button" disabled={busy} onClick={onCancel} className="underline disabled:opacity-50">Cancel this unpaid checkout</button>}
      </div>
      <div className="flex flex-wrap gap-3">
        {checkout.orderIds.map((id, index) => <Link key={id} href="/marketplace/orders" className="text-sm text-[#e59bc9] underline">View order {index + 1} ({id.slice(0, 8)})</Link>)}
      </div>
      <p className="break-all text-xs text-[#b9adb6]">Checkout reference: {checkout.paymentTransactionId}</p>
    </section>
  );
}
