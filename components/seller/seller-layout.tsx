"use client";

import React, { useState } from "react";
import { SellerSidebar } from "./seller-sidebar";
import { SellerHeader } from "./seller-header";
import { Toaster } from "sonner";

interface SellerLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showAddProduct?: boolean;
}

export function SellerLayout({
  children,
  title,
  subtitle,
  showAddProduct = true,
}: SellerLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] flex font-sans">
      {/* 1. Desktop Sticky Left Sidebar */}
      <div className="hidden lg:block shrink-0 sticky top-0 h-screen">
        <SellerSidebar />
      </div>

      {/* 2. Mobile Slide-in Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer Panel */}
          <div className="relative w-64 max-w-[80vw] h-full z-50 animate-in slide-in-from-left duration-250 shadow-2xl">
            <SellerSidebar onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <SellerHeader
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          title={title}
          subtitle={subtitle}
          showAddProduct={showAddProduct}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>

      <Toaster
        position="top-center"
        toastOptions={{
          className: "glass-toast font-sans text-xs font-medium",
        }}
      />
    </div>
  );
}
