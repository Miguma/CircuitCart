"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Ban,
  RotateCcw,
  ShoppingCart,
  Loader2,
  Info,
} from "lucide-react";

function PaymentCancelledContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="max-w-md mx-auto my-12 px-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#1e1322] border border-white/10 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="size-16 rounded-full bg-[#342339] border border-white/15 flex items-center justify-center mx-auto text-[#e59bc9]">
          <Ban className="size-8 stroke-[2]" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Payment Cancelled
          </h1>
          <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
            You cancelled the Maya Sandbox checkout session. No payment was processed and no charges were made.
          </p>
        </div>

        <div className="p-3 bg-[#241c27] border border-white/10 rounded-2xl text-xs text-[#d6cbd5] flex items-center gap-2 text-left">
          <Info className="size-4 shrink-0 text-[#e59bc9]" />
          <span className="text-[11px]">
            Your cart items and pending order remain available. You can resume checkout anytime.
          </span>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/marketplace/cart"
            className="w-full py-3 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="size-4" />
            <span>Return to Cart</span>
          </Link>

          <Link
            href={orderId ? `/marketplace/orders` : "/marketplace"}
            className="w-full py-2.5 bg-white/[0.05] hover:bg-white/10 text-[#d6cbd5] hover:text-white border border-white/10 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart className="size-4" />
            <span>{orderId ? "View My Orders" : "Browse Marketplace"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
        </div>
      }
    >
      <PaymentCancelledContent />
    </Suspense>
  );
}
