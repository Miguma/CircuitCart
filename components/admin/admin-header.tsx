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
  return (
    <header className="h-16 bg-[#1e1322]/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-[#342339] border border-white/10 text-white hover:bg-[#45284f] transition-colors cursor-pointer"
          aria-label="Open sidebar menu"
        >
          <Menu className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          <Shield className="size-4 text-[#e59bc9] hidden sm:block" />
          <span className="text-xs sm:text-sm font-extrabold text-[#fffafa] tracking-tight">
            CircuitCart Admin Console
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
        >
          <ArrowLeft className="size-3.5 text-[#e59bc9]" />
          <span className="hidden sm:inline">Marketplace</span>
          <ExternalLink className="size-3 text-[#8f7d8c]" />
        </Link>

        {profile && (
          <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
            <div className="size-8 rounded-xl bg-[#65486f] text-white flex items-center justify-center font-bold text-xs border border-[#e59bc9]/30">
              {(profile.full_name || profile.username || "A").charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <span className="text-xs font-bold text-[#fffafa] block leading-none">
                {profile.full_name || profile.username || "Admin"}
              </span>
              <span className="text-[10px] text-[#e59bc9] font-medium leading-none">
                Administrator
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
