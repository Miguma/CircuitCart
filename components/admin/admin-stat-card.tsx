import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface AdminStatCardProps {
  label: string;
  value: number | string | null;
  icon: LucideIcon;
  description?: string;
  trend?: string;
  loading?: boolean;
  href?: string;
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  description,
  loading = false,
  href,
}: AdminStatCardProps) {
  const content = (
    <div className={`p-5 rounded-2xl bg-[#1e1322]/90 border border-white/10 shadow-xl space-y-3 transition-all ${href ? "hover:border-[#e59bc9]/40 hover:bg-[#25172b]" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#b9adb6]">{label}</span>
        <div className="size-9 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center text-[#e59bc9]">
          <Icon className="size-4" />
        </div>
      </div>

      <div>
        {loading ? (
          <div className="h-8 w-20 bg-white/5 animate-pulse rounded-lg" />
        ) : (
          <p className="text-2xl font-extrabold text-[#fffafa] tracking-tight">
            {value !== null && value !== undefined ? value.toLocaleString() : "Unavailable"}
          </p>
        )}
        {description && (
          <p className="text-[11px] text-[#b9adb6] mt-1 leading-snug">{description}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}
