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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b cc-border">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold cc-text-muted hover:cc-text-primary transition-colors mb-2"
          >
            <ArrowLeft className="size-3.5 text-[var(--cc-accent-pink)]" />
            <span>{backLabel}</span>
          </Link>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold cc-text-primary tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm cc-text-muted mt-1 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 self-start sm:self-auto">{actions}</div>}
    </div>
  );
}
