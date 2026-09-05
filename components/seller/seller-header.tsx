"use client";

import React from "react";
import Link from "next/link";
import {
  Menu,
  Bell,
  PlusCircle,
  Search,
  ExternalLink,
  ShieldCheck,
  User,
} from "lucide-react";
import { DEMO_SELLER_STATS } from "@/lib/seller/seller-data";

interface SellerHeaderProps {
  onToggleMobileMenu: () => void;
  title?: string;
  subtitle?: string;
  showAddProduct?: boolean;
}

export function SellerHeader({
  onToggleMobileMenu,
  title,
  subtitle,
  showAddProduct = true,
}: SellerHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 w-full bg-[#1c121e]/85 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Left: Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Open sidebar menu"
          className="lg:hidden size-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#fffafa] hover:bg-white/10 transition-colors"
        >
          <Menu className="size-5 text-[#e59bc9]" />
        </button>

        {title && (
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-[#fffafa] truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden md:block text-xs text-[#b9adb6] truncate">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {showAddProduct && (
          <Link
            href="/sell"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-semibold shadow-xs transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] active:scale-[0.98]"
          >
            <PlusCircle className="size-3.5 text-[#e59bc9]" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Link>
        )}

        {/* Storefront live preview link */}
        <Link
          href="/marketplace"
          className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/[0.08] text-xs font-medium text-[#d6cbd5] hover:text-white transition-colors"
        >
          <span>Storefront</span>
          <ExternalLink className="size-3 text-[#b9adb6]" />
        </Link>

        {/* Notifications */}
        <Link
          href="/seller/messages"
          className="relative size-9 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-[#b9adb6] hover:text-white transition-colors"
          aria-label="Seller notifications and messages"
        >
          <Bell className="size-4" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-[#e59bc9]" />
        </Link>

        {/* Shop Avatar */}
        <Link
          href="/seller/shop"
          className="flex items-center gap-2 pl-2 border-l border-white/10 group focus-visible:outline-2 focus-visible:outline-[#e59bc9] rounded-lg"
        >
          <div className="size-8 rounded-lg bg-[#3d2743] border border-[#e59bc9]/30 flex items-center justify-center text-[#e59bc9] text-xs font-bold shrink-0 group-hover:border-[#e59bc9] transition-colors">
            {DEMO_SELLER_STATS.shopName.charAt(0)}
          </div>
          <div className="hidden xl:block text-left text-xs leading-tight">
            <p className="font-bold text-[#fffafa] group-hover:text-[#e59bc9] transition-colors truncate max-w-[110px]">
              {DEMO_SELLER_STATS.shopName}
            </p>
            <p className="text-[10px] text-[#b9adb6]">Seller Studio</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
