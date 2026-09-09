"use client";

import React from "react";
import {
  FileText,
  Shield,
  Database,
  Lock,
  Info,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reports & Compliance Reference"
        subtitle="Architectural specifications, security design, and compliance reference."
      />

      {/* Informational Banner */}
      <div className="p-4 rounded-2xl bg-[#342339]/40 border border-white/10 flex items-start gap-3 text-xs text-[#b9adb6]">
        <Info className="size-4 text-[#e59bc9] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          This section serves as a platform architecture reference. Live automated reporting pipelines and telemetry audit exports will appear here in a future release.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Verification Specifications */}
        <div className="p-6 rounded-2xl bg-[#342339]/30 border border-white/10 space-y-4">
          <div className="size-11 rounded-xl bg-[#65486f]/50 border border-[#e59bc9]/30 flex items-center justify-center text-[#e59bc9]">
            <Shield className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#fffafa]">
              Seller Identity Architecture
            </h3>
            <p className="text-xs text-[#b9adb6] mt-1 leading-relaxed">
              Specification for seller identity verification, Philippine ID validation, and OCR match scoring pipelines.
            </p>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-[#8f7d8c]">
            <span>Specification Phase 6A</span>
          </div>
        </div>

        {/* Database RLS Architecture */}
        <div className="p-6 rounded-2xl bg-[#342339]/30 border border-white/10 space-y-4">
          <div className="size-11 rounded-xl bg-[#65486f]/50 border border-[#e59bc9]/30 flex items-center justify-center text-[#e59bc9]">
            <Lock className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#fffafa]">
              Access Control Design
            </h3>
            <p className="text-xs text-[#b9adb6] mt-1 leading-relaxed">
              Specification for database-derived role authorization and Row Level Security isolation across buyer, seller, and admin roles.
            </p>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-[#8f7d8c]">
            <span>DB-Role Enforced Design</span>
          </div>
        </div>

        {/* Storage Architecture */}
        <div className="p-6 rounded-2xl bg-[#342339]/30 border border-white/10 space-y-4">
          <div className="size-11 rounded-xl bg-[#65486f]/50 border border-[#e59bc9]/30 flex items-center justify-center text-[#e59bc9]">
            <Database className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#fffafa]">
              Private Storage Design
            </h3>
            <p className="text-xs text-[#b9adb6] mt-1 leading-relaxed">
              Specification for storage access, signed URLs with time-limited tokens (3600s), and secure document isolation.
            </p>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-[#8f7d8c]">
            <span>Signed URL Access Pattern</span>
          </div>
        </div>
      </div>

      {/* Audit Logging Architecture */}
      <div className="p-6 rounded-2xl bg-[#342339]/20 border border-white/10 space-y-3">
        <h3 className="text-sm font-bold text-[#fffafa] flex items-center gap-2">
          <FileText className="size-4 text-[#e59bc9]" />
          <span>Audit Logging & Telemetry Specifications</span>
        </h3>
        <p className="text-xs text-[#b9adb6] leading-relaxed">
          CircuitCart enforces database-derived authority without trusting client-side claims. Administrative actions and review events record reviewer profile IDs and UTC timestamps.
        </p>
      </div>
    </div>
  );
}
