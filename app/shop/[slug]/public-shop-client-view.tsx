"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  ShieldCheck,
  MapPin,
  Star,
  CheckCircle2,
  Package,
  Calendar,
  Clock,
  Truck,
  MessageSquare,
  ArrowLeft,
  Share2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { ProductCard } from "@/components/marketplace/product-card";
import { QuickViewDialog } from "@/components/marketplace/quick-view-dialog";
import {
  type Product,
  CATEGORIES,
} from "@/components/marketplace/marketplace-data";
import { type SellerShopProfile } from "@/lib/seller/seller-data";
import { toast } from "sonner";

interface PublicShopClientViewProps {
  profile: SellerShopProfile;
  products: Product[];
}

export function PublicShopClientView({
  profile,
  products,
}: PublicShopClientViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat =
      selectedCategory === "All" || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.specs.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
        >
          <ArrowLeft className="size-3.5 text-[#e59bc9]" />
          <span>Back to Marketplace</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Shop link copied to clipboard!");
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#d6cbd5] hover:text-white transition-colors cursor-pointer"
        >
          <Share2 className="size-3.5 text-[#e59bc9]" />
          <span>Share Shop</span>
        </button>
      </div>

      {/* ======================================================= */}
      {/* 1. SHOP HERO BANNER & IDENTITY CARD                     */}
      {/* ======================================================= */}
      <div className="bg-[#1e1322]/85 backdrop-blur-xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
        {/* Cover Banner */}
        <div className="h-40 sm:h-52 bg-gradient-to-r from-[#432c45] via-[#281729] to-[#684d72] relative p-6 flex items-end">
          <div className="absolute top-4 right-4">
            <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-black/40 backdrop-blur-xs text-white/90 border border-white/10">
              {profile.businessType}
            </span>
          </div>
        </div>

        {/* Profile Details Area */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 -mt-20 sm:-mt-24">
            <div className="flex items-end gap-4">
              <div className="size-24 sm:size-28 rounded-3xl bg-[#3d2743] border-4 border-[#1e1322] flex items-center justify-center text-[#e59bc9] font-black text-3xl sm:text-4xl shadow-2xl shrink-0">
                {profile.shopName.charAt(0)}
              </div>
              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-3xl font-extrabold text-[#fffafa] tracking-tight">
                    {profile.shopName}
                  </h1>
                  {profile.isVerified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                      <ShieldCheck className="size-3.5" />
                      Verified Seller
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-[#e59bc9] font-semibold mt-0.5">
                  @{profile.slug} &bull; Member since {profile.memberSince}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <Link
                href="/seller/messages"
                className="px-5 py-2.5 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="size-3.5" />
                <span>Message Seller</span>
              </Link>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-[#d6cbd5] leading-relaxed max-w-3xl">
            {profile.description}
          </p>

          {/* Highlights & Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.08]">
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[11px] text-[#b9adb6] block">
                Seller Rating
              </span>
              <p className="text-base sm:text-lg font-extrabold text-[#fffafa] mt-0.5 flex items-center gap-1">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <span>{profile.rating}</span>
                <span className="text-xs text-[#8f7d8c] font-normal">
                  ({profile.reviewCount})
                </span>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[11px] text-[#b9adb6] block">
                Completed Orders
              </span>
              <p className="text-base sm:text-lg font-extrabold text-emerald-400 mt-0.5">
                {profile.completedOrders} orders
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[11px] text-[#b9adb6] block">
                Response Rate
              </span>
              <p className="text-base sm:text-lg font-extrabold text-[#e59bc9] mt-0.5">
                {profile.responseRate}% (under 15m)
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[11px] text-[#b9adb6] block">
                Location & Dispatch
              </span>
              <p className="text-xs sm:text-sm font-bold text-[#fffafa] mt-0.5 truncate">
                {profile.location}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* 2. SHOP PRODUCT CATALOGUE & FILTER CONTROLS             */}
      {/* ======================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#fffafa]">
              Listings from {profile.shopName}
            </h2>
            <p className="text-xs text-[#b9adb6] mt-0.5">
              Browse authenticated hardware available for meetup and delivery
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[#b9adb6] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this shop..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#1e1322]/80 border border-white/10 text-xs font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] transition-colors"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none no-scrollbar py-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-[#65486f] text-white border border-white/20 shadow-xs"
                    : "bg-[#1e1322]/60 hover:bg-[#342339] text-[#b9adb6] hover:text-white border border-white/[0.06]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-[#1e1322]/80 border border-white/[0.08] rounded-2xl">
            <Package className="size-8 text-[#e59bc9] mx-auto" />
            <h3 className="text-base font-bold text-[#fffafa]">
              No listings found
            </h3>
            <p className="text-xs text-[#b9adb6]">
              Try choosing a different category or clearing your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                isWishlisted={favorites.includes(prod.id)}
                onToggleWishlist={toggleFavorite}
                onQuickView={setQuickViewProduct}
                onAddToCart={(p) => toast.success(`Added "${p.name}" to cart!`)}
              />
            ))}
          </div>
        )}
      </div>

      <QuickViewDialog
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isWishlisted={
          quickViewProduct ? favorites.includes(quickViewProduct.id) : false
        }
        onToggleWishlist={toggleFavorite}
        onAddToCart={(prod) => toast.success(`Added "${prod.name}" to cart!`)}
      />
    </div>
  );
}
