"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Heart,
  ShoppingCart,
  Bell,
  PlusCircle,
  ChevronDown,
  User,
  Package,
  Settings,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { useMarketplace } from "./marketplace-provider";
import { useMarketplaceAccount } from "./marketplace-account";
import { CategoryFilter } from "./marketplace-data";
import { toast } from "sonner";
import { signOut } from "@/lib/supabase/auth";

interface MarketplaceHeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedCategory?: CategoryFilter;
  onSelectCategory?: (cat: CategoryFilter) => void;
}

export function MarketplaceHeader({
  searchQuery: propSearchQuery,
  onSearchChange: propOnSearchChange,
}: MarketplaceHeaderProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    searchQuery: ctxSearchQuery,
    setSearchQuery: ctxSetSearchQuery,
    favorites,
    totalCartCount,
    unreadNotificationsCount,
    demoProfile,
  } = useMarketplace();
  const { profile, isSeller } = useMarketplaceAccount();

  const displayName = profile?.full_name || demoProfile.name;
  const displayEmail = profile?.username ? `@${profile.username}` : demoProfile.email;
  const displayInitial = displayName.charAt(0) || "U";


  const searchQuery = propSearchQuery ?? ctxSearchQuery;
  const onSearchChange = propOnSearchChange ?? ctxSetSearchQuery;

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard accessibility (Escape to close)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && showUserMenu) {
        setShowUserMenu(false);
        userButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showUserMenu]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathname !== "/marketplace") {
      router.push("/marketplace");
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await signOut();
    toast.info("Logged out successfully.");
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-marketplace-header">
      <div className="max-w-[84rem] mx-auto px-4 sm:px-6 lg:px-8">
        {/* ROW 1: Logo, Search, Actions */}
        <div className="flex items-center justify-between h-16 gap-4 sm:gap-8">
          {/* Logo / Brand Mark */}
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 select-none focus-visible:outline-2 focus-visible:outline-[#e59bc9] rounded-xs shrink-0 group"
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

          {/* DESKTOP SEARCH BAR (Clean, lightweight, single-purpose without redundant dropdown) */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex items-center flex-1 max-w-2xl relative"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#b9adb6] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products, brands, or categories"
              className="w-full h-10 pl-10 pr-4 bg-[#342339] border border-white/10 text-[#fffafa] placeholder:text-[#b9adb6] focus:border-[#e59bc9] focus:outline-none focus:ring-2 focus:ring-[#e59bc9]/30 rounded-xl text-sm transition-all"
            />
          </form>

          {/* ACTIONS & USER MENU */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sell Button */}
            <Link
              href="/sell"
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-[#fffafa] rounded-xl shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              <PlusCircle className="size-4 text-[#e59bc9]" />
              <span>Sell</span>
            </Link>

            {/* Favorites Button */}
            <Link
              href="/marketplace/favorites"
              className="relative hidden p-2 text-[#fffafa] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] md:inline-flex"
              aria-label={`Favorites with ${favorites.length} items`}
            >
              <Heart className="size-5" />
              {favorites.length > 0 && (
                <span className="absolute top-1 right-1 size-4 bg-[#b78bd7] text-[#19131b] text-[10px] font-extrabold rounded-full flex items-center justify-center">
                  {favorites.length}
                </span>
              )}
            </Link>

            {/* Cart Button */}
            <Link
              href="/marketplace/cart"
              className="relative hidden p-2 text-[#fffafa] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] md:inline-flex"
              aria-label={`Cart with ${totalCartCount} items`}
            >
              <ShoppingCart className="size-5" />
              {totalCartCount > 0 && (
                <span className="absolute top-1 right-1 size-4 bg-[#e59bc9] text-[#19131b] text-[10px] font-extrabold rounded-full flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </Link>

            {/* Messages Button */}
            <Link
              href="/marketplace/messages"
              className="relative hidden sm:inline-flex p-2 text-[#fffafa] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
              aria-label="Messages"
            >
              <MessageSquare className="size-5" />
            </Link>

            {/* Notifications Button */}
            <Link
              href="/marketplace/notifications"
              className="relative p-2 text-[#fffafa] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
              aria-label={`Notifications ${unreadNotificationsCount > 0 ? `(${unreadNotificationsCount} unread)` : ""}`}
            >
              <Bell className="size-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2.5 bg-emerald-400 rounded-full ring-2 ring-[#211a24]" />
              )}
            </Link>

            {/* User Profile Avatar / Accessible Dropdown Menu */}
            <div className="pl-1 border-l border-white/10 relative" ref={userMenuRef}>
              <button
                ref={userButtonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="flex items-center gap-2 p-1.5 text-[#fffafa] hover:bg-[#342339] rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer"
                aria-label="User account menu"
              >
                <div className="size-7 rounded-full bg-[#65486f] border border-white/10 flex items-center justify-center text-xs font-bold text-[#fffafa]">
                  {displayInitial}
                </div>
                <span className="hidden lg:inline text-xs font-semibold max-w-[90px] truncate text-[#fffafa]">
                  {displayName}
                </span>
                <ChevronDown className="size-3.5 text-[#b9adb6] hidden sm:block" />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute right-0 top-12 w-56 glass-dropdown rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95"
                >
                  {/* Account Summary Header */}
                  <div className="px-4 py-2 border-b border-white/10 mb-1">
                    <div className="text-xs font-bold text-[#fffafa] truncate">
                      {displayName}
                    </div>
                    <div className="text-[11px] text-[#b9adb6] truncate">
                      {displayEmail}
                    </div>
                  </div>

                  {/* Menu Items */}
                  <Link
                    href={isSeller ? "/seller" : "/sell"}
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#fffafa] hover:bg-[#342339] hover:text-[#e59bc9] transition-colors"
                  >
                    <Package className="size-3.5 text-[#e59bc9]" />
                    <span>{isSeller ? "Seller Dashboard" : "Start Selling"}</span>
                  </Link>


                  <Link
                    href="/marketplace/profile"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#fffafa] hover:bg-[#342339] hover:text-[#e59bc9] transition-colors"
                  >
                    <User className="size-3.5 text-[#e59bc9]" />
                    <span>View profile</span>
                  </Link>

                  <Link
                    href="/marketplace/messages"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#fffafa] hover:bg-[#342339] hover:text-[#e59bc9] transition-colors"
                  >
                    <MessageSquare className="size-3.5 text-[#e59bc9]" />
                    <span>Messages</span>
                  </Link>

                  <Link
                    href="/marketplace/orders"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#fffafa] hover:bg-[#342339] hover:text-[#e59bc9] transition-colors"
                  >
                    <Package className="size-3.5 text-[#e59bc9]" />
                    <span>My orders</span>
                  </Link>

                  <Link
                    href="/marketplace/settings"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#fffafa] hover:bg-[#342339] hover:text-[#e59bc9] transition-colors"
                  >
                    <Settings className="size-3.5 text-[#e59bc9]" />
                    <span>Settings</span>
                  </Link>

                  <div className="my-1 border-t border-white/10" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="size-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: Mobile Search Bar */}
        <div className="flex md:hidden items-center pb-3 pt-1">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#b9adb6]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products, brands, or categories"
              className="w-full h-10 pl-10 pr-4 bg-[#342339] border border-white/10 text-[#fffafa] placeholder:text-[#b9adb6] focus:border-[#e59bc9] focus:outline-none focus:ring-2 focus:ring-[#e59bc9]/30 rounded-xl text-xs transition-all"
            />
          </form>
        </div>
      </div>
    </header>
  );
}
