"use client";

import React from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  ShoppingBag,
  Eye,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import { DEMO_SELLER_STATS } from "@/lib/seller/seller-data";

export default function SellerAnalyticsPage() {
  return (
    <SellerLayout
      title="Analytics"
      subtitle="Shop performance, visitor engagement, and revenue trends."
      showAddProduct={true}
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-2">
            <span className="text-xs text-[#b9adb6] font-medium">
              Gross Volume
            </span>
            <p className="text-2xl font-extrabold text-[#fffafa]">
              ₱{DEMO_SELLER_STATS.totalSales.toLocaleString()}
            </p>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="size-3.5" />
              +14.5% this month
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-2">
            <span className="text-xs text-[#b9adb6] font-medium">
              Listing Impressions
            </span>
            <p className="text-2xl font-extrabold text-[#fffafa]">2,480</p>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="size-3.5" />
              +22.1% this month
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-2">
            <span className="text-xs text-[#b9adb6] font-medium">
              Conversion Rate
            </span>
            <p className="text-2xl font-extrabold text-[#fffafa]">4.8%</p>
            <span className="text-xs text-[#b9adb6] font-medium">
              Above Visayas hardware avg
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 space-y-2">
            <span className="text-xs text-[#b9adb6] font-medium">
              Average Order Value
            </span>
            <p className="text-2xl font-extrabold text-[#fffafa]">₱14,200</p>
            <span className="text-xs text-[#e59bc9] font-medium">
              Laptops & Components
            </span>
          </div>
        </div>

        {/* Top Performing Categories Breakdown */}
        <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#fffafa]">
                Sales by Category
              </h3>
              <p className="text-xs text-[#b9adb6] mt-0.5">
                Revenue distribution across your shop
              </p>
            </div>
            <span className="text-xs font-semibold text-[#e59bc9]">
              Last 30 Days
            </span>
          </div>

          <div className="space-y-4">
            {[
              { cat: "Laptops", share: 58, amount: "₱48,900" },
              { cat: "Components (GPUs/CPUs)", share: 24, amount: "₱20,200" },
              { cat: "Mobile Devices", share: 12, amount: "₱10,150" },
              { cat: "Accessories & Audio", share: 6, amount: "₱5,000" },
            ].map((item) => (
              <div key={item.cat} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#fffafa]">
                    {item.cat}
                  </span>
                  <span className="font-bold text-[#fffafa]">
                    {item.amount}{" "}
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
        </div>
      </div>
    </SellerLayout>
  );
}
