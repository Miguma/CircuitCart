"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  Package,
  ShoppingBag,
  MapPin,
  Calendar,
  Clock,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  User,
  CreditCard,
  Send,
  Sparkles,
} from "lucide-react";
import {
  type SellerOrder,
  type OrderStatus,
} from "@/lib/seller/seller-data";
import { toast } from "sonner";

interface SellerOrderDetailDrawerProps {
  order: SellerOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus, trackingNo?: string) => void;
  onCancelOrder: (orderId: string, reason: string) => void;
}

export function SellerOrderDetailDrawer({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onCancelOrder,
}: SellerOrderDetailDrawerProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("Out of stock");
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("J&T Express");

  if (!isOpen || !order) return null;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/70 border border-amber-500/30 text-amber-300">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending Confirmation
          </span>
        );
      case "Confirmed":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-950/70 border border-blue-500/30 text-blue-300">
            Confirmed
          </span>
        );
      case "Packed":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#45284f] border border-[#e59bc9]/30 text-[#e59bc9]">
            Packed
          </span>
        );
      case "Ready for Dispatch":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-sky-950/70 border border-sky-500/30 text-sky-300">
            <Truck className="size-3" />
            Ready for Dispatch
          </span>
        );
      case "Shipped":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-sky-950/70 border border-sky-500/30 text-sky-300">
            <Truck className="size-3" />
            Shipped
          </span>
        );
      case "Ready for Meetup":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-950/70 border border-purple-500/30 text-purple-300">
            <MapPin className="size-3" />
            Ready for Meetup
          </span>
        );
      case "Delivered":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
            Delivered
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
            <CheckCircle2 className="size-3.5" />
            Completed
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-950/70 border border-rose-500/30 text-rose-300">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white">
            {status}
          </span>
        );
    }
  };

  // Lifecycle Timeline Steps
  const deliveryStages: { key: OrderStatus; label: string; time?: string }[] = [
    { key: "Pending", label: "Order Placed", time: order.placedAt },
    { key: "Confirmed", label: "Confirmed", time: order.confirmedAt },
    { key: "Packed", label: "Packed", time: order.packedAt },
    { key: "Ready for Dispatch", label: "Ready for Dispatch", time: order.shippedAt },
    { key: "Shipped", label: "Shipped", time: order.shippedAt },
    { key: "Completed", label: "Completed", time: order.completedAt },
  ];

  const meetupStages: { key: OrderStatus; label: string; time?: string }[] = [
    { key: "Pending", label: "Order Placed", time: order.placedAt },
    { key: "Confirmed", label: "Confirmed", time: order.confirmedAt },
    { key: "Packed", label: "Packed", time: order.packedAt },
    { key: "Ready for Meetup", label: "Ready for Meetup", time: order.shippedAt },
    { key: "Completed", label: "Completed", time: order.completedAt },
  ];

  const activeStages =
    order.fulfillmentMethod === "Meetup" ? meetupStages : deliveryStages;

  const stageOrder = [
    "Pending",
    "Confirmed",
    "Packed",
    "Ready for Dispatch",
    "Ready for Meetup",
    "Shipped",
    "Delivered",
    "Completed",
  ];

  const currentIndex = stageOrder.indexOf(order.status);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-xl h-full bg-[#1c121e]/95 backdrop-blur-2xl border-l border-white/[0.08] text-[#fffafa] shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300 overflow-hidden">
        {/* ======================================================= */}
        {/* 1. TOP DRAWER HEADER                                    */}
        {/* ======================================================= */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0 bg-[#241728]/50">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-mono font-extrabold text-[#fffafa] tracking-tight">
                {order.orderNumber}
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#65486f]/50 border border-[#e59bc9]/30 text-[#e59bc9]">
                {order.fulfillmentMethod}
              </span>
            </div>
            <p className="text-xs text-[#b9adb6] mt-1 flex items-center gap-1.5">
              <Clock className="size-3.5 text-[#e59bc9]" />
              <span>Placed {order.placedAt}</span>
            </p>
          </div>

          <button
            type="button"
            aria-label="Close order detail drawer"
            onClick={onClose}
            className="size-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-[#b9adb6] hover:text-[#fffafa] transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ======================================================= */}
        {/* 2. SCROLLABLE DRAWER CONTENT                            */}
        {/* ======================================================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* ACTION BAR: Context-aware next lifecycle buttons */}
          <div className="p-4 rounded-2xl bg-[#281827] border border-[#e59bc9]/20 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#b9adb6] uppercase tracking-wider">
                Current Status
              </span>
              {getStatusBadge(order.status)}
            </div>

            {/* CONTEXTUAL NEXT ACTION BUTTONS */}
            {order.status === "Pending" && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, "Confirmed")}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold shadow-xs transition-colors text-center cursor-pointer"
                >
                  Confirm Order
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-xs font-bold text-rose-300 transition-colors cursor-pointer"
                >
                  Cancel Order
                </button>
              </div>
            )}

            {order.status === "Confirmed" && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, "Packed")}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold shadow-xs transition-colors text-center cursor-pointer"
                >
                  Start Packing (Mark as Preparing)
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-xs font-bold text-rose-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {order.status === "Packed" && order.fulfillmentMethod === "Delivery" && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, "Ready for Dispatch")}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Truck className="size-4" />
                  <span>Mark Packed & Ready for Dispatch</span>
                </button>
              </div>
            )}

            {order.status === "Packed" && order.fulfillmentMethod === "Meetup" && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, "Ready for Meetup")}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapPin className="size-4" />
                  <span>Mark Ready for Meetup</span>
                </button>
              </div>
            )}

            {order.status === "Ready for Dispatch" && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowTrackingModal(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-900/80 hover:bg-sky-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Truck className="size-4" />
                  <span>Dispatch & Mark as Shipped</span>
                </button>
              </div>
            )}

            {order.status === "Shipped" && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, "Completed")}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="size-4" />
                  <span>Mark Order as Delivered & Completed</span>
                </button>
              </div>
            )}

            {order.status === "Ready for Meetup" && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, "Completed")}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="size-4" />
                  <span>Confirm Meetup Handover & Complete</span>
                </button>
              </div>
            )}

            {order.status === "Completed" && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span>
                  This order is fulfilled. Funds have been released to your shop wallet.
                </span>
              </div>
            )}

            {order.status === "Cancelled" && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Order Cancelled</span>
                </div>
                {order.cancelReason && (
                  <p className="text-[11px] text-rose-300/80">
                    Reason: {order.cancelReason}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* VISUAL ORDER TIMELINE */}
          <div className="p-4 rounded-2xl bg-[#1e1322]/80 border border-white/[0.08] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#b9adb6]">
              Order Lifecycle Timeline
            </h3>

            <div className="relative pl-6 space-y-4 border-l-2 border-white/10 ml-2 py-1">
              {activeStages.map((stage, idx) => {
                const isPast =
                  currentIndex >= 0 &&
                  stageOrder.indexOf(stage.key) <= currentIndex &&
                  order.status !== "Cancelled";
                const isCurrent =
                  order.status === stage.key && order.status !== "Cancelled";

                return (
                  <div key={stage.key} className="relative">
                    {/* Circle Node */}
                    <div
                      className={`absolute -left-[31px] top-0.5 size-4 rounded-full border-2 flex items-center justify-center ${
                        isCurrent
                          ? "border-[#e59bc9] bg-[#e59bc9] ring-4 ring-[#e59bc9]/20"
                          : isPast
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-white/20 bg-[#1c121e]"
                      }`}
                    >
                      {isPast && !isCurrent && (
                        <CheckCircle2 className="size-3 text-[#19131b]" />
                      )}
                    </div>

                    <div>
                      <p
                        className={`text-xs font-bold ${
                          isCurrent
                            ? "text-[#e59bc9]"
                            : isPast
                            ? "text-[#fffafa]"
                            : "text-[#8f7d8c]"
                        }`}
                      >
                        {stage.label}
                      </p>
                      {stage.time && (
                        <p className="text-[10px] text-[#b9adb6] mt-0.5">
                          {stage.time}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ITEMS PURCHASED */}
          <div className="p-4 rounded-2xl bg-[#1e1322]/80 border border-white/[0.08] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#b9adb6]">
              Items ({order.items.length})
            </h3>

            <div className="divide-y divide-white/[0.06]">
              {order.items.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div className="size-12 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold shrink-0">
                    <Package className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-[#fffafa] leading-snug">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-[#b9adb6] mt-0.5">
                      Condition:{" "}
                      <span className="text-[#e59bc9] font-medium">
                        {item.condition}
                      </span>{" "}
                      &bull; Qty: {item.quantity}
                    </p>
                    <p className="text-[11px] text-[#8f7d8c] truncate mt-0.5">
                      {item.specs}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-bold text-[#fffafa]">
                      ₱{item.totalPrice.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[#8f7d8c]">
                      ₱{item.unitPrice.toLocaleString()} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BUYER INFORMATION */}
          <div className="p-4 rounded-2xl bg-[#1e1322]/80 border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#b9adb6]">
                Buyer Profile
              </h3>
              <Link
                href="/seller/messages"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#e59bc9] hover:text-white transition-colors"
              >
                <MessageSquare className="size-3.5" />
                <span>Message Buyer</span>
              </Link>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="size-10 rounded-full bg-[#3d2743] border border-[#e59bc9]/30 flex items-center justify-center text-[#e59bc9] font-bold text-sm shrink-0">
                {order.buyer.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-[#fffafa]">
                    {order.buyer.name}
                  </h4>
                  <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-0.5">
                    ★ {order.buyer.rating}
                  </span>
                </div>
                <p className="text-[11px] text-[#b9adb6]">
                  {order.buyer.location} &bull; Member since {order.buyer.memberSince}
                </p>
              </div>
            </div>
          </div>

          {/* FULFILLMENT / SHIPPING / MEETUP DETAILS */}
          <div className="p-4 rounded-2xl bg-[#1e1322]/80 border border-white/[0.08] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#b9adb6]">
              {order.fulfillmentMethod === "Delivery"
                ? "Delivery Details"
                : "Meetup Coordinates"}
            </h3>

            {order.fulfillmentMethod === "Delivery" && order.deliveryDetails && (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#8f7d8c] block text-[11px]">
                    Recipient & Contact
                  </span>
                  <p className="font-semibold text-[#fffafa]">
                    {order.deliveryDetails.recipient} ({order.deliveryDetails.phone})
                  </p>
                </div>

                <div>
                  <span className="text-[#8f7d8c] block text-[11px]">
                    Shipping Address
                  </span>
                  <p className="font-medium text-[#d6cbd5] leading-relaxed">
                    {order.deliveryDetails.address}
                  </p>
                </div>

                {order.deliveryDetails.courier && (
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[#8f7d8c] block text-[11px]">
                        Courier
                      </span>
                      <p className="font-bold text-[#fffafa]">
                        {order.deliveryDetails.courier}
                      </p>
                    </div>
                    {order.deliveryDetails.trackingNumber && (
                      <div className="text-right">
                        <span className="text-[#8f7d8c] block text-[11px]">
                          Tracking #
                        </span>
                        <p className="font-mono font-bold text-[#e59bc9]">
                          {order.deliveryDetails.trackingNumber}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {order.fulfillmentMethod === "Meetup" && order.meetupDetails && (
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 text-[#e59bc9] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#8f7d8c] block text-[11px]">
                      Meetup Spot
                    </span>
                    <p className="font-bold text-[#fffafa]">
                      {order.meetupDetails.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#d6cbd5]">
                    <Calendar className="size-3.5 text-[#e59bc9]" />
                    <span>{order.meetupDetails.preferredDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#d6cbd5]">
                    <Clock className="size-3.5 text-[#e59bc9]" />
                    <span>{order.meetupDetails.preferredTime}</span>
                  </div>
                </div>

                {order.meetupDetails.buyerNotes && (
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] mt-2">
                    <span className="text-[10px] uppercase font-bold text-[#8f7d8c] block">
                      Buyer Notes
                    </span>
                    <p className="text-xs text-[#b9adb6] italic mt-0.5">
                      &ldquo;{order.meetupDetails.buyerNotes}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PAYMENT & TOTALS */}
          <div className="p-4 rounded-2xl bg-[#1e1322]/80 border border-white/[0.08] space-y-2.5 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-[#b9adb6] mb-2">
              Payment Summary
            </h3>

            <div className="flex items-center justify-between text-[#b9adb6]">
              <span>Items Subtotal</span>
              <span className="font-semibold text-[#fffafa]">
                ₱{order.subtotal.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-[#b9adb6]">
              <span>Shipping Fee</span>
              <span className="font-semibold text-[#fffafa]">
                {order.shippingFee === 0
                  ? "Free (Meetup)"
                  : `₱${order.shippingFee.toLocaleString()}`}
              </span>
            </div>

            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-sm font-bold text-[#fffafa]">
              <span>Total Amount</span>
              <span className="text-base text-[#e59bc9]">
                ₱{order.total.toLocaleString()}
              </span>
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px] text-[#b9adb6]">
              <span className="flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-[#e59bc9]" />
                <span>{order.paymentMethod}</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                  order.paymentStatus === "Paid"
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/20"
                    : "bg-amber-950/60 text-amber-300 border border-amber-500/20"
                }`}
              >
                {order.paymentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 3. MODALS (Cancel Order & Tracking Number)              */}
        {/* ======================================================= */}

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
              onClick={() => setShowCancelModal(false)}
            />
            <div className="relative w-full max-w-md bg-[#241728] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="size-5" />
                <h3 className="text-base font-bold text-[#fffafa]">
                  Cancel Order {order.orderNumber}?
                </h3>
              </div>
              <p className="text-xs text-[#b9adb6] leading-relaxed">
                Cancelling this order will immediately notify the buyer and initiate an escrow refund.
              </p>

              <div>
                <label className="text-xs font-semibold text-[#fffafa] block mb-1">
                  Reason for Cancellation
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                >
                  <option value="Out of stock">Item is out of stock</option>
                  <option value="Hardware defect discovered">Hardware defect discovered during test</option>
                  <option value="Unable to meet at location">Unable to coordinate meetup/shipping</option>
                  <option value="Buyer requested cancellation">Buyer requested cancellation</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#b9adb6] hover:text-white hover:bg-white/5 transition-colors"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCancelOrder(order.id, cancelReason);
                    setShowCancelModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tracking Number Modal */}
        {showTrackingModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
              onClick={() => setShowTrackingModal(false)}
            />
            <div className="relative w-full max-w-md bg-[#241728] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-sky-400">
                <Truck className="size-5" />
                <h3 className="text-base font-bold text-[#fffafa]">
                  Dispatch & Shipping Details
                </h3>
              </div>
              <p className="text-xs text-[#b9adb6]">
                Provide courier details so the buyer can track delivery progress.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1">
                    Courier Service
                  </label>
                  <select
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                  >
                    <option value="J&T Express">J&T Express</option>
                    <option value="LBC Express">LBC Express</option>
                    <option value="Lalamove Tech Care">Lalamove Same-Day</option>
                    <option value="Maxim Delivery">Maxim Delivery</option>
                    <option value="Flash Express">Flash Express</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1">
                    Tracking Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. JT-CEB-994820"
                    className="w-full h-9 px-3.5 rounded-xl bg-[#342339] border border-white/10 text-xs font-mono text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTrackingModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#b9adb6] hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateStatus(
                      order.id,
                      "Shipped",
                      trackingNumber || `${courierName.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`
                    );
                    setShowTrackingModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
                >
                  Mark as Shipped
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
