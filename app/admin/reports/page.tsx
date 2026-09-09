"use client";

import React from "react";
import {
  ShieldCheck,
  Activity,
  Database,
  Lock,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reports & Compliance"
        subtitle="Operational logs, security audits, and seller compliance reporting."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Compliance Audit */}
        <div className="p-6 rounded-2xl bg-[#342339]/40 border border-white/10 space-y-4">
          <div className="size-11 rounded-xl bg-[#65486f]/50 border border-[#e59bc9]/30 flex items-center justify-center text-[#e59bc9]">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#fffafa]">
              Seller Identity Compliance
            </h3>
            <p className="text-xs text-[#b9adb6] mt-1 leading-relaxed">
              All seller verification requests are audited with encrypted document references and automated OCR match telemetry.
            </p>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              Phase 6A Enforced
            </span>
          </div>
        </div>

        {/* Database RLS & Security */}
        <div className="p-6 rounded-2xl bg-[#342339]/40 border border-white/10 space-y-4">
          <div className="size-11 rounded-xl bg-[#65486f]/50 border border-[#e59bc9]/30 flex items-center justify-center text-[#e59bc9]">
            <Lock className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#fffafa]">
              Access Control & RLS Security
            </h3>
            <p className="text-xs text-[#b9adb6] mt-1 leading-relaxed">
              Row Level Security is active across profiles, products, shops, and seller verification documents.
            </p>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              RLS Verified
            </span>
          </div>
        </div>

        {/* Storage Policies */}
        <div className="p-6 rounded-2xl bg-[#342339]/40 border border-white/10 space-y-4">
          <div className="size-11 rounded-xl bg-[#65486f]/50 border border-[#e59bc9]/30 flex items-center justify-center text-[#e59bc9]">
            <Database className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#fffafa]">
              Private Storage Protection
            </h3>
            <p className="text-xs text-[#b9adb6] mt-1 leading-relaxed">
              Sensitive Philippine IDs and selfie biometric documents are kept in private Supabase Storage buckets accessible only via signed URLs.
            </p>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              Private Buckets Active
            </span>
          </div>
        </div>
      </div>

      {/* Audit Log Summary */}
      <div className="p-6 rounded-2xl bg-[#342339]/30 border border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-[#fffafa] flex items-center gap-2">
          <Activity className="size-4 text-[#e59bc9]" />
          <span>System Health & Telemetry</span>
        </h3>
        <p className="text-xs text-[#b9adb6] leading-relaxed">
          CircuitCart operates with database-derived authority. Role assignments and verification decisions are recorded with immutable timestamps and reviewer identifiers.
        </p>
      </div>
    </div>
  );
}
