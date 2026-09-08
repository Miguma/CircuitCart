"use client";

import Link from "next/link";
import { ClipboardList, Package } from "lucide-react";

interface ListingOwnerActionsProps {
  productId: string;
  appearance?: "light" | "dark";
  onNavigate?: () => void;
}

export function ListingOwnerActions({
  productId,
  appearance = "dark",
  onNavigate,
}: ListingOwnerActionsProps) {
  const isDark = appearance === "dark";

  return (
    <div
      className={`space-y-3 rounded-2xl border p-4 ${
        isDark ? "border-white/10 bg-[#342339]/50" : "border-[#ded0d5] bg-[#efe7ea]"
      }`}
    >
      <div>
        <p className={`text-sm font-bold ${isDark ? "text-[#e59bc9]" : "text-[#65486f]"}`}>
          Your listing
        </p>
        <p className={`mt-1 text-xs leading-relaxed ${isDark ? "text-[#d6cbd5]" : "text-[#716872]"}`}>
          Manage availability and follow your sales here.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/seller/products?listing=${encodeURIComponent(productId)}`}
          onClick={onNavigate}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#65486f] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#7a5985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9]"
        >
          <Package className="size-4" />
          Manage Listing
        </Link>
        <Link
          href="/seller/orders"
          onClick={onNavigate}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65486f] ${
            isDark
              ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              : "border-[#ded0d5] bg-white text-[#1d1720] hover:bg-[#f0e6e9]"
          }`}
        >
          <ClipboardList className="size-4" />
          View Orders
        </Link>
      </div>
    </div>
  );
}
