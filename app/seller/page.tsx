"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  ShoppingBag,
  AlertTriangle,
  PlusCircle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Star,
  CheckCircle2,
  Clock,
  Eye,
  ChevronRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import {
  type OrderStatus,
  type SellerOrder,
  type SellerProductItem,
} from "@/lib/seller/seller-data";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getSellerProducts } from "@/lib/supabase/products";
import { getSellerOrders } from "@/lib/supabase/orders";
import { getShopByOwnerId } from "@/lib/supabase/shops";
import { DbShop } from "@/lib/supabase/types";

export default function SellerDashboardPage() {
  const [products, setProducts] = useState<SellerProductItem[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [shop, setShop] = useState<DbShop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadDashboardData() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          if (active) setIsLoading(false);
          return;
        }

        const [dbProducts, dbOrders, dbShop] = await Promise.all([
          getSellerProducts(user.id),
          getSellerOrders(),
          getShopByOwnerId(user.id),
        ]);

        if (active) {
          setProducts(dbProducts || []);
          setOrders(dbOrders || []);
          setShop(dbShop);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn("Could not load seller dashboard data:", err);
        if (active) setIsLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      active = false;
    };
  }, []);

  const totalSales = orders
    .filter((o) => o.status === "Completed")
    .reduce((sum, o) => sum + o.total, 0);

  const activeListings = products.filter((p) => p.status === "Active").length;
  const pendingOrders = orders.filter(
    (o) => o.status === "Pending" || o.status === "Confirmed" || o.status === "Packed"
  ).length;
  const lowStockItems = products.filter((p) => p.stock > 0 && p.stock <= 2);
  const completedOrdersCount = orders.filter((o) => o.status === "Completed").length;

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
      case "Packed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#45284f] border border-[#e59bc9]/30 text-[#e59bc9]">
            {status}
          </span>
        );
      case "Shipped":
      case "Ready for Meetup":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/60 border border-sky-500/30 text-sky-300">
            {status}
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-[#d6cbd5]">
            {status}
          </span>
        );
    }
  };

  return (
    <SellerLayout
      title="Seller Dashboard"
      subtitle="Manage your listings, orders, and shop performance."
      showAddProduct={true}
    >
      {isLoading ? (
        <div className="p-16 text-center flex flex-col items-center justify-center gap-3 bg-[#1e1322]/80 border border-white/[0.08] rounded-2xl">
          <Loader2 className="size-7 text-[#e59bc9] animate-spin" />
          <span className="text-sm font-semibold text-[#d6cbd5]">
            Loading seller metrics...
          </span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ========================================================= */}
          {/* 1. TOP SUMMARY METRIC CARDS                               */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CARD 1: Total Sales */}
            <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-3 transition-transform hover:-translate-y-0.5 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#b9adb6]">
                  Completed Sales
                </span>
                <div className="size-8 rounded-lg bg-[#3d2743] border border-white/10 flex items-center justify-center text-[#e59bc9]">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#fffafa] tracking-tight">
                  ₱{totalSales.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-[#b9adb6] mt-1">
                  From completed customer orders
                </p>
              </div>
            </div>

            {/* CARD 2: Active Listings */}
            <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-3 transition-transform hover:-translate-y-0.5 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#b9adb6]">
                  Active Listings
                </span>
                <div className="size-8 rounded-lg bg-[#3d2743] border border-white/10 flex items-center justify-center text-[#e59bc9]">
                  <Package className="size-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#fffafa] tracking-tight">
                  {activeListings}
                </p>
                <p className="text-[11px] font-medium text-[#b9adb6] mt-1">
                  {products.length} total listings in shop
                </p>
              </div>
            </div>

            {/* CARD 3: Pending Orders */}
            <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-3 transition-transform hover:-translate-y-0.5 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#b9adb6]">
                  Awaiting Dispatch
                </span>
                <div className="size-8 rounded-lg bg-amber-950/70 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <ShoppingBag className="size-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-300 tracking-tight">
                  {pendingOrders}
                </p>
                <p className="text-[11px] font-medium text-amber-300/80 mt-1 flex items-center gap-1">
                  <Clock className="size-3" />
                  <span>Orders needing fulfillment</span>
                </p>
              </div>
            </div>

            {/* CARD 4: Low Stock */}
            <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-3 transition-transform hover:-translate-y-0.5 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#b9adb6]">
                  Low Stock
                </span>
                <div className="size-8 rounded-lg bg-rose-950/60 border border-rose-500/30 flex items-center justify-center text-rose-300">
                  <AlertTriangle className="size-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-rose-300 tracking-tight">
                  {lowStockItems.length}
                </p>
                <p className="text-[11px] font-medium text-rose-300/80 mt-1">
                  Items with &le; 2 units left
                </p>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. MAIN DASHBOARD CONTENT (Two-Column Layout)             */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* LEFT 2 COLUMNS: Recent Orders & Listings Preview */}
            <div className="lg:col-span-2 space-y-6">
              {/* RECENT ORDERS TABLE */}
              <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#fffafa]">
                      Recent Sales
                    </h2>
                    <p className="text-xs text-[#b9adb6] mt-0.5">
                      Latest customer purchases and fulfillment status
                    </p>
                  </div>
                  <Link
                    href="/seller/orders"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#e59bc9] hover:text-white transition-colors"
                  >
                    <span>View all ({orders.length})</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                {orders.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <p className="text-sm font-bold text-[#fffafa]">No sales yet</p>
                    <p className="text-xs text-[#b9adb6]">
                      When buyers purchase your products, they will appear here in real time.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-white/[0.02] border-b border-white/[0.06] text-[#b9adb6] text-[11px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-5">Order</th>
                          <th className="py-3 px-4">Buyer</th>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06] text-[#d6cbd5]">
                        {orders.slice(0, 5).map((order) => {
                          const itemSummary =
                            order.items.length === 1
                              ? order.items[0].name
                              : `${order.items[0].name} +${order.items.length - 1} more`;

                          return (
                            <tr
                              key={order.id}
                              className="hover:bg-white/[0.02] transition-colors group"
                            >
                              <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#e59bc9]">
                                {order.orderNumber}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-[#fffafa]">
                                {order.buyer.name}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-[#d6cbd5] max-w-[180px] truncate">
                                {itemSummary}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-[#fffafa]">
                                ₱{order.total.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-4">
                                {getStatusBadge(order.status)}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-[#b9adb6] whitespace-nowrap">
                                {order.placedAt.split("·")[0]}
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <Link
                                  href={`/seller/orders?orderId=${order.id}`}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#e59bc9] hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                  <span>View</span>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* YOUR LISTINGS PREVIEW */}
              <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#fffafa]">
                      Your Listings
                    </h2>
                    <p className="text-xs text-[#b9adb6] mt-0.5">
                      Fast access to manage pricing, inventory, and visibility
                    </p>
                  </div>
                  <Link
                    href="/seller/products"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#e59bc9] hover:text-white transition-colors"
                  >
                    <span>View all products ({products.length})</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                {products.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-sm font-bold text-[#fffafa]">No listings created</p>
                    <p className="text-xs text-[#b9adb6]">
                      List a tech product to reach verified buyers across Cebu and Visayas.
                    </p>
                    <Link
                      href="/sell"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#65486f] text-white text-xs font-bold hover:bg-[#7a5985] transition-colors"
                    >
                      <PlusCircle className="size-3.5 text-[#e59bc9]" />
                      <span>Create Listing</span>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {products.slice(0, 4).map((prod) => (
                      <div
                        key={prod.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="size-11 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center text-[#e59bc9] shrink-0 font-bold">
                            <Package className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-[#fffafa] truncate">
                              {prod.name}
                            </h4>
                            <div className="flex items-center gap-2.5 text-[11px] text-[#b9adb6] mt-0.5">
                              <span className="text-[#e59bc9] font-medium">
                                {prod.category}
                              </span>
                              <span>&bull;</span>
                              <span>Stock: {prod.stock}</span>
                              <span>&bull;</span>
                              <span className="text-[#d6cbd5] flex items-center gap-1">
                                <Eye className="size-3" />
                                {prod.views} views
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                          <div className="text-left sm:text-right">
                            <p className="text-sm font-extrabold text-[#fffafa]">
                              ₱{prod.price.toLocaleString()}
                            </p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/20">
                              {prod.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/marketplace/products/${prod.id}`}
                              className="size-8 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-[#b9adb6] hover:text-white transition-colors"
                              title="View on marketplace"
                            >
                              <ExternalLink className="size-3.5" />
                            </Link>
                            <Link
                              href="/seller/products"
                              className="px-3 py-1.5 rounded-lg bg-[#65486f]/40 hover:bg-[#65486f] text-xs font-semibold text-[#fffafa] transition-colors"
                            >
                              Manage
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT 1 COLUMN: Low Stock Alerts & Performance */}
            <div className="space-y-6">
              {/* LOW STOCK ALERTS */}
              <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-rose-400" />
                    <h3 className="text-sm font-bold text-[#fffafa]">
                      Low Stock Alerts
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-500/30 text-rose-300">
                    {lowStockItems.length} Items
                  </span>
                </div>

                {lowStockItems.length === 0 ? (
                  <p className="text-xs text-[#b9adb6] py-2">
                    No low stock alerts. Inventory levels are healthy.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {lowStockItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#281827]/70 border border-rose-500/20 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#fffafa] truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-rose-300 font-medium mt-0.5">
                            {item.stock} {item.stock === 1 ? "unit" : "units"} remaining
                          </p>
                        </div>
                        <Link
                          href="/seller/products"
                          className="text-xs font-semibold text-[#e59bc9] hover:text-white shrink-0 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
                        >
                          Restock
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href="/seller/products"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-[#d6cbd5] hover:text-white transition-colors"
                >
                  <span>Manage inventory</span>
                  <ChevronRight className="size-3.5" />
                </Link>
              </div>

              {/* SELLER PERFORMANCE CARD */}
              <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/20 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#e59bc9]" />
                  <h3 className="text-sm font-bold text-[#fffafa]">
                    Shop Performance
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Metric 1 */}
                  <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-[#b9adb6]">Completed Orders</span>
                    <span className="font-bold text-[#fffafa]">
                      {completedOrdersCount} orders
                    </span>
                  </div>

                  {/* Metric 2 */}
                  <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-[#b9adb6]">Shop Status</span>
                    <span className="font-bold text-emerald-400 capitalize">
                      {shop?.status || "Active"}
                    </span>
                  </div>

                  {/* Metric 3 */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[#b9adb6]">Verified Seller</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        shop?.is_verified ? "text-emerald-400" : "text-[#b9adb6]"
                      }`}
                    >
                      <ShieldCheck className="size-3.5" />
                      <span>{shop?.is_verified ? "Yes (Verified)" : "Standard Seller"}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.08]">
                  <Link
                    href="/seller/analytics"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#65486f]/30 hover:bg-[#65486f] text-xs font-semibold text-[#fffafa] transition-colors"
                  >
                    <span>View performance insights</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* SELLER GUIDELINES CALLOUT */}
              <div className="p-4 rounded-xl bg-[#281827]/60 border border-white/[0.06] text-xs text-[#b9adb6] space-y-2">
                <p className="font-bold text-[#fffafa] flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-[#e59bc9]" />
                  <span>Visayas Fast Payouts</span>
                </p>
                <p className="leading-relaxed text-[11px]">
                  Orders completed and confirmed by buyers release funds instantly to GCash, Maya, or direct bank transfer.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}

