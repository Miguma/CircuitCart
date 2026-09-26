"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Package,
  Clock,
  Truck,
  MapPin,
  Store,
  Loader2,
  ShieldCheck,
  MessageSquare,
  Star,
  Copy,
  Check,
} from "lucide-react";
import {
  getBuyerOrders,
  cancelBuyerOrder,
  formatOrderReference,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel,
  getPaymentExplanation,
} from "@/lib/supabase/orders";
import { getOrCreateOrderConversation } from "@/lib/supabase/messages";
import { getOrderReviews, getOrderItemReview } from "@/lib/supabase/reviews";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { OrderWithItems, DbOrderItem, DbReview } from "@/lib/supabase/types";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { toast } from "sonner";
import { OrdersHeader } from "@/components/orders/orders-header";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";

type OrderFilter = "All" | "Pending" | "Processing" | "Shipped" | "Completed" | "Cancelled";

export default function OrdersPage() {
  const router = useRouter();
  const { userId, isLoading: isAccountLoading } = useMarketplaceAccount();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isAccountLoading && !userId) {
      router.replace("/login?redirectTo=/marketplace/orders");
    }
  }, [isAccountLoading, userId, router]);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("All");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [messagingOrderId, setMessagingOrderId] = useState<string | null>(null);
  const [itemReviews, setItemReviews] = useState<Record<string, DbReview>>({});
  const [selectedReviewItem, setSelectedReviewItem] = useState<{
    item: DbOrderItem;
    existingReview?: DbReview | null;
  } | null>(null);
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

  const handleCopyTracking = (trackingNo: string) => {
    navigator.clipboard.writeText(trackingNo);
    setCopiedTrackingId(trackingNo);
    toast.success(`Tracking number "${trackingNo}" copied!`);
    setTimeout(() => setCopiedTrackingId(null), 2500);
  };

  const filters: OrderFilter[] = [
    "All",
    "Pending",
    "Processing",
    "Shipped",
    "Completed",
    "Cancelled",
  ];

  const fetchCompletedOrderReviews = async (orderList: OrderWithItems[]) => {
    const completedOrders = orderList.filter((o) => o.status === "completed");
    if (completedOrders.length === 0) return;

    try {
      const results = await Promise.all(
        completedOrders.map((o) => getOrderReviews(o.id).catch(() => []))
      );
      const reviewsMap: Record<string, DbReview> = {};
      for (const orderReviewList of results) {
        for (const rev of orderReviewList) {
          reviewsMap[rev.order_item_id] = rev;
        }
      }
      setItemReviews((prev) => ({ ...prev, ...reviewsMap }));
    } catch (err) {
      console.warn("Failed to load reviews for completed orders:", err);
    }
  };

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getBuyerOrders()
      .then((data) => {
        if (active) {
          setOrders(data);
          setIsLoading(false);
          fetchCompletedOrderReviews(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load buyer orders:", err);
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const handleReviewSuccess = async (orderItemId: string) => {
    try {
      const updatedReview = await getOrderItemReview(orderItemId);
      if (updatedReview) {
        setItemReviews((prev) => ({
          ...prev,
          [orderItemId]: updatedReview,
        }));
      }
    } catch (err) {
      console.warn("Failed to refresh review status:", err);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const order = orders.find((entry) => entry.id === orderId);
    const onlineTransactionId = order?.payment_method === "maya_online" ? order.payment_transaction_id : null;
    if (!confirm(onlineTransactionId
      ? "Cancel the entire unpaid online checkout, including all seller orders, and release reserved stock?"
      : "Are you sure you want to cancel this pending order? Product stock will be returned.")) {
      return;
    }

    setCancellingOrderId(orderId);
    try {
      await cancelBuyerOrder(orderId, "Cancelled by buyer");
      toast.success("Order cancelled successfully.");
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId || (onlineTransactionId && o.payment_transaction_id === onlineTransactionId) ? { ...o, status: "cancelled" } : o))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel order.";
      toast.error(msg);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleMessageSeller = async (orderId: string) => {
    if (messagingOrderId) return;
    setMessagingOrderId(orderId);

    try {
      const convId = await getOrCreateOrderConversation(orderId);
      router.push(`/marketplace/messages?conversationId=${convId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open conversation.";
      toast.error(msg);
      setMessagingOrderId(null);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(price);

  // Status mapping for filter tabs
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Pending") return order.status === "pending";
      if (activeFilter === "Processing")
        return order.status === "confirmed" || order.status === "preparing";
      if (activeFilter === "Shipped")
        return order.status === "ready" || order.status === "shipped";
      if (activeFilter === "Completed") return order.status === "completed";
      if (activeFilter === "Cancelled") return order.status === "cancelled";
      return true;
    });
  }, [orders, activeFilter]);

  if (isAccountLoading || !userId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
        <p className="text-sm text-[#b9adb6]">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <OrdersHeader view="purchases" count={orders.length} isLoading={isLoading} />

      {/* Filter Tabs */}
      <div
        role="group"
        aria-label="Purchase status filter"
        className="flex flex-wrap items-center gap-1.5"
      >
        {filters.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer ${
                isActive
                  ? "bg-[#65486f] text-white border-white/20 shadow-xs"
                  : "bg-[#241c27] border-white/10 text-[#b9adb6] hover:bg-[#342339] hover:text-white"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Orders List vs Loading vs Empty State */}
      {isLoading ? (
        <div className="w-full bg-[#241c27] border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-7 text-[#e59bc9] animate-spin" />
          <span className="text-sm font-semibold text-[#d6cbd5]">
            Loading your purchases...
          </span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-[#241c27] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-xl my-4 min-h-[230px] sm:min-h-[280px] flex flex-col items-center justify-center">
          <div className="size-12 sm:size-14 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
            <Package className="size-6 sm:size-7 stroke-[1.5]" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {activeFilter === "All" ? "No purchases yet" : `No ${activeFilter.toLowerCase()} purchases`}
          </h2>
          <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
            {activeFilter === "All"
              ? "Your orders from other sellers will appear here, with delivery updates and order receipts."
              : `You do not have any orders currently in "${activeFilter}" status.`}
          </p>
          <div className="pt-2">
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-white rounded-xl transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              Browse marketplace
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => {
            const sellerName =
              order.shops?.name || order.seller?.full_name || "CircuitCart Seller";
            const dateStr = new Date(order.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={order.id}
                className="bg-[#241c27] border border-white/10 rounded-3xl p-5 sm:p-7 space-y-5 shadow-xl transition-all"
              >
                {/* Order Top Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white tracking-wide">
                        {formatOrderReference(order.id)}
                      </span>
                      <span className="text-xs text-[#b9adb6]">· Placed {dateStr}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#d6cbd5]">
                      <Store className="size-3.5 text-[#e59bc9]" />
                      <span>
                        Sold by <strong>{sellerName}</strong>
                      </span>
                      {order.shops?.is_verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.2 rounded-md">
                          <ShieldCheck className="size-3" />
                          Verified Shop
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    <OrderStatusBadge status={order.status} />

                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[#342339] text-[#e59bc9] border border-white/10 flex items-center gap-1">
                      {order.delivery_method === "delivery" ? (
                        <>
                          <Truck className="size-3.5" />
                          <span>Delivery</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="size-3.5" />
                          <span>Meetup</span>
                        </>
                      )}
                    </span>

                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[#241c27] text-[#d6cbd5] border border-white/10 flex items-center gap-1.5">
                      <span>{formatPaymentMethodLabel(order.payment_method, true)}</span>
                      <span className="text-[#8f7d8c]">&bull;</span>
                      <span
                        className={`font-semibold ${
                          order.payment_status === "paid"
                            ? "text-emerald-400"
                            : order.payment_status === "failed"
                            ? "text-rose-400"
                            : order.payment_status === "refunded"
                            ? "text-purple-400"
                            : "text-amber-400"
                        }`}
                      >
                        {formatPaymentStatusLabel(order.payment_status, order.payment_method)}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Items Snapshot Grid */}
                <div className="space-y-3">
                  {order.order_items.map((item) => {
                    const review = itemReviews[item.id];
                    const isOrderCompleted = order.status === "completed";

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 bg-[#1e1322]/80 border border-white/[0.06] rounded-2xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-14 rounded-xl overflow-hidden bg-[#ebe2e5] border border-[#ded0d5] flex items-center justify-center shrink-0 p-1">
                            {item.product_image_path ? (
                              <Image
                                src={getProductImageUrl(item.product_image_path)}
                                alt={item.product_title}
                                width={56}
                                height={56}
                                className="size-full object-contain"
                              />
                            ) : (
                              <Package className="size-6 text-[#65486f]" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                              {item.product_title}
                            </h4>
                            <span className="text-xs text-[#b9adb6]">
                              Qty: {item.quantity} × {formatPrice(Number(item.unit_price))}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-white/[0.06] pt-2 sm:pt-0">
                          <span className="text-xs sm:text-sm font-bold text-[#e59bc9]">
                            {formatPrice(Number(item.line_total))}
                          </span>

                          {isOrderCompleted && (
                            review ? (
                              <button
                                type="button"
                                onClick={() => setSelectedReviewItem({ item, existingReview: review })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 transition-colors cursor-pointer"
                              >
                                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                <span>Edit Review ({review.rating}★)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedReviewItem({ item, existingReview: null })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white/[0.06] hover:bg-white/10 text-white border border-white/15 transition-colors cursor-pointer hover:border-[#e59bc9]/50"
                              >
                                <Star className="size-3.5 text-[#e59bc9]" />
                                <span>Write Review</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Delivery details & Footer */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-white/10">
                  <div className="text-xs text-[#b9adb6] space-y-2 max-w-md">
                    {/* Fulfillment Details */}
                    {order.delivery_method === "delivery" ? (
                      <div className="space-y-1">
                        {order.shipping_address && (
                          <p>
                            Deliver to: <span className="text-white font-medium">{order.shipping_name}</span>{" "}
                            ({order.shipping_address})
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {order.courier_name ? (
                            <span className="text-[#d6cbd5]">
                              Courier: <strong className="text-white font-medium">{order.courier_name}</strong>
                            </span>
                          ) : (
                            <span className="text-[#8f7d8c] italic">Courier not assigned yet.</span>
                          )}

                          {order.tracking_number && (
                            <span className="inline-flex items-center gap-1 font-mono text-xs bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded-lg text-[#e59bc9]">
                              <span>Tracking: {order.tracking_number}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyTracking(order.tracking_number!)}
                                className="p-0.5 hover:text-white transition-colors cursor-pointer"
                                title="Copy tracking number"
                              >
                                {copiedTrackingId === order.tracking_number ? (
                                  <Check className="size-3 text-emerald-400" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p>
                          Meetup Location:{" "}
                          <span className="text-white font-medium">
                            {order.shipping_address || "Cebu City"}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#8f7d8c]">
                          Coordinate exact meetup time and spot with seller via chat.
                        </p>
                      </div>
                    )}

                    {/* Payment Details & Explanation */}
                    <div className="pt-1.5 border-t border-white/[0.06] space-y-0.5">
                      <p>
                        Payment:{" "}
                        <span className="text-white font-medium">
                          {formatPaymentMethodLabel(order.payment_method)}
                        </span>
                        <span
                          className={`ml-1.5 font-semibold ${
                            order.payment_status === "paid"
                              ? "text-emerald-400"
                              : order.payment_status === "failed"
                              ? "text-rose-400"
                              : order.payment_status === "refunded"
                              ? "text-purple-400"
                              : "text-amber-400"
                          }`}
                        >
                          ({formatPaymentStatusLabel(order.payment_status, order.payment_method)})
                        </span>
                      </p>
                      <p className="text-[11px] text-[#8f7d8c]">
                        {order.payment_method === "maya_online" && order.status === "cancelled" && order.payment_status === "pending"
                          ? "This unpaid online checkout is closed. Its stock reservation has been released."
                          : getPaymentExplanation(order.payment_method, order.payment_status)}
                      </p>
                    </div>

                    {order.buyer_note && (
                      <p className="italic text-[#d6cbd5] pt-0.5">Note: &ldquo;{order.buyer_note}&rdquo;</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-xs text-[#b9adb6] block">Order Total</span>
                      <span className="text-base font-extrabold text-[#e59bc9]">
                        {formatPrice(Number(order.total))}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={messagingOrderId === order.id}
                        onClick={() => handleMessageSeller(order.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-white/[0.05] hover:bg-white/10 text-[#d6cbd5] hover:text-white border border-white/10 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        title="Chat with seller about this order"
                      >
                        {messagingOrderId === order.id ? (
                          <Loader2 className="size-3.5 animate-spin text-[#e59bc9]" />
                        ) : (
                          <MessageSquare className="size-3.5 text-[#e59bc9]" />
                        )}
                        <span>Message Seller</span>
                      </button>

                      {order.status === "pending" && (
                        <button
                          type="button"
                          disabled={cancellingOrderId === order.id}
                          onClick={() => handleCancelOrder(order.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {cancellingOrderId === order.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Cancel Order"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Policy Note */}
      <div className="flex items-center gap-3 p-4 bg-[#241c27] border border-white/10 rounded-2xl text-xs text-[#b9adb6]">
        <Clock className="size-4 text-[#e59bc9] shrink-0" />
        <span>
          CircuitCart verified receipts: Sellers update fulfillment status in real time upon confirmation and dispatch.
        </span>
      </div>

      {/* Write / Edit Review Modal */}
      <ReviewDialog
        isOpen={Boolean(selectedReviewItem)}
        onClose={() => setSelectedReviewItem(null)}
        orderItem={selectedReviewItem?.item ?? null}
        existingReview={selectedReviewItem?.existingReview ?? null}
        onSuccess={handleReviewSuccess}
      />
    </div>
  );
}
