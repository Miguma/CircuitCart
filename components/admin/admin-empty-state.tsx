import React from "react";
import { LucideIcon, Inbox } from "lucide-react";

interface AdminEmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function AdminEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="p-12 rounded-2xl bg-[#1e1322]/80 border border-white/10 text-center space-y-3">
      <div className="size-12 rounded-2xl bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-bold text-[#fffafa]">{title}</h3>
      <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
