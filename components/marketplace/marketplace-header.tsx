"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  Heart,
  ShoppingCart,
  Bell,
  PlusCircle,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarketplaceHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  wishlistCount: number;
  cartCount: number;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export function MarketplaceHeader({
  searchQuery,
  onSearchChange,
  wishlistCount,
  cartCount,
  selectedCategory,
  onSelectCategory,
}: MarketplaceHeaderProps) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  const categories = [
    "All",
    "Laptops",
    "Gaming",
    "Components",
    "Mobile",
    "Audio",
    "Accessories",
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#211a24]/95 backdrop-blur-md border-b border-white/10 shadow-lg transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ROW 1: Logo, Search (desktop), Actions */}
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-6">
          {/* Logo / Brand Mark */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 select-none focus-visible:outline-2 focus-visible:outline-[#e59bc9] rounded-xs shrink-0"
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

          {/* DESKTOP SEARCH & CATEGORY SELECTOR */}
          <div className="hidden md:flex items-center flex-1 max-w-2xl relative gap-2">
            {/* Category Dropdown Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCategoryMenu((prev) => !prev)}
                className="inline-flex items-center gap-1.5 h-10 px-3 text-xs font-semibold text-[#fffafa] bg-[#342339] border border-white/10 hover:bg-[#45304b] rounded-xl transition-colors shrink-0"
              >
                <SlidersHorizontal className="size-3.5 text-[#e59bc9]" />
                <span className="truncate max-w-[90px]">{selectedCategory}</span>
                <ChevronDown className="size-3.5 text-[#b9adb6]" />
              </button>

              {/* Category Dropdown Menu */}
              {showCategoryMenu && (
                <div className="absolute top-12 left-0 w-44 bg-[#211a24] border border-white/10 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onSelectCategory(cat);
                        setShowCategoryMenu(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors ${
                        selectedCategory === cat
                          ? "bg-[#65486f] text-[#fffafa] font-semibold"
                          : "text-[#b9adb6] hover:bg-[#342339] hover:text-[#fffafa]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#b9adb6]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search products, brands, or categories"
                className="w-full h-10 pl-10 pr-4 bg-[#342339] border border-white/10 text-[#fffafa] placeholder:text-[#b9adb6] focus:border-[#e59bc9] focus:outline-none focus:ring-2 focus:ring-[#e59bc9]/30 rounded-xl text-sm transition-all"
              />
            </div>
          </div>

          {/* ACTIONS & USER MENU */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sell Button */}
            <Button
              type="button"
              onClick={() => alert("Seller listing creation will be built in a future step.")}
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-[#fffafa] rounded-xl shadow-xs transition-colors"
            >
              <PlusCircle className="size-4 text-[#e59bc9]" />
              <span>Sell</span>
            </Button>

            {/* Wishlist Button */}
            <button
              type="button"
              onClick={() => alert(`Wishlist contains ${wishlistCount} item(s).`)}
              className="relative p-2 text-[#fffafa] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors"
              aria-label={`Wishlist with ${wishlistCount} items`}
            >
              <Heart className="size-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 size-4 bg-[#b78bd7] text-[#19131b] text-[10px] font-extrabold rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart Button */}
            <button
              type="button"
              onClick={() => alert(`Shopping cart contains ${cartCount} item(s).`)}
              className="relative p-2 text-[#fffafa] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors"
              aria-label={`Cart with ${cartCount} items`}
            >
              <ShoppingCart className="size-5" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 size-4 bg-[#e59bc9] text-[#19131b] text-[10px] font-extrabold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Notifications */}
            <button
              type="button"
              onClick={() => alert("You have 2 new buyer updates.")}
              className="relative p-2 text-[#fffafa] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-emerald-400 rounded-full ring-2 ring-[#211a24]" />
            </button>

            {/* User Profile Avatar / Menu */}
            <div className="pl-1 border-l border-white/10">
              <button
                type="button"
                onClick={() => alert("User profile menu: Demo Account (demo@marketplace.test)")}
                className="flex items-center gap-2 p-1.5 text-[#fffafa] hover:bg-[#342339] rounded-xl transition-colors"
                aria-label="User menu"
              >
                <div className="size-7 rounded-full bg-[#65486f] border border-white/10 flex items-center justify-center text-xs font-bold text-[#fffafa]">
                  D
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2: MOBILE SEARCH INPUT */}
        <div className="flex md:hidden pb-3">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#b9adb6]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products, brands, or categories"
              className="w-full h-10 pl-10 pr-4 bg-[#342339] border border-white/10 text-[#fffafa] placeholder:text-[#b9adb6] focus:border-[#e59bc9] focus:outline-none focus:ring-2 focus:ring-[#e59bc9]/30 rounded-xl text-sm transition-all"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
