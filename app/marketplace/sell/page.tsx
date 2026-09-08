"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Store,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  UserCheck,
  Clock,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { getCurrentUserProfile, type UserProfile } from "@/lib/supabase/auth";
import { getMyVerificationRequest } from "@/lib/supabase/verification";
import type { DbSellerVerificationRequest } from "@/lib/supabase/types";

export default function SellPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verification, setVerification] = useState<DbSellerVerificationRequest | null>(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const [p, v] = await Promise.all([
          getCurrentUserProfile(),
          getMyVerificationRequest(),
        ]);
        setProfile(p);
        setVerification(v);
      } catch (err) {
        console.error("Failed to load seller status:", err);
      }
    }
    loadStatus();
  }, []);

  const isVerified = verification?.status === "approved" || profile?.role === "seller";
  const isPending = verification?.status === "pending";

  const steps = [
    {
      number: 1,
      title: "Account Registration",
      description: profile
        ? `Account registered for ${profile.full_name || profile.username || "User"}.`
        : "Complete initial CircuitCart user registration.",
      status: profile ? "completed" : "pending",
      icon: UserCheck,
    },
    {
      number: 2,
      title: "Identity Verification",
      description: "Submit government-issued Philippine ID and selfie photo review.",
      status: isVerified ? "completed" : isPending ? "in_progress" : "pending",
      icon: ShieldCheck,
    },
    {
      number: 3,
      title: "Seller Activation",
      description: "Publish tech listings and manage your CircuitCart shop.",
      status: isVerified ? "completed" : "pending",
      icon: FileCheck,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Store className="size-7 text-[#e59bc9]" />
          <span>Start Selling on CircuitCart</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#b9adb6] mt-2 leading-relaxed max-w-xl">
          Seller verification protects buyers and responsible sellers across Cebu and the Visayas. Complete verification checks to start publishing hardware listings.
        </p>
      </div>

      {/* 3 Verification Steps */}
      <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-white/10">
          Verification Process
        </h2>

        <div className="space-y-4">
          {steps.map((step) => {
            const IconComp = step.icon;
            const isDone = step.status === "completed";
            const isInProgress = step.status === "in_progress";

            return (
              <div
                key={step.number}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                  isDone
                    ? "bg-[#342339]/40 border-emerald-500/30"
                    : isInProgress
                    ? "bg-[#342339]/40 border-amber-500/30"
                    : "bg-[#342339]/20 border-white/5 opacity-80"
                }`}
              >
                <div
                  className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDone
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-600/40"
                      : isInProgress
                      ? "bg-amber-950/80 text-amber-300 border border-amber-600/40"
                      : "bg-[#241c27] text-[#b9adb6] border border-white/10"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <IconComp className="size-5" />
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">
                      {step.number}. {step.title}
                    </h3>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isDone
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                          : isInProgress
                          ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                          : "bg-white/5 text-[#8f7d8c] border border-white/10"
                      }`}
                    >
                      {isDone ? "Completed" : isInProgress ? "Under Review" : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-[#b9adb6] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-white/10">
          <Link
            href="/marketplace"
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#b9adb6] hover:text-white hover:bg-white/5 border border-white/10 rounded-xl transition-colors text-center cursor-pointer"
          >
            Continue later
          </Link>

          <Link
            href={isVerified ? "/sell" : "/seller/verification"}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] border border-white/10 text-[#fffafa] rounded-xl text-center shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <span>{isVerified ? "Create Listing" : isPending ? "Check Status" : "Start Verification"}</span>
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Trust & Policy Callout */}
      <div className="p-5 rounded-2xl bg-[#241c27] border border-white/10 space-y-2 text-xs text-[#b9adb6]">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Clock className="size-4 text-[#e59bc9]" />
          <span>Why does CircuitCart require seller verification?</span>
        </div>
        <p className="leading-relaxed">
          To eliminate fraudulent tech sales and protect our Visayas community, every seller is authenticated before listings go live. Buyers can purchase with full confidence in condition grades and seller accountability.
        </p>
      </div>
    </div>
  );
}
