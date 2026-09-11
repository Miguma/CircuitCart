"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PlusCircle,
  Package,
  Loader2,
} from "lucide-react";
import { ProductForm } from "@/components/seller/product-form";
import { getCurrentUserProfile, type UserProfile } from "@/lib/supabase/auth";
import { getMyVerificationRequest } from "@/lib/supabase/verification";
import type { DbSellerVerificationRequest } from "@/lib/supabase/types";

export default function AddProductPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verification, setVerification] = useState<DbSellerVerificationRequest | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    async function loadUserRole() {
      try {
        const [p, v] = await Promise.all([
          getCurrentUserProfile(),
          getMyVerificationRequest(),
        ]);
        setProfile(p);
        setVerification(v);
      } catch (err) {
        console.error("Failed to check seller privileges:", err);
      } finally {
        setIsCheckingRole(false);
      }
    }
    loadUserRole();
  }, []);

  if (isCheckingRole) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-16 px-4 flex flex-col items-center justify-center font-sans">
        <Loader2 className="size-8 animate-spin text-[#e59bc9] mb-3" />
        <p className="text-xs font-semibold text-[#b9adb6]">Verifying seller privileges…</p>
      </div>
    );
  }

  // Buyer verification guard screen
  if (profile?.role === "buyer") {
    const isPending = verification?.status === "pending";
    const isRejected = verification?.status === "rejected";

    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-xl mx-auto space-y-6">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
          >
            <ArrowLeft className="size-3.5 text-[#e59bc9]" />
            <span>Back to Marketplace</span>
          </Link>

          <div className="bg-[#1e1322]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center">
            <div className="size-14 rounded-2xl bg-[#65486f]/20 border border-[#e59bc9]/30 flex items-center justify-center mx-auto text-[#e59bc9]">
              {isPending ? (
                <Loader2 className="size-7 animate-spin text-[#e59bc9]" />
              ) : (
                <Package className="size-7" />
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#fffafa] tracking-tight">
                {isPending
                  ? "Your seller verification is under review"
                  : isRejected
                  ? "Your seller verification was not approved"
                  : "Verify your identity to start selling"}
              </h1>
              <p className="text-xs sm:text-sm text-[#b9adb6] leading-relaxed max-w-md mx-auto">
                {isPending
                  ? "Our compliance team is currently reviewing your submitted ID and selfie document. Once approved, your seller privileges and listing tools will activate automatically."
                  : isRejected
                  ? verification?.rejection_reason || "Your document did not meet verification criteria. Review the feedback and resubmit your application."
                  : "CircuitCart requires seller identity verification before creating product listings. This protects buyers and verified sellers across Cebu and the Visayas."}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/marketplace"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold text-[#b9adb6] hover:text-white transition-colors text-center"
              >
                Browse Marketplace
              </Link>

              <Link
                href="/seller/verification"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#65486f] hover:bg-[#7a5985] text-xs font-bold text-white shadow-xs transition-all text-center flex items-center justify-center gap-2"
              >
                <span>
                  {isPending
                    ? "Check Verification Status"
                    : isRejected
                    ? "Review & Resubmit"
                    : "Start Verification"}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
          >
            <ArrowLeft className="size-3.5 text-[#e59bc9]" />
            <span>Back to My Products</span>
          </Link>

          <Link
            href="/seller"
            className="text-xs font-semibold text-[#e59bc9] hover:underline"
          >
            Seller Dashboard
          </Link>
        </div>

        {/* Page Heading */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#fffafa] tracking-tight flex items-center gap-2.5">
            <PlusCircle className="size-7 text-[#e59bc9]" />
            <span>Add New Product Listing</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#b9adb6] mt-1">
            List your tech item for verified buyers across Cebu and the Visayas.
          </p>
        </div>

        {/* Shared Product Form in Create Mode */}
        <ProductForm mode="create" />
      </div>
    </div>
  );
}

