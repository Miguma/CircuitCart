"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Package,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react";

interface OrderDetail {
  id: string;
  orderReference: string;
  total: number;
  status: string;
  paymentStatus: string;
  items: {
    product_title: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}

interface VerificationResult {
  success: boolean;
  isPaid: boolean;
  paymentStatus: string;
  orderStatus: string;
  mayaStatus?: string;
  receiptNumber?: string;
  orderReference: string;
  orderId: string;
  ordersCount: number;
  totalAmount: number;
  orders: OrderDetail[];
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const txId = searchParams.get("txId");
  const checkoutId = searchParams.get("checkoutId");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function verify() {
      if (!orderId && !txId && !checkoutId) {
        if (isMounted) {
          setError("No order or payment reference provided in URL.");
          setLoading(false);
        }
        return;
      }

      try {
        const params = new URLSearchParams();
        if (orderId) params.set("orderId", orderId);
        if (txId) params.set("txId", txId);
        if (checkoutId) params.set("checkoutId", checkoutId);

        const res = await fetch(`/api/payments/maya/verify?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Unable to verify payment status.");
        }

        const result: VerificationResult = await res.json();
        if (isMounted) {
          setData(result);
          setLoading(false);

          // If not yet confirmed and we've polled less than 4 times, retry after 2 seconds
          if (!result.isPaid && pollCount < 4) {
            setTimeout(() => {
              if (isMounted) {
                setPollCount((prev) => prev + 1);
              }
            }, 2000);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to verify transaction.";
          setError(msg);
          setLoading(false);
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [orderId, txId, checkoutId, pollCount]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(val);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="size-16 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center text-[#e59bc9]">
          <Loader2 className="size-8 animate-spin" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">Verifying Maya Payment...</h2>
          <p className="text-xs text-[#b9adb6] max-w-sm">
            Contacting Maya Sandbox to verify your transaction and confirm your order.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-[#241c27] border border-white/10 rounded-3xl text-center space-y-5 shadow-2xl">
        <div className="size-14 rounded-full bg-rose-950/60 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="size-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-white">Payment Status Unavailable</h2>
          <p className="text-xs text-[#b9adb6]">{error || "Could not retrieve order details."}</p>
        </div>
        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/marketplace/orders"
            className="w-full py-2.5 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>View Purchases</span>
          </Link>
          <Link
            href="/marketplace"
            className="w-full py-2 bg-white/5 hover:bg-white/10 text-xs text-[#d6cbd5] rounded-xl transition-colors"
          >
            Return to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const isConfirmedPaid = data.isPaid || data.paymentStatus === "paid";

  return (
    <div className="max-w-xl mx-auto my-8 sm:my-12 px-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Celebration Header Card */}
      <div className="bg-[#1e1322] border border-white/10 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className={`size-16 rounded-full border flex items-center justify-center mx-auto ${
          isConfirmedPaid
            ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-400"
            : "bg-amber-950/70 border-amber-500/40 text-amber-400"
        }`}>
          {isConfirmedPaid ? (
            <CheckCircle2 className="size-9 stroke-[2]" />
          ) : (
            <Clock className="size-8 stroke-[2]" />
          )}
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="size-3" />
            <span>Maya Sandbox Verified</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {isConfirmedPaid ? "Payment Successful" : "Confirming Payment..."}
          </h1>
          <p className="text-xs text-[#b9adb6] max-w-md mx-auto leading-relaxed">
            {isConfirmedPaid
              ? "Your Maya Sandbox payment has been confirmed. The seller has been notified and will prepare your order."
              : "Your payment was submitted to Maya Sandbox. Status will update automatically."}
          </p>
        </div>

        {/* Primary Order Reference Badge */}
        <div className="p-3 bg-[#281c2c] border border-white/10 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="text-left">
            <span className="text-[10px] font-semibold text-[#8f7d8c] block uppercase tracking-wider">
              Order Reference
            </span>
            <span className="font-mono font-extrabold text-white tracking-wide text-sm">
              {data.orderReference}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(data.orderReference)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#d6cbd5] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold"
            title="Copy Order Reference"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Transaction Summary Grid */}
        <div className="p-4 bg-[#241c27] border border-white/10 rounded-2xl text-xs space-y-2.5 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[#b9adb6]">Payment Method:</span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-[#e59bc9]" />
              <span>Maya Sandbox</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#b9adb6]">Payment Status:</span>
            <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
              isConfirmedPaid
                ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-300"
                : "bg-amber-950/60 border border-amber-500/30 text-amber-300"
            }`}>
              {isConfirmedPaid ? "PAID" : "PROCESSING"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#b9adb6]">Order Status:</span>
            <span className="font-semibold text-white capitalize">
              {data.orderStatus || "Confirmed"}
            </span>
          </div>

          {data.receiptNumber && (
            <div className="flex items-center justify-between">
              <span className="text-[#b9adb6]">Maya Receipt ID:</span>
              <span className="font-mono text-[11px] text-[#e59bc9] truncate max-w-[200px]">
                {data.receiptNumber}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-white/10 flex items-center justify-between font-bold">
            <span className="text-white">Total Amount:</span>
            <span className="text-base text-[#e59bc9]">
              {formatPrice(data.totalAmount)}
            </span>
          </div>
        </div>

        {/* Sandbox Notice Banner */}
        <div className="p-3 bg-[#342339]/60 border border-white/10 rounded-xl text-[11px] text-[#d6cbd5] text-left flex items-start gap-2">
          <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>School / Capstone Defense Demonstration:</strong> This transaction was processed through Maya Checkout Sandbox. No real currency was charged.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/marketplace/orders"
            className="w-full sm:flex-1 py-3 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Package className="size-4" />
            <span>View My Orders</span>
          </Link>

          <Link
            href="/marketplace"
            className="w-full sm:flex-1 py-3 bg-white/[0.05] hover:bg-white/10 text-[#d6cbd5] hover:text-white border border-white/10 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
