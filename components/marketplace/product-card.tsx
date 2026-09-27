"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  Eye,
  MapPin,
  CheckCircle2,
  Star,
  ShoppingCart,
  Laptop,
  Smartphone,
  Headphones,
  Gamepad2,
  Cpu,
  Layers,
  Package,
  Loader2,
} from "lucide-react";
import { Product } from "./marketplace-data";
import { useMarketplaceAccount } from "./marketplace-account";

interface ProductCardProps {
  product: Product;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({
  product,
  isWishlisted,
  onToggleWishlist,
  onQuickView,
  onAddToCart,
}: ProductCardProps) {
  const { userId, isLoading } = useMarketplaceAccount();
  const isOwner = Boolean(userId && product.sellerId === userId);
  const compactLocation = product.location.split(",")[0]?.trim() || product.location;

  const getFallbackIcon = (category: string) => {
    switch (category) {
      case "Laptops":
        return <Laptop className="size-8 text-[#65486f]" />;
      case "Mobile":
        return <Smartphone className="size-8 text-[#65486f]" />;
      case "Audio":
        return <Headphones className="size-8 text-[#65486f]" />;
      case "Gaming":
        return <Gamepad2 className="size-8 text-[#65486f]" />;
      case "Components":
        return <Cpu className="size-8 text-[#65486f]" />;
      default:
        return <Layers className="size-8 text-[#65486f]" />;
    }
  };

  return (
    <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[#eadcde] bg-[#f8f3f3] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[#65486f]/50 hover:shadow-lg active:translate-y-0 motion-reduce:transform-none dark:border-white/10 dark:bg-[#211a24]">
      {/* 1. Compact discovery media on mobile; rich square media returns at desktop. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#ebe2e5] lg:aspect-square dark:bg-[#342339]">
        <Link
          href={`/marketplace/products/${product.id}`}
          className="relative flex size-full items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#65486f]"
          aria-label={`View details for ${product.name}`}
        >
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="pointer-events-none select-none object-cover object-center transition-transform duration-200 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
              {getFallbackIcon(product.category)}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#65486f]/80">
                {product.category}
              </span>
            </div>
          )}
        </Link>

        {/* Floating Top Badges & Wishlist Trigger */}
        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 z-10 flex items-center justify-between gap-1 lg:inset-x-2 lg:top-2">
          {isOwner ? (
            <span className="rounded-md bg-[#19131b]/85 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-[#e59bc9] shadow-xs">
              Your listing
            </span>
          ) : (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-xs backdrop-blur-xs lg:px-2 lg:text-[10px] lg:tracking-wider ${
                product.condition === "New"
                  ? "bg-emerald-700/90 text-white"
                  : product.condition === "Like New"
                  ? "bg-[#65486f]/90 text-white"
                  : product.condition === "Good"
                  ? "bg-[#334155]/90 text-white"
                  : "bg-amber-700/90 text-white"
              }`}
            >
              {product.condition}
            </span>
          )}

          {!isOwner && (
            <button
              type="button"
              disabled={isLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleWishlist(product.id);
              }}
              className={`flex size-9 items-center justify-center rounded-full transition-colors cursor-pointer pointer-events-auto shadow-xs backdrop-blur-xs ${
                isWishlisted
                  ? "text-rose-600 bg-white/95 hover:bg-white"
                  : "text-[#1d1720] bg-white/80 hover:bg-white"
              }`}
              aria-label={isWishlisted ? `Remove ${product.name} from saved items` : `Save ${product.name}`}
            >
              <Heart className={`size-3.5 ${isWishlisted ? "fill-rose-600" : ""}`} />
            </button>
          )}
        </div>

        {/* Quick View Button on Image hover */}
        <button
          type="button"
          onClick={() => onQuickView(product)}
          className="absolute inset-x-2 bottom-2 z-10 hidden cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#19131b]/88 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-sm transition-all duration-150 hover:bg-[#19131b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65486f] lg:flex lg:translate-y-1 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100"
          aria-label={`Quick view ${product.name}`}
        >
          <Eye className="size-3 text-[#e59bc9]" />
          <span>Quick view</span>
        </button>
      </div>

      {/* 2. Compact Card Body Content */}
      <div className="flex flex-1 flex-col justify-between gap-1 p-2 lg:gap-1.5 lg:p-3">
        <div className="space-y-1 lg:space-y-0.5">
          {/* Product Title (Max 2 lines) */}
          <h3 className="line-clamp-2 min-h-7 text-[11px] font-bold leading-tight text-[#1d1720] transition-colors group-hover:text-[#65486f] sm:text-xs lg:min-h-0 lg:text-[13px] dark:text-[#fffafa] dark:group-hover:text-[#e59bc9]">
            <Link
              href={`/marketplace/products/${product.id}`}
              className="hover:underline focus-visible:outline-2 focus-visible:outline-[#65486f] rounded-xs"
              title={product.name}
            >
              {product.name}
            </Link>
          </h3>

          {/* Short description / spec preview (Max 1 line) */}
          <p className="hidden text-[11px] leading-normal text-[#716872] lg:line-clamp-1 dark:text-[#b9adb6]">
            {product.specs}
          </p>

          {/* Seller / Verification Line & Location */}
          <div className="hidden items-center justify-between gap-1 pt-0.5 text-[11px] text-[#716872] lg:flex dark:text-[#b9adb6]">
            <div className="flex min-w-0 items-center gap-1 font-medium text-[#65486f] dark:text-[#e59bc9]">
              <span className="truncate max-w-[95px] sm:max-w-[115px]">{product.sellerName}</span>
              {product.isVerifiedSeller && (
                <CheckCircle2 className="size-3 text-emerald-600 fill-emerald-100 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-0.5 text-[#716872] shrink-0">
              <MapPin className="size-2.5 shrink-0" />
              <span className="truncate max-w-[70px]">{product.location}</span>
            </div>
          </div>

          {/* Rating / Reviews */}
          <div className="hidden items-center gap-1 text-[11px] text-[#716872] lg:flex dark:text-[#b9adb6]">
            {product.reviewCount > 0 ? (
              <>
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-[#1d1720] dark:text-[#fffafa]">{product.rating}</span>
                <span className="text-[10px] text-[#716872]">({product.reviewCount})</span>
              </>
            ) : (
              <span className="text-[10px] text-[#716872]/80">No reviews</span>
            )}
          </div>

          {/* One concise discovery signal replaces three verbose metadata rows on mobile. */}
          <div className="flex min-w-0 items-center gap-1 text-[10px] leading-none text-[#716872] lg:hidden dark:text-[#b9adb6]">
            <Star className={`size-3 shrink-0 ${product.reviewCount > 0 ? "fill-amber-400 text-amber-400" : "text-[#9b9099]"}`} />
            <span className="shrink-0 font-semibold text-[#1d1720] dark:text-[#fffafa]">
              {product.reviewCount > 0 ? product.rating : "New"}
            </span>
            <span className="shrink-0 text-[#b7abb3] dark:text-[#756b73]">·</span>
            <MapPin className="size-2.5 shrink-0" />
            <span className="truncate" title={product.location}>{compactLocation}</span>
          </div>
        </div>

        {/* Bottom Action Row: Price + Cart/Manage */}
        <div className="flex items-center justify-between gap-1.5 border-t border-[#eadcde]/80 pt-1.5 lg:pt-1.5 dark:border-white/10">
          <div className="min-w-0">
            <div className="text-[13px] font-black leading-none tracking-tight text-[#1d1720] sm:text-sm lg:text-base dark:text-[#fffafa]">
              ₱{product.price.toLocaleString()}
            </div>
            {product.originalPrice && (
              <div className="mt-0.5 hidden text-[10px] leading-tight text-[#716872] line-through sm:block dark:text-[#b9adb6]">
                ₱{product.originalPrice.toLocaleString()}
              </div>
            )}
          </div>

          {isOwner ? (
            <Link
              href={`/seller/products?listing=${encodeURIComponent(product.id)}`}
              className="inline-flex size-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-[#65486f] p-0 text-[11px] font-semibold text-[#fffafa] transition-colors hover:bg-[#7a5985] focus-visible:outline-2 focus-visible:outline-[#e59bc9] lg:h-auto lg:min-h-9 lg:w-auto lg:px-2 lg:py-1.5"
              aria-label={`Manage listing for ${product.name}`}
            >
              <Package className="size-3" />
              <span className="hidden lg:inline">Manage</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToCart(product);
              }}
              className="inline-flex size-9 items-center justify-center text-[#fffafa] bg-[#65486f] hover:bg-[#7a5985] rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer disabled:cursor-wait disabled:opacity-50 shrink-0"
              aria-label={isLoading ? "Loading listing actions" : `Add ${product.name} to cart`}
            >
              {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ShoppingCart className="size-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
