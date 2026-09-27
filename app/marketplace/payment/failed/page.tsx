"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  XCircle,
  RotateCcw,
  ShoppingCart,
  Loader2,
  AlertTriangle,
} from "lucide-react";

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="max-w-md mx-auto my-12 px-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#1e1322] border border-white/10 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="size-16 rounded-full bg-rose-950/70 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
          <XCircle className="size-9 stroke-[2]" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Payment Unsuccessful
          </h1>
          <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
            Your Maya Sandbox payment could not be completed. Your order has not been paid and stock reservation remains open.
          </p>
        </div>

        <div className="p-3 bg-rose-950/30 border border-rose-500/20 rounded-2xl text-xs text-rose-300 flex items-center gap-2 text-left">
          <AlertTriangle className="size-4 shrink-0 text-rose-400" />
          <span className="text-[11px]">
            No funds were deducted. You can retry with a different test card or choose Cash on Delivery.
          </span>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/marketplace/cart"
            className="w-full py-3 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="size-4" />
            <span>Try Payment Again</span>
          </Link>

          <Link
            href={orderId ? `/marketplace/orders` : "/marketplace"}
            className="w-full py-2.5 bg-white/[0.05] hover:bg-white/10 text-[#d6cbd5] hover:text-white border border-white/10 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart className="size-4" />
            <span>{orderId ? "View My Orders" : "Return to Marketplace"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  );
}
