"use client";

import Link from "next/link";
import { ArrowLeft, ShoppingBag, Store } from "lucide-react";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";

type OrdersHeaderProps = {
  view: "purchases" | "sales";
  count: number;
  isLoading: boolean;
};

export function OrdersHeader({ view, count, isLoading }: OrdersHeaderProps) {
  const { isSeller } = useMarketplaceAccount();
  const sections = [
    { key: "purchases", label: "Purchases", href: "/marketplace/orders", icon: ShoppingBag },
    ...(isSeller
      ? [{ key: "sales", label: "Sales", href: "/seller/orders", icon: Store }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1 text-xs text-[#b9adb6] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
        >
          <ArrowLeft className="size-3.5" />
          Back to Marketplace
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Orders
        </h1>
        <p className="text-xs leading-relaxed text-[#b9adb6]">
          Keep track of what you buy and sell on CircuitCart.
        </p>
      </div>

      <nav aria-label="Order views" className="flex gap-2 border-b border-white/10 pb-3">
        {sections.map(({ key, label, href, icon: Icon }) => {
          const isActive = view === key;

          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${
                isActive
                  ? "border-[#e59bc9]/30 bg-[#65486f] text-white shadow-xs"
                  : "border-white/10 bg-[#241c27] text-[#b9adb6] hover:bg-[#342339] hover:text-white"
              }`}
            >
              <Icon className="size-4" />
              {label}
              {isActive && !isLoading && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1">
        <h2 className="text-base font-bold text-white">
          {view === "purchases" ? "Your purchases" : "Your sales"}
        </h2>
        <p className="text-xs leading-relaxed text-[#b9adb6]">
          {view === "purchases"
            ? "Track deliveries, meetup schedules, and orders from other sellers."
            : "Manage customer orders and keep buyers updated on fulfillment."}
        </p>
      </div>
    </div>
  );
}
