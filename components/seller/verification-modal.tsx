"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  Loader2,
  X,
} from "lucide-react";
import {
  verifyProductWithAi,
  type VerifyProductResponse,
} from "@/lib/supabase/products";

export type VerificationModalStep =
  | "verifying"
  | "approved"
  | "rejected"
  | "uncertain"
  | "error";

interface VerificationModalProps {
  isOpen: boolean;
  productId: string | null;
  productTitle: string;
  imagePreviews?: string[];
  initialResult?: VerifyProductResponse | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function VerificationModal({
  isOpen,
  productId,
  productTitle,
  imagePreviews,
  initialResult,
  onClose,
  onSuccess,
}: VerificationModalProps) {
  const router = useRouter();
  const [stepState, setStep] = useState<VerificationModalStep>("verifying");
  const [progressStage, setProgressStage] = useState<1 | 2 | 3>(1);
  const [resultState, setResult] = useState<VerifyProductResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Derive active result and step from initialResult or async result state
  const result = resultState ?? initialResult ?? null;
  const step: VerificationModalStep =
    stepState === "verifying" && initialResult && !resultState
      ? initialResult.decision === "TECH_APPROVED"
        ? "approved"
        : initialResult.decision === "NON_TECH_REJECTED"
        ? "rejected"
        : "uncertain"
      : stepState;

  const handleRetry = () => {
    setStep("verifying");
    setProgressStage(1);
    setErrorMessage(null);
    setResult(null);
    setRetryCount((c) => c + 1);
  };

  // Trigger verification on open or retry if no initialResult
  useEffect(() => {
    if (!isOpen || !productId || initialResult) return;

    let isSubscribed = true;
    const t1 = setTimeout(() => {
      if (isSubscribed) setProgressStage(2);
    }, 700);
    const t2 = setTimeout(() => {
      if (isSubscribed) setProgressStage(3);
    }, 1500);

    verifyProductWithAi(productId, imagePreviews)
      .then((res) => {
        if (!isSubscribed) return;
        clearTimeout(t1);
        clearTimeout(t2);
        setProgressStage(3);
        setResult(res);

        if (res.decision === "TECH_APPROVED") {
          setStep("approved");
          setCountdown(4);
        } else if (res.decision === "NON_TECH_REJECTED") {
          setStep("rejected");
        } else {
          setStep("uncertain");
        }
      })
      .catch((err) => {
        if (!isSubscribed) return;
        clearTimeout(t1);
        clearTimeout(t2);
        console.error("Verification error:", err);
        setStep("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Verification unavailable. Please check your connection and retry."
        );
      });

    return () => {
      isSubscribed = false;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, productId, initialResult, imagePreviews, retryCount]);

  // Auto-redirect countdown on approval
  useEffect(() => {
    if (step !== "approved" || countdown === null) return;
    if (countdown <= 0) {
      if (onSuccess) onSuccess();
      else {
        router.push("/seller/products");
        router.refresh();
      }
      return;
    }

    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown, onSuccess, router]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-dialog-title"
        className="w-full max-w-lg bg-[#1e1322] border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
      >
        {/* Ambient background glow */}
        <div
          className={`absolute -top-24 -right-24 size-64 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
            step === "approved"
              ? "bg-emerald-500/20"
              : step === "rejected"
              ? "bg-rose-500/20"
              : step === "uncertain"
              ? "bg-amber-500/20"
              : "bg-[#e59bc9]/20"
          }`}
        />

        {/* Close Button (disabled while actively verifying) */}
        {step !== "verifying" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[#b9adb6] hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        )}

        {/* ========================================================= */}
        {/* 1. VERIFYING IN PROGRESS                                  */}
        {/* ========================================================= */}
        {step === "verifying" && (
          <div className="space-y-6 text-center py-4">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-[#65486f] to-[#342339] border border-[#e59bc9]/30 flex items-center justify-center mx-auto shadow-lg shadow-[#e59bc9]/10 relative">
              <Sparkles className="size-8 text-[#e59bc9] animate-pulse" />
              <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#1e1322] flex items-center justify-center">
                <Loader2 className="size-3.5 text-[#e59bc9] animate-spin" />
              </div>
            </div>

            <div>
              <h3
                id="verification-dialog-title"
                className="text-lg font-bold text-[#fffafa]"
              >
                AI Product Verification
              </h3>
              <p className="text-xs text-[#b9adb6] mt-1 max-w-sm mx-auto line-clamp-1">
                &ldquo;{productTitle}&rdquo;
              </p>
            </div>

            {/* Stepped progress indicators */}
            <div className="space-y-3 max-w-sm mx-auto text-left bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              {/* Step 1 */}
              <div className="flex items-center gap-3">
                <div
                  className={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    progressStage >= 1
                      ? "bg-[#65486f] text-white border border-[#e59bc9]/40"
                      : "bg-white/5 text-[#8f7d8c]"
                  }`}
                >
                  {progressStage > 1 ? (
                    <CheckCircle2 className="size-3.5 text-[#e59bc9]" />
                  ) : (
                    <Loader2 className="size-3 animate-spin text-[#e59bc9]" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors ${
                    progressStage === 1
                      ? "text-[#fffafa] font-semibold"
                      : "text-[#b9adb6]"
                  }`}
                >
                  Checking your product...
                </span>
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-3">
                <div
                  className={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    progressStage >= 2
                      ? "bg-[#65486f] text-white border border-[#e59bc9]/40"
                      : "bg-white/5 text-[#8f7d8c]"
                  }`}
                >
                  {progressStage > 2 ? (
                    <CheckCircle2 className="size-3.5 text-[#e59bc9]" />
                  ) : progressStage === 2 ? (
                    <Loader2 className="size-3 animate-spin text-[#e59bc9]" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-white/20" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors ${
                    progressStage === 2
                      ? "text-[#fffafa] font-semibold"
                      : progressStage > 2
                      ? "text-[#b9adb6]"
                      : "text-[#8f7d8c]"
                  }`}
                >
                  Analyzing images...
                </span>
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-3">
                <div
                  className={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    progressStage === 3
                      ? "bg-[#65486f] text-white border border-[#e59bc9]/40"
                      : "bg-white/5 text-[#8f7d8c]"
                  }`}
                >
                  {progressStage === 3 ? (
                    <Loader2 className="size-3 animate-spin text-[#e59bc9]" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-white/20" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors ${
                    progressStage === 3
                      ? "text-[#fffafa] font-semibold"
                      : "text-[#8f7d8c]"
                  }`}
                >
                  Verifying technology category...
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#8f7d8c] italic">
              CircuitCart uses AI to preserve a 100% genuine technology marketplace.
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. APPROVED STATE                                         */}
        {/* ========================================================= */}
        {step === "approved" && (
          <div className="space-y-6 text-center py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="size-16 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950/50">
              <CheckCircle2 className="size-9" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 mb-2">
                <Sparkles className="size-3" />
                TECH_APPROVED
              </span>
              <h3
                id="verification-dialog-title"
                className="text-lg font-bold text-[#fffafa]"
              >
                Approved — Your product is now live!
              </h3>
              <p className="text-xs text-[#b9adb6] mt-2 max-w-sm mx-auto">
                {result?.reason ||
                  "Our AI confirmed this item belongs in CircuitCart's technology marketplace. Your listing is now public."}
              </p>
            </div>

            {result && (
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-left text-xs space-y-1">
                <div className="flex items-center justify-between text-[#b9adb6]">
                  <span>Confidence:</span>
                  <span className="font-semibold text-emerald-300">
                    {Math.round((result.confidence || 0.95) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#b9adb6]">
                  <span>AI Engine:</span>
                  <span className="font-mono text-[11px] text-[#d6cbd5]">
                    {result.modelUsed || "gemini-multimodal"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onSuccess) onSuccess();
                  else {
                    router.push("/seller/products");
                    router.refresh();
                  }
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Go to My Listings</span>
                {countdown !== null && countdown > 0 && (
                  <span className="text-emerald-200 text-[11px]">
                    ({countdown}s)
                  </span>
                )}
                <ArrowRight className="size-3.5" />
              </button>

              {productId && (
                <a
                  href={`/marketplace/products/${productId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#d6cbd5] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>View in Store</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. REJECTED STATE                                         */}
        {/* ========================================================= */}
        {step === "rejected" && (
          <div className="space-y-6 text-center py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="size-16 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-xl shadow-rose-950/50">
              <XCircle className="size-9" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-300 mb-2">
                <ShieldAlert className="size-3" />
                NON_TECH_REJECTED
              </span>
              <h3
                id="verification-dialog-title"
                className="text-lg font-bold text-[#fffafa]"
              >
                Rejected — Non-Technology Listing
              </h3>
              <p className="text-xs text-[#b9adb6] mt-2 max-w-sm mx-auto">
                CircuitCart exclusively permits technology hardware, computing components,
                gadgets, and electronics.
              </p>
            </div>

            {/* Rejection Reason Box */}
            <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3.5 text-left text-xs space-y-2">
              <div className="font-semibold text-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-400" />
                <span>Verification Feedback:</span>
              </div>
              <p className="text-[#d6cbd5] text-xs leading-relaxed">
                {result?.reason ||
                  "This product listing was identified as unrelated to technology hardware or electronics."}
              </p>
              {result?.flaggedReasons && result.flaggedReasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {result.flaggedReasons.map((fl) => (
                    <span
                      key={fl}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-rose-900/40 border border-rose-500/30 text-rose-300"
                    >
                      {fl}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#8f7d8c]">
              Your product has been saved as a <span className="font-semibold text-[#fffafa]">Draft</span>.
              You can edit the details, specifications, or images and re-submit.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Edit Listing
              </button>

              <button
                type="button"
                onClick={() => {
                  router.push("/seller/products");
                  router.refresh();
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#b9adb6] hover:text-white transition-colors cursor-pointer"
              >
                Return to My Listings
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. UNCERTAIN STATE                                        */}
        {/* ========================================================= */}
        {step === "uncertain" && (
          <div className="space-y-6 text-center py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="size-16 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-xl shadow-amber-950/50">
              <AlertTriangle className="size-9" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-2">
                UNCERTAIN
              </span>
              <h3
                id="verification-dialog-title"
                className="text-lg font-bold text-[#fffafa]"
              >
                Review Required — Inconclusive
              </h3>
              <p className="text-xs text-[#b9adb6] mt-2 max-w-sm mx-auto">
                {result?.reason ||
                  "Our AI could not decisively confirm this listing as technology hardware. Please provide clearer specifications or photos."}
              </p>
            </div>

            <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-left text-xs space-y-1 text-[#d6cbd5]">
              <p className="font-semibold text-amber-300">Tips to verify:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#b9adb6]">
                <li>Include brand, model number, and tech specifications</li>
                <li>Upload clear photos showing the actual hardware</li>
                <li>Select the most accurate hardware category</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {productId && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Retry Verification</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#d6cbd5] hover:text-white transition-colors cursor-pointer"
              >
                Edit Listing
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. ERROR STATE                                            */}
        {/* ========================================================= */}
        {step === "error" && (
          <div className="space-y-6 text-center py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="size-16 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-xl">
              <RotateCcw className="size-9" />
            </div>

            <div>
              <h3
                id="verification-dialog-title"
                className="text-lg font-bold text-[#fffafa]"
              >
                Verification unavailable — Retry
              </h3>
              <p className="text-xs text-[#b9adb6] mt-2 max-w-sm mx-auto">
                {errorMessage ||
                  "A network or service timeout occurred. Your listing is saved safely as a draft."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {productId && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Retry Verification</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  router.push("/seller/products");
                  router.refresh();
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#b9adb6] hover:text-white transition-colors cursor-pointer"
              >
                Go to My Listings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
