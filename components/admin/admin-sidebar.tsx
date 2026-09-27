"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Store,
  Package,
  ShoppingBag,
  Building2,
  FileText,
  Landmark,
  Settings,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { signOut, type UserProfile } from "@/lib/supabase/auth";
import { toast } from "sonner";

interface AdminSidebarProps {
  profile: UserProfile | null;
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/sellers", label: "Sellers", icon: Store },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/shops", label: "Shops", icon: Building2 },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/finance", label: "Finance", icon: Landmark },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ profile, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const displayName =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    profile?.email?.trim() ||
    "Administrator";
  const avatarInitial = (displayName || "A").charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <aside className="w-64 cc-surface-card border-r cc-border flex flex-col justify-between h-full select-none">
      {/* Brand Header */}
      <div className="p-5 border-b cc-border">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex items-center gap-2.5 group"
        >
          <div className="size-9 rounded-xl bg-[#65486f] text-white flex items-center justify-center font-black tracking-tighter shadow-md border border-[#e59bc9]/30">
            CC
          </div>
          <div>
            <span className="text-sm font-black cc-text-primary tracking-tight block">
              CircuitCart
            </span>
            <span className="text-[10px] font-bold text-[var(--cc-accent-pink)] tracking-wider uppercase">
              Admin Workspace
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation List */}
      <div className="p-3 flex-1 overflow-y-auto space-y-1">
        <span className="px-3 text-[10px] font-bold uppercase tracking-wider cc-text-muted block mb-2">
          Platform Operations
        </span>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[#65486f] text-white shadow-sm border border-[#e59bc9]/40 font-bold"
                  : "cc-text-muted hover:cc-text-primary hover:cc-surface-secondary"
              }`}
            >
              <Icon
                className={`size-4 ${
                  isActive ? "text-[#e59bc9]" : "cc-text-muted"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom User & Marketplace Link */}
      <div className="p-4 border-t cc-border space-y-3 cc-surface-secondary">
        {/* Admin Account Pill */}
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl cc-surface-card border cc-border">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="size-8 rounded-lg object-cover border border-[#e59bc9]/30 shrink-0"
            />
          ) : (
            <div className="size-8 rounded-lg cc-surface-secondary border cc-border flex items-center justify-center text-[var(--cc-accent-pink)] font-bold text-xs shrink-0">
              {avatarInitial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold cc-text-primary truncate">
              {displayName}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-[var(--cc-accent-pink)] font-bold uppercase">
                Administrator
              </span>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="space-y-1 text-xs">
          <Link
            href="/marketplace"
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg cc-text-muted hover:cc-text-primary hover:cc-surface-card transition-colors font-medium"
          >
            <ArrowLeft className="size-3.5 text-[var(--cc-accent-pink)]" />
            <span>Back to Marketplace</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-colors font-medium cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
