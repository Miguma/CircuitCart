import React from "react";

interface AdminStatusBadgeProps {
  status: string;
  type?: "role" | "verification" | "product" | "order" | "shop" | "autoReview";
}

export function AdminStatusBadge({ status, type = "role" }: AdminStatusBadgeProps) {
  const norm = (status || "").toLowerCase();

  // Role Badges
  if (type === "role") {
    if (norm === "admin") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#65486f] text-white border border-[#e59bc9]/30">
          Admin
        </span>
      );
    }
    if (norm === "seller") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#3d2743] text-[#e59bc9] border border-[#e59bc9]/20">
          Seller
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/5 text-[#b9adb6] border border-white/10">
        Buyer
      </span>
    );
  }

  // Verification & Status Badges
  if (norm === "approved" || norm === "active" || norm === "passed" || norm === "completed") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
        {status}
      </span>
    );
  }

  if (norm === "pending" || norm === "processing" || norm === "manual_review" || norm === "queued" || norm === "confirmed" || norm === "preparing" || norm === "ready") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/30">
        {status}
      </span>
    );
  }

  if (norm === "rejected" || norm === "failed" || norm === "suspended" || norm === "cancelled") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/30">
        {status}
      </span>
    );
  }

  // Default / Neutral
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/5 text-[#b9adb6] border border-white/10">
      {status || "—"}
    </span>
  );
}
