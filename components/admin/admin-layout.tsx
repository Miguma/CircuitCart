"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { getCurrentUserProfile, type UserProfile } from "@/lib/supabase/auth";
import { isAdmin } from "@/lib/supabase/admin";
import { ShieldAlert, Loader2, X } from "lucide-react";
import Link from "next/link";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const userProfile = await getCurrentUserProfile();
        if (!isMounted) return;

        if (!userProfile) {
          router.replace("/login?redirect=/admin");
          return;
        }

        if (!isAdmin(userProfile)) {
          router.replace("/marketplace?error=admin_access_required");
          return;
        }

        setProfile(userProfile);
      } catch (err) {
        console.error("Error in admin auth check:", err);
        if (isMounted) {
          router.replace("/marketplace?error=admin_access_required");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cc-surface-base)] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-8 text-[var(--cc-accent-pink)] animate-spin" />
          <p className="text-sm font-semibold cc-text-muted">
            Verifying administrative access...
          </p>
        </div>
      </div>
    );
  }

  if (!profile || !isAdmin(profile)) {
    return (
      <div className="min-h-screen bg-[var(--cc-surface-base)] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full cc-surface-card border border-rose-500/20 rounded-3xl p-8 space-y-5 shadow-2xl">
          <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <ShieldAlert className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black cc-text-primary">
              Admin Access Restricted
            </h1>
            <p className="text-xs cc-text-muted">
              You must have an administrator account to view the CircuitCart Admin Console.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center w-full h-11 rounded-xl bg-[#65486f] text-white text-xs font-bold hover:bg-[#7a5885] transition-colors"
          >
            Return to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cc-surface-base)] cc-text-primary flex overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-screen sticky top-0 shrink-0">
        <AdminSidebar profile={profile} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full z-10 flex flex-col cc-surface-card">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg cc-surface-secondary cc-text-muted hover:cc-text-primary border cc-border z-20"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            <AdminSidebar
              profile={profile}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <AdminHeader
          profile={profile}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
