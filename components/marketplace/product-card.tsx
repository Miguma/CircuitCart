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
    <div className="group bg-[#f8f3f3] border border-[#eadcde] hover:border-[#65486f]/50 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none hover:shadow-lg relative h-full">
      {/* 1. Large Top-Flush Product Image Area */}
      <div className="relative w-full aspect-square bg-[#ebe2e5] overflow-hidden">
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
        <div className="absolute top-2 inset-x-2 z-10 flex items-center justify-between gap-1 pointer-events-none">
          {isOwner ? (
            <span className="rounded-md bg-[#19131b]/85 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-[#e59bc9] shadow-xs">
              Your listing
            </span>
          ) : (
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md shadow-xs backdrop-blur-xs ${
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
              className={`p-1.5 rounded-full transition-colors cursor-pointer pointer-events-auto shadow-xs backdrop-blur-xs ${
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
          className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-center gap-1 rounded-lg bg-[#19131b]/88 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-sm transition-all duration-150 hover:bg-[#19131b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65486f] sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 cursor-pointer"
          aria-label={`Quick view ${product.name}`}
        >
          <Eye className="size-3 text-[#e59bc9]" />
          <span>Quick view</span>
        </button>
      </div>

      {/* 2. Compact Card Body Content */}
      <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-1.5">
        <div className="space-y-0.5">
          {/* Product Title (Max 2 lines) */}
          <h3 className="text-xs sm:text-[13px] font-bold text-[#1d1720] line-clamp-2 leading-tight group-hover:text-[#65486f] transition-colors">
            <Link
              href={`/marketplace/products/${product.id}`}
              className="hover:underline focus-visible:outline-2 focus-visible:outline-[#65486f] rounded-xs"
              title={product.name}
            >
              {product.name}
            </Link>
          </h3>

          {/* Short description / spec preview (Max 1 line) */}
          <p className="text-[11px] text-[#716872] line-clamp-1 leading-normal">
            {product.specs}
          </p>

          {/* Seller / Verification Line & Location */}
          <div className="flex items-center justify-between gap-1 text-[11px] text-[#716872] pt-0.5">
            <div className="flex items-center gap-1 font-medium text-[#65486f] min-w-0">
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
          <div className="flex items-center gap-1 text-[11px] text-[#716872]">
            {product.reviewCount > 0 ? (
              <>
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-[#1d1720]">{product.rating}</span>
                <span className="text-[10px] text-[#716872]">({product.reviewCount})</span>
              </>
            ) : (
              <span className="text-[10px] text-[#716872]/80">No reviews</span>
            )}
          </div>
        </div>

        {/* Bottom Action Row: Price + Cart/Manage */}
        <div className="pt-1.5 border-t border-[#eadcde]/80 flex items-center justify-between gap-1.5">
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-black text-[#1d1720] tracking-tight leading-none">
              ₱{product.price.toLocaleString()}
            </div>
            {product.originalPrice && (
              <div className="text-[10px] text-[#716872] line-through leading-tight mt-0.5">
                ₱{product.originalPrice.toLocaleString()}
              </div>
            )}
          </div>

          {isOwner ? (
            <Link
              href={`/seller/products?listing=${encodeURIComponent(product.id)}`}
              className="inline-flex items-center gap-1 rounded-lg bg-[#65486f] px-2 py-1.5 text-[11px] font-semibold text-[#fffafa] transition-colors hover:bg-[#7a5985] focus-visible:outline-2 focus-visible:outline-[#e59bc9] shrink-0"
              aria-label={`Manage listing for ${product.name}`}
            >
              <Package className="size-3" />
              <span>Manage</span>
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
              className="p-1.5 text-[#fffafa] bg-[#65486f] hover:bg-[#7a5985] rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer disabled:cursor-wait disabled:opacity-50 shrink-0"
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

