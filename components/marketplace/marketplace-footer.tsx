"use client";

import React from "react";
import Link from "next/link";
import { toast } from "sonner";

export function MarketplaceFooter() {
  const currentYear = new Date().getFullYear();

  const handleComingSoon = (feature: string) => {
    toast.info(`${feature} documentation coming soon.`);
  };

  return (
    <footer className="w-full bg-[#19131b] text-[#b9adb6] border-t border-white/10 pt-10 pb-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-white/10">
          {/* Brand Mark Column */}
          <div className="md:col-span-4 space-y-3">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 select-none focus-visible:outline-2 focus-visible:outline-[#e59bc9] rounded-xs"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#e59bc9] size-5 shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M2 3.5H4.5L6.5 13.5H16.5L18.5 6.5H6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 9.5H13.5V13.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="13.5" cy="9.5" r="1.2" fill="currentColor" />
                <circle cx="9" cy="9.5" r="1.2" fill="currentColor" />
                <circle cx="8" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <circle cx="15" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
              <span className="text-xl font-bold tracking-tight text-[#fffafa]">
                Circuit<span className="text-[#e59bc9]">Cart</span>
              </span>
            </Link>
            <p className="text-xs text-[#b9adb6] leading-relaxed max-w-sm">
              The premier marketplace for discovering verified new and pre-owned technology across Cebu and the Visayas.
            </p>
          </div>

          {/* Marketplace Links */}
          <div className="md:col-span-3 space-y-2">
            <h4 className="text-xs font-semibold text-[#fffafa] uppercase tracking-wider">
              Marketplace
            </h4>
            <ul className="space-y-1.5 text-xs text-[#b9adb6]">
              <li>
                <Link href="/marketplace" className="hover:text-[#e59bc9] transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]">
                  All Categories
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="hover:text-[#e59bc9] transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]">
                  Featured Deals
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="hover:text-[#e59bc9] transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]">
                  Pre-owned Finds
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="hover:text-[#e59bc9] transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]">
                  Popular in Gaming
                </Link>
              </li>
            </ul>
          </div>

          {/* Buyer Support Links */}
          <div className="md:col-span-2 space-y-2">
            <h4 className="text-xs font-semibold text-[#fffafa] uppercase tracking-wider">
              Buyer Support
            </h4>
            <ul className="space-y-1.5 text-xs text-[#b9adb6]">
              <li>
                <button
                  type="button"
                  onClick={() => handleComingSoon("Help Center")}
                  className="hover:text-[#e59bc9] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  Help Center
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleComingSoon("Buyer Protection")}
                  className="hover:text-[#e59bc9] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  Buyer Protection
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleComingSoon("Return Policy")}
                  className="hover:text-[#e59bc9] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  Return Policy
                </button>
              </li>
            </ul>
          </div>

          {/* Seller Links */}
          <div className="md:col-span-3 space-y-2">
            <h4 className="text-xs font-semibold text-[#fffafa] uppercase tracking-wider">
              Sellers & Partners
            </h4>
            <ul className="space-y-1.5 text-xs text-[#b9adb6]">
              <li>
                <Link
                  href="/marketplace/sell"
                  className="hover:text-[#e59bc9] transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  Start Selling on CircuitCart
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleComingSoon("Seller Protection Policy")}
                  className="hover:text-[#e59bc9] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  Seller Protection Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleComingSoon("Verified Seller Guide")}
                  className="hover:text-[#e59bc9] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  Verified Seller Guide
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & legal */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#b9adb6] gap-3">
          <p>© {currentYear} CircuitCart Marketplace. All rights reserved.</p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleComingSoon("Privacy Policy")}
              className="hover:text-[#e59bc9] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleComingSoon("Terms of Service")}
              className="hover:text-[#e59bc9] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
