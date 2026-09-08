"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Layers,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getSellerProducts } from "@/lib/supabase/products";
import { getSellerOrders } from "@/lib/supabase/orders";
import { SellerProductItem, SellerOrder } from "@/lib/seller/seller-data";

export default function SellerAnalyticsPage() {
  const [products, setProducts] = useState<SellerProductItem[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          if (active) setIsLoading(false);
          return;
        }

        const [dbProducts, dbOrders] = await Promise.all([
          getSellerProducts(user.id),
          getSellerOrders(),
        ]);

        if (active) {
          setProducts(dbProducts || []);
          setOrders(dbOrders || []);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn("Could not load seller analytics:", err);
        if (active) setIsLoading(false);
      }
    }

    loadAnalytics();

    return () => {
      active = false;
    };
  }, []);

  const completedOrders = orders.filter((o) => o.status === "Completed");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const activeListings = products.filter((p) => p.status === "Active").length;
  const unitsSold = completedOrders.reduce(
    (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0),
    0
  );

  const averageOrderValue =
    completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;

  // Category breakdown based on real inventory
  const categoryCounts = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryEntries = Object.entries(categoryCounts).map(([cat, count]) => ({
    cat,
    count,
    share: products.length > 0 ? Math.round((count / products.length) * 100) : 0,
  }));

  return (
    <SellerLayout
      title="Analytics"
      subtitle="Shop performance, real completed sales volume, and inventory distribution."
      showAddProduct={true}
    >
      {isLoading ? (
        <div className="p-16 text-center flex flex-col items-center justify-center gap-3 bg-[#1e1322]/80 border border-white/[0.08] rounded-2xl">
          <Loader2 className="size-7 text-[#e59bc9] animate-spin" />
          <span className="text-sm font-semibold text-[#d6cbd5]">
            Loading shop statistics...
          </span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#b9adb6] font-medium">
                  Completed Sales Volume
                </span>
                <TrendingUp className="size-4 text-[#e59bc9]" />
              </div>
              <p className="text-2xl font-extrabold text-[#fffafa]">
                ₱{totalRevenue.toLocaleString()}
              </p>
              <span className="text-xs text-[#b9adb6] font-medium">
                {completedOrders.length} completed {completedOrders.length === 1 ? "order" : "orders"}
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#b9adb6] font-medium">
                  Active Listings
                </span>
                <Package className="size-4 text-[#e59bc9]" />
              </div>
              <p className="text-2xl font-extrabold text-[#fffafa]">{activeListings}</p>
              <span className="text-xs text-[#b9adb6] font-medium">
                {products.length} total products in catalog
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#b9adb6] font-medium">
                  Units Sold
                </span>
                <ShoppingBag className="size-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-extrabold text-[#fffafa]">{unitsSold}</p>
              <span className="text-xs text-emerald-400 font-medium">
                Delivered & completed
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#b9adb6] font-medium">
                  Average Order Value
                </span>
                <Layers className="size-4 text-[#e59bc9]" />
              </div>
              <p className="text-2xl font-extrabold text-[#fffafa]">
                ₱{averageOrderValue.toLocaleString()}
              </p>
              <span className="text-xs text-[#b9adb6] font-medium">
                Across completed orders
              </span>
            </div>
          </div>

          {/* Catalog Distribution by Category */}
          <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#fffafa]">
                  Catalog Distribution by Category
                </h3>
                <p className="text-xs text-[#b9adb6] mt-0.5">
                  Breakdown of active listings across product categories
                </p>
              </div>
              <span className="text-xs font-semibold text-[#e59bc9]">
                {products.length} Products
              </span>
            </div>

            {categoryEntries.length === 0 ? (
              <p className="text-xs text-[#b9adb6] py-4 text-center">
                No products listed yet. Once you add listings, category distribution will display here.
              </p>
            ) : (
              <div className="space-y-4">
                {categoryEntries.map((item) => (
                  <div key={item.cat} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#fffafa]">
                        {item.cat}
                      </span>
                      <span className="font-bold text-[#fffafa]">
                        {item.count} {item.count === 1 ? "listing" : "listings"}{" "}
                        <span className="text-[#8f7d8c] font-normal">
                          ({item.share}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#65486f] to-[#e59bc9] rounded-full"
                        style={{ width: `${item.share}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SellerLayout>
  );
}

