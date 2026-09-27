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
    <div className="p-12 rounded-2xl cc-surface-card border cc-border text-center space-y-3">
      <div className="size-12 rounded-2xl cc-surface-secondary border cc-border flex items-center justify-center mx-auto text-[var(--cc-accent-pink)]">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-bold cc-text-primary">{title}</h3>
      <p className="text-xs cc-text-muted max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
