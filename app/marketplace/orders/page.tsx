"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  ArrowLeft,
  Clock,
  Truck,
  MapPin,
  Store,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  getBuyerOrders,
  cancelBuyerOrder,
  formatOrderReference,
} from "@/lib/supabase/orders";
import { OrderWithItems } from "@/lib/supabase/types";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { toast } from "sonner";

type OrderFilter = "All" | "Pending" | "Processing" | "Shipped" | "Completed" | "Cancelled";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("All");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const filters: OrderFilter[] = [
    "All",
    "Pending",
    "Processing",
    "Shipped",
    "Completed",
    "Cancelled",
  ];

  useEffect(() => {
    let active = true;
    getBuyerOrders()
      .then((data) => {
        if (active) {
          setOrders(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load buyer orders:", err);
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this pending order? Product stock will be returned.")) {
      return;
    }

    setCancellingOrderId(orderId);
    try {
      await cancelBuyerOrder(orderId, "Cancelled by buyer");
      toast.success("Order cancelled successfully.");
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel order.";
      toast.error(msg);
    } finally {
      setCancellingOrderId(null);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return {
          label: "Pending Confirmation",
          className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        };
      case "confirmed":
        return {
          label: "Order Confirmed",
          className: "bg-sky-500/20 text-sky-300 border-sky-500/30",
        };
      case "preparing":
        return {
          label: "Preparing Package",
          className: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        };
      case "ready":
        return {
          label: "Ready for Pickup/Delivery",
          className: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        };
      case "shipped":
        return {
          label: "In Transit",
          className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        };
      case "completed":
        return {
          label: "Completed",
          className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        };
      case "cancelled":
        return {
          label: "Cancelled",
          className: "bg-rose-500/20 text-rose-300 border-rose-500/30",
        };
      default:
        return {
          label: status,
          className: "bg-white/10 text-white/80 border-white/20",
        };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[#b9adb6] mb-1">
          <Link
            href="/marketplace"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Marketplace</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            My Orders
          </h1>
          {orders.length > 0 && (
            <span className="px-2.5 py-0.5 text-xs font-bold bg-[#65486f] text-white rounded-full">
              {orders.length} orders
            </span>
          )}
        </div>
        <p className="text-xs text-[#b9adb6] mt-1">
          Track active shipments, meetup schedules, and historical marketplace receipts.
        </p>
      </div>

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Order status filter"
        className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none no-scrollbar"
      >
        {filters.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer ${
                isActive
                  ? "bg-[#65486f] text-white shadow-xs"
                  : "text-[#b9adb6] hover:bg-[#342339] hover:text-white"
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
            Loading your orders...
          </span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-[#241c27] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-xl my-4 min-h-[230px] sm:min-h-[280px] flex flex-col items-center justify-center">
          <div className="size-12 sm:size-14 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
            <Package className="size-6 sm:size-7 stroke-[1.5]" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} orders found
          </h2>
          <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
            {activeFilter === "All"
              ? "When you place orders on CircuitCart, track your delivery status and verified order receipts here."
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
            const statusBadge = getStatusBadge(order.status);
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

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full border ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>

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
                  </div>
                </div>

                {/* Items Snapshot Grid */}
                <div className="space-y-3">
                  {order.order_items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 p-3 bg-[#1e1322]/80 border border-white/[0.06] rounded-2xl"
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

                      <div className="text-right shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-[#e59bc9]">
                          {formatPrice(Number(item.line_total))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery details & Footer */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-white/10">
                  <div className="text-xs text-[#b9adb6] space-y-0.5">
                    {order.delivery_method === "delivery" && order.shipping_address && (
                      <p>
                        Deliver to: <span className="text-white">{order.shipping_name}</span> ({order.shipping_address})
                      </p>
                    )}
                    {order.delivery_method === "meetup" && (
                      <p>
                        Meetup Location: <span className="text-white">{order.shipping_address || "Cebu City"}</span>
                      </p>
                    )}
                    {order.buyer_note && (
                      <p className="italic text-[#d6cbd5]">Note: &ldquo;{order.buyer_note}&rdquo;</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-xs text-[#b9adb6] block">Order Total</span>
                      <span className="text-base font-extrabold text-[#e59bc9]">
                        {formatPrice(Number(order.total))}
                      </span>
                    </div>

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
    </div>
  );
}
