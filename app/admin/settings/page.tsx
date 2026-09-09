"use client";

import React from "react";
import {
  Shield,
  Lock,
  Info,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Settings & Policies Reference"
        subtitle="Policy parameters, verification rules, and access control specifications."
      />

      {/* Informational Banner */}
      <div className="p-4 rounded-2xl bg-[#342339]/40 border border-white/10 flex items-start gap-3 text-xs text-[#b9adb6]">
        <Info className="size-4 text-[#e59bc9] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          This panel displays current system specifications and compliance policies. Modifiable administrative controls will be made configurable here in a future release.
        </p>
      </div>

      <div className="space-y-5">
        {/* Verification Settings Card */}
        <div className="p-6 rounded-2xl bg-[#342339]/40 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#65486f] border border-[#e59bc9]/30 flex items-center justify-center text-white">
              <Shield className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#fffafa]">
                Seller Verification Rules
              </h3>
              <p className="text-xs text-[#b9adb6]">
                Automated review thresholds and manual queue routing
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#8f7d8c]">
                Auto-Approval Threshold Specification
              </span>
              <p className="text-sm font-bold text-[#fffafa]">≥ 90% OCR Match</p>
              <p className="text-[11px] text-[#b9adb6]">
                Applications with score ≥ 90 and zero mismatch flags qualify for automated approval.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#8f7d8c]">
                Manual Review Routing Specification
              </span>
              <p className="text-sm font-bold text-[#fffafa]">70 - 89% or Flagged</p>
              <p className="text-[11px] text-[#b9adb6]">
                Applications with uncertain OCR or discrepancies are routed to manual admin review.
              </p>
            </div>
          </div>
        </div>

        {/* Security Parameters Card */}
        <div className="p-6 rounded-2xl bg-[#342339]/40 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#65486f] border border-[#e59bc9]/30 flex items-center justify-center text-white">
              <Lock className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#fffafa]">
                Access Control & Security Architecture
              </h3>
              <p className="text-xs text-[#b9adb6]">
                Role derivation and authentication enforcement policy
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/20 border border-white/5">
              <div className="space-y-0.5">
                <span className="font-bold text-[#fffafa]">
                  Database Profile Role Authority
                </span>
                <p className="text-[11px] text-[#b9adb6]">
                  Role checks strictly use `public.profiles.role` from the database.
                </p>
              </div>
              <span className="text-[11px] text-[#8f7d8c]">
                Architectural Constraint
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/20 border border-white/5">
              <div className="space-y-0.5">
                <span className="font-bold text-[#fffafa]">
                  Private Document Storage Access
                </span>
                <p className="text-[11px] text-[#b9adb6]">
                  Verification files expire after 1 hour (3600s) on signed access requests.
                </p>
              </div>
              <span className="text-[11px] text-[#8f7d8c]">
                TTL: 3600 seconds
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
