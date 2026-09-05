"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  MessageSquare,
  BarChart3,
  Store,
  ShieldCheck,
  Settings,
  ArrowLeft,
  Sparkles,
  X,
} from "lucide-react";
import { DEMO_SELLER_STATS } from "@/lib/seller/seller-data";

interface SellerSidebarProps {
  onCloseMobile?: () => void;
}

export function SellerSidebar({ onCloseMobile }: SellerSidebarProps) {
  const pathname = usePathname();

  const mainNavItems = [
    {
      label: "Overview",
      href: "/seller",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: "Products",
      href: "/seller/products",
      icon: Package,
      badge: null,
    },
    {
      label: "Orders",
      href: "/seller/orders",
      icon: ShoppingBag,
      badge: DEMO_SELLER_STATS.pendingOrders > 0 ? DEMO_SELLER_STATS.pendingOrders : null,
    },
    {
      label: "Messages",
      href: "/seller/messages",
      icon: MessageSquare,
      badge: 2,
    },
    {
      label: "Analytics",
      href: "/seller/analytics",
      icon: BarChart3,
      badge: null,
    },
  ];

  const secondaryNavItems = [
    {
      label: "Shop Profile",
      href: "/seller/shop",
      icon: Store,
    },
    {
      label: "Verification",
      href: "/seller/verification",
      icon: ShieldCheck,
      isVerified: DEMO_SELLER_STATS.isVerified,
    },
    {
      label: "Settings",
      href: "/marketplace/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 h-full flex flex-col bg-[#1c121e]/90 backdrop-blur-xl border-r border-white/[0.08] text-[#fffafa] select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/[0.08] shrink-0">
        <Link
          href="/seller"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-[#e59bc9] rounded-md"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[#e59bc9] size-5 shrink-0"
            aria-hidden="true"
          >
            <path
              d="M2 3.5H4.5L6.5 13.5H16.5L18.5 6.5H6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 9.5H13.5V13.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="13.5" cy="9.5" r="1.2" fill="currentColor" />
            <circle cx="9" cy="9.5" r="1.2" fill="currentColor" />
            <circle cx="8" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="15" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-sm font-extrabold tracking-tight text-[#fffafa]">
                Circuit<span className="text-[#e59bc9]">Cart</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#65486f]/50 border border-[#e59bc9]/30 text-[#e59bc9]">
                Seller
              </span>
            </div>
          </div>
        </Link>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden size-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#b9adb6] hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Seller Shop Tagline Card */}
      <div className="p-4 mx-3 mt-3 rounded-xl bg-[#281b2a]/60 border border-white/[0.06] flex items-center gap-3">
        <div className="size-9 rounded-lg bg-[#3d2743] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold text-sm shrink-0">
          {DEMO_SELLER_STATS.shopName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h4 className="text-xs font-bold text-[#fffafa] truncate">
              {DEMO_SELLER_STATS.shopName}
            </h4>
            {DEMO_SELLER_STATS.isVerified && (
              <ShieldCheck className="size-3 text-emerald-400 shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-[#b9adb6] truncate">
            {DEMO_SELLER_STATS.shopHandle}
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Main Section */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8f7d8c] px-3 mb-2">
            Workspace
          </p>
          {mainNavItems.map((item) => {
            const IconComp = item.icon;
            const isActive =
              item.href === "/seller"
                ? pathname === "/seller"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-[#3d2743] text-white font-semibold shadow-xs border border-white/[0.08]"
                    : "text-[#d6cbd5] hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <IconComp
                    className={`size-4 transition-colors ${
                      isActive
                        ? "text-[#e59bc9]"
                        : "text-[#b9adb6] group-hover:text-white"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge != null && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                      isActive
                        ? "bg-[#e59bc9] text-[#19131b]"
                        : "bg-white/10 text-[#d6cbd5]"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Secondary Section */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8f7d8c] px-3 mb-2">
            Shop & Preferences
          </p>
          {secondaryNavItems.map((item) => {
            const IconComp = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-[#3d2743] text-white font-semibold shadow-xs border border-white/[0.08]"
                    : "text-[#d6cbd5] hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <IconComp
                    className={`size-4 transition-colors ${
                      isActive
                        ? "text-[#e59bc9]"
                        : "text-[#b9adb6] group-hover:text-white"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {"isVerified" in item && item.isVerified && (
                  <span className="text-[10px] font-semibold text-emerald-400">
                    Verified
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Return to Marketplace link at bottom */}
      <div className="p-3 border-t border-white/[0.08] shrink-0">
        <Link
          href="/marketplace"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] hover:bg-white/[0.04] transition-colors group"
        >
          <ArrowLeft className="size-4 text-[#e59bc9] group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Marketplace</span>
        </Link>
      </div>
    </aside>
  );
}
