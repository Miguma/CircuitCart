import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors mb-2"
          >
            <ArrowLeft className="size-3.5 text-[#e59bc9]" />
            <span>{backLabel}</span>
          </Link>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#fffafa] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#b9adb6] mt-1 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 self-start sm:self-auto">{actions}</div>}
    </div>
  );
}
