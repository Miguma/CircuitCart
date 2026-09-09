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
      <div className="min-h-screen bg-[#1e1322] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
          <p className="text-sm font-semibold text-[#b9adb6]">
            Verifying administrative access...
          </p>
        </div>
      </div>
    );
  }

  if (!profile || !isAdmin(profile)) {
    return (
      <div className="min-h-screen bg-[#1e1322] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-[#342339] border border-rose-500/20 rounded-3xl p-8 space-y-5 shadow-2xl">
          <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <ShieldAlert className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-[#fffafa]">
              Admin Access Restricted
            </h1>
            <p className="text-xs text-[#b9adb6]">
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
    <div className="min-h-screen bg-[#1e1322] text-[#fffafa] flex overflow-hidden">
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
          <div className="relative w-72 max-w-[80vw] h-full z-10 flex flex-col bg-[#1e1322]">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-[#342339] text-[#b9adb6] hover:text-white border border-white/10 z-20"
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
