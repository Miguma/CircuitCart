"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  PackageCheck,
  Truck,
  MapPin,
  Filter,
  Eye,
  ArrowUpDown,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import { SellerOrderDetailDrawer } from "@/components/seller/seller-order-detail-drawer";
import {
  type OrderStatus,
  type SellerOrder,
  type FulfillmentMethod,
} from "@/lib/seller/seller-data";
import {
  getSellerOrders,
  updateSellerOrderStatus,
  cancelBuyerOrder,
  mapSellerStatusToDbStatus,
} from "@/lib/supabase/orders";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function SellerOrdersContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => searchParams.get("orderId"));
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(() => Boolean(searchParams.get("orderId")));

  useEffect(() => {
    let active = true;
    getSellerOrders()
      .then((data) => {
        if (active) {
          setOrders(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load seller orders:", err);
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeOrder = useMemo(() => {
    if (!activeOrderId) return null;
    return orders.find((o) => o.id === activeOrderId || o.orderNumber === activeOrderId) || null;
  }, [orders, activeOrderId]);

  // Tab count calculations
  const statusCounts = useMemo(() => {
    return {
      All: orders.length,
      Pending: orders.filter((o) => o.status === "Pending").length,
      Confirmed: orders.filter((o) => o.status === "Confirmed").length,
      Packed: orders.filter((o) => o.status === "Packed").length,
      Shipped: orders.filter((o) => o.status === "Shipped").length,
      "Ready for Meetup": orders.filter((o) => o.status === "Ready for Meetup").length,
      Completed: orders.filter((o) => o.status === "Completed").length,
      Cancelled: orders.filter((o) => o.status === "Cancelled").length,
    };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return orders.filter((o) => {
      const matchesSearch =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.buyer.name.toLowerCase().includes(q) ||
        o.items.some((it) => it.name.toLowerCase().includes(q));

      const matchesStatus =
        selectedStatus === "All" || o.status === selectedStatus;

      const matchesFulfillment =
        fulfillmentFilter === "All" || o.fulfillmentMethod === fulfillmentFilter;

      return matchesSearch && matchesStatus && matchesFulfillment;
    });
  }, [orders, searchQuery, selectedStatus, fulfillmentFilter]);

  // Order status transitions
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    trackingNo?: string
  ) => {
    const dbStatus = mapSellerStatusToDbStatus(newStatus);
    try {
      await updateSellerOrderStatus(orderId, dbStatus);

      const now = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const todayStr = `Today · ${now}`;

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;

          const updated: SellerOrder = {
            ...o,
            status: newStatus,
            confirmedAt: newStatus === "Confirmed" ? todayStr : o.confirmedAt,
            packedAt: newStatus === "Packed" ? todayStr : o.packedAt,
            shippedAt:
              newStatus === "Shipped" || newStatus === "Ready for Meetup"
                ? todayStr
                : o.shippedAt,
            completedAt: newStatus === "Completed" ? todayStr : o.completedAt,
          };

          if (trackingNo && updated.deliveryDetails) {
            updated.deliveryDetails = {
              ...updated.deliveryDetails,
              trackingNumber: trackingNo,
            };
          }

          return updated;
        })
      );

      toast.success(`Order status updated to "${newStatus}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status.";
      toast.error(msg);
    }
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    try {
      await cancelBuyerOrder(orderId, reason);

      const now = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const todayStr = `Today · ${now}`;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: "Cancelled",
                cancelledAt: todayStr,
                cancelReason: reason,
                paymentStatus: "Refunded",
              }
            : o
        )
      );

      toast.info(`Order cancelled: "${reason}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel order.";
      toast.error(msg);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 border border-amber-500/30 text-amber-300">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending
          </span>
        );
      case "Confirmed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/60 border border-blue-500/30 text-blue-300">
            Confirmed
          </span>
        );
      case "Packed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#45284f] border border-[#e59bc9]/30 text-[#e59bc9]">
            Packed
          </span>
        );
      case "Ready for Dispatch":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/60 border border-sky-500/30 text-sky-300">
            <Truck className="size-3" />
            Ready for Dispatch
          </span>
        );
      case "Shipped":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/60 border border-sky-500/30 text-sky-300">
            <Truck className="size-3" />
            Shipped
          </span>
        );
      case "Ready for Meetup":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950/60 border border-purple-500/30 text-purple-300">
            <MapPin className="size-3" />
            Ready for Meetup
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
            <CheckCircle2 className="size-3" />
            Completed
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/60 border border-rose-500/30 text-rose-300">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white">
            {status}
          </span>
        );
    }
  };

  return (
    <SellerLayout
      title="Orders"
      subtitle="Manage customer orders and update fulfillment status."
      showAddProduct={true}
    >
      <div className="space-y-6">
        {/* ========================================================= */}
        {/* 1. TOP SUMMARY METRIC COUNTS                              */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {(
            [
              { key: "All", label: "All", count: statusCounts.All, highlight: "" },
              { key: "Pending", label: "Pending", count: statusCounts.Pending, highlight: "amber" },
              { key: "Confirmed", label: "Confirmed", count: statusCounts.Confirmed, highlight: "" },
              { key: "Packed", label: "Packed", count: statusCounts.Packed, highlight: "plum" },
              { key: "Shipped", label: "Shipped", count: statusCounts.Shipped, highlight: "" },
              { key: "Completed", label: "Completed", count: statusCounts.Completed, highlight: "emerald" },
              { key: "Cancelled", label: "Cancelled", count: statusCounts.Cancelled, highlight: "" },
            ] as const
          ).map((item) => {
            const isSelected = selectedStatus === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedStatus(item.key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#3d2743] border-[#e59bc9]/40 shadow-xs"
                    : "bg-[#1e1322]/60 hover:bg-[#281827] border-white/[0.06]"
                }`}
              >
                <span className="text-[11px] font-semibold text-[#b9adb6] block">
                  {item.label}
                </span>
                <span
                  className={`text-lg sm:text-xl font-black mt-0.5 block ${
                    item.highlight === "amber" && item.count > 0
                      ? "text-amber-300"
                      : item.highlight === "emerald" && item.count > 0
                      ? "text-emerald-400"
                      : item.highlight === "plum" && item.count > 0
                      ? "text-[#e59bc9]"
                      : "text-[#fffafa]"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ========================================================= */}
        {/* 2. CONTROLS: FILTER TABS & SEARCH                         */}
        {/* ========================================================= */}
        <div className="space-y-3">
          {/* Top Row: Search and Fulfillment dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#b9adb6] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, buyers, products..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#1e1322]/80 border border-white/10 text-xs font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
              />
            </div>

            <div className="flex items-center gap-2.5">
              {/* Fulfillment dropdown */}
              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-[#1e1322]/80 border border-white/10 text-xs font-semibold text-[#fffafa] outline-hidden focus:border-[#e59bc9] transition-colors cursor-pointer"
              >
                <option value="All">All Fulfillment Methods</option>
                <option value="Delivery">Delivery Only</option>
                <option value="Meetup">Meetup Only</option>
              </select>

              {(searchQuery || selectedStatus !== "All" || fulfillmentFilter !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus("All");
                    setFulfillmentFilter("All");
                    setSearchQuery("");
                  }}
                  className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#b9adb6] hover:text-[#fffafa] font-semibold border border-white/10 transition-all cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Status filter tabs (flex-wrap ensures all 8 status pills are clearly visible with zero cutoff) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {(
              [
                "All",
                "Pending",
                "Confirmed",
                "Packed",
                "Shipped",
                "Ready for Meetup",
                "Completed",
                "Cancelled",
              ] as const
            ).map((st) => {
              const isSelected = selectedStatus === st;
              const count =
                st in statusCounts
                  ? statusCounts[st as keyof typeof statusCounts]
                  : 0;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? "bg-[#65486f] text-white border border-white/20 shadow-xs"
                      : "bg-[#1e1322]/60 hover:bg-[#342339] text-[#b9adb6] hover:text-white border border-white/[0.06]"
                  }`}
                >
                  <span>{st}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? "bg-white text-[#19131b]"
                        : "bg-white/10 text-[#d6cbd5]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. ORDER TABLE (Desktop) & STACKED CARDS (Mobile)         */}
        {/* ========================================================= */}
        <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-7 text-[#e59bc9] animate-spin" />
              <span className="text-sm font-semibold text-[#d6cbd5]">
                Loading orders...
              </span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="size-12 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                <ShoppingBag className="size-6" />
              </div>
              <h3 className="text-base font-bold text-[#fffafa]">
                No orders found
              </h3>
              <p className="text-xs text-[#b9adb6] max-w-sm mx-auto">
                No buyer orders match your active search or status filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("All");
                  setFulfillmentFilter("All");
                }}
                className="px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-white/[0.02] border-b border-white/[0.06] text-[#b9adb6] text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">Order</th>
                      <th className="py-3.5 px-4">Buyer</th>
                      <th className="py-3.5 px-4">Items</th>
                      <th className="py-3.5 px-4">Total</th>
                      <th className="py-3.5 px-4">Fulfillment</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-[#d6cbd5]">
                    {filteredOrders.map((ord) => {
                      const itemsSummary =
                        ord.items.length === 1
                          ? ord.items[0].name
                          : `${ord.items[0].name} +${ord.items.length - 1} more (${ord.items.length} items)`;

                      return (
                        <tr
                          key={ord.id}
                          onClick={() => {
                            setActiveOrderId(ord.id);
                            setIsDrawerOpen(true);
                          }}
                          className="hover:bg-white/[0.03] transition-colors group cursor-pointer"
                        >
                          <td className="py-4 px-5 font-mono text-xs font-bold text-[#e59bc9] group-hover:underline">
                            {ord.orderNumber}
                          </td>
                          <td className="py-4 px-4 font-semibold text-[#fffafa]">
                            {ord.buyer.name}
                            <span className="text-[10px] text-amber-300 font-normal block">
                              ★ {ord.buyer.rating}
                            </span>
                          </td>
                          <td className="py-4 px-4 max-w-[220px]">
                            <p className="font-medium text-[#d6cbd5] truncate">
                              {itemsSummary}
                            </p>
                          </td>
                          <td className="py-4 px-4 font-extrabold text-[#fffafa]">
                            ₱{ord.total.toLocaleString()}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1 text-xs text-[#b9adb6]">
                              {ord.fulfillmentMethod === "Delivery" ? (
                                <Truck className="size-3 text-[#e59bc9]" />
                              ) : (
                                <MapPin className="size-3 text-purple-400" />
                              )}
                              <span>{ord.fulfillmentMethod}</span>
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {getStatusBadge(ord.status)}
                          </td>
                          <td className="py-4 px-4 text-xs text-[#b9adb6] whitespace-nowrap">
                            {ord.placedAt}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveOrderId(ord.id);
                                setIsDrawerOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-[#e59bc9] hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-[#65486f] transition-all cursor-pointer"
                            >
                              <span>View</span>
                              <ChevronRight className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE STACKED CARDS (< md) */}
              <div className="md:hidden divide-y divide-white/[0.06]">
                {filteredOrders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => {
                      setActiveOrderId(ord.id);
                      setIsDrawerOpen(true);
                    }}
                    className="p-4 space-y-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs font-extrabold text-[#e59bc9]">
                          {ord.orderNumber}
                        </span>
                        <h4 className="text-sm font-bold text-[#fffafa] mt-0.5">
                          {ord.buyer.name}
                        </h4>
                      </div>
                      {getStatusBadge(ord.status)}
                    </div>

                    <p className="text-xs text-[#d6cbd5] truncate">
                      {ord.items.map((i) => i.name).join(", ")}
                    </p>

                    <div className="flex items-center justify-between text-xs py-1 border-t border-b border-white/[0.04] text-[#b9adb6]">
                      <span className="font-extrabold text-sm text-[#fffafa]">
                        ₱{ord.total.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        {ord.fulfillmentMethod === "Delivery" ? (
                          <Truck className="size-3 text-[#e59bc9]" />
                        ) : (
                          <MapPin className="size-3 text-purple-400" />
                        )}
                        <span>{ord.fulfillmentMethod}</span>
                      </span>
                      <span>{ord.placedAt.split("·")[0]}</span>
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-[#65486f] text-white text-xs font-bold transition-colors"
                      >
                        <span>View Order</span>
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Slide-in Order Details Drawer */}
      <SellerOrderDetailDrawer
        order={activeOrder}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setActiveOrderId(null);
        }}
        onUpdateStatus={handleUpdateStatus}
        onCancelOrder={handleCancelOrder}
      />
    </SellerLayout>
  );
}

export default function SellerOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-[#b9adb6]">
          Loading orders...
        </div>
      }
    >
      <SellerOrdersContent />
    </Suspense>
  );
}
