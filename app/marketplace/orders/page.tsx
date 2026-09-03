"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Package, ArrowLeft, Clock } from "lucide-react";

type OrderFilter = "All" | "Processing" | "Shipped" | "Completed" | "Cancelled";

export default function OrdersPage() {
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("All");

  const filters: OrderFilter[] = [
    "All",
    "Processing",
    "Shipped",
    "Completed",
    "Cancelled",
  ];

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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          My Orders
        </h1>
        <p className="text-xs text-[#b9adb6] mt-1">
          Track active shipments and review past marketplace purchases.
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

      {/* Polished Empty State (Compact Density) */}
      <div className="bg-[#241c27] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-xl my-4 min-h-[230px] sm:min-h-[280px] flex flex-col items-center justify-center">
        <div className="size-12 sm:size-14 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
          <Package className="size-6 sm:size-7 stroke-[1.5]" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-white">
          No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} orders yet
        </h2>
        <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
          When you place orders on CircuitCart, track your delivery status and verified order receipts here.
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

      {/* Order Policy Note */}
      <div className="flex items-center gap-3 p-4 bg-[#241c27] border border-white/10 rounded-2xl text-xs text-[#b9adb6]">
        <Clock className="size-4 text-[#e59bc9] shrink-0" />
        <span>
          Order tracking and buyer-protection features will be enabled when transactions are connected.
        </span>
      </div>
    </div>
  );
}
