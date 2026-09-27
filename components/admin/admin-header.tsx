"use client";

import React from "react";
import Link from "next/link";
import { Menu, Shield, ArrowLeft, ExternalLink } from "lucide-react";
import type { UserProfile } from "@/lib/supabase/auth";

interface AdminHeaderProps {
  profile: UserProfile | null;
  onOpenMobileMenu: () => void;
}

export function AdminHeader({ profile, onOpenMobileMenu }: AdminHeaderProps) {
  const displayName =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    profile?.email?.trim() ||
    "Administrator";
  const avatarInitial = (displayName || "A").charAt(0).toUpperCase();

  return (
    <header className="h-16 cc-surface-card/90 backdrop-blur-xl border-b cc-border px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl cc-surface-secondary border cc-border cc-text-primary hover:cc-surface-card transition-colors cursor-pointer"
          aria-label="Open sidebar menu"
        >
          <Menu className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          <Shield className="size-4 text-[var(--cc-accent-pink)] hidden sm:block" />
          <span className="text-xs sm:text-sm font-extrabold cc-text-primary tracking-tight">
            CircuitCart Admin Console
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">

        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl cc-surface-secondary hover:cc-surface-card border cc-border text-xs font-semibold cc-text-muted hover:cc-text-primary transition-colors"
        >
          <ArrowLeft className="size-3.5 text-[var(--cc-accent-pink)]" />
          <span className="hidden sm:inline">Marketplace</span>
          <ExternalLink className="size-3 cc-text-faint" />
        </Link>

        {profile && (
          <div className="flex items-center gap-2.5 pl-2 border-l cc-border">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="size-8 rounded-xl object-cover border border-[#e59bc9]/30"
              />
            ) : (
              <div className="size-8 rounded-xl bg-[#65486f] text-white flex items-center justify-center font-bold text-xs border border-[#e59bc9]/30">
                {avatarInitial}
              </div>
            )}
            <div className="hidden md:block text-left">
              <span className="text-xs font-bold cc-text-primary block leading-none">
                {displayName}
              </span>
              <span className="text-[10px] text-[var(--cc-accent-pink)] font-medium leading-none">
                Administrator
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
