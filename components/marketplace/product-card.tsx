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
} from "lucide-react";
import { Product } from "./marketplace-data";

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
  const getFallbackIcon = (category: string) => {
    switch (category) {
      case "Laptops":
        return <Laptop className="size-10 text-[#65486f]" />;
      case "Mobile":
        return <Smartphone className="size-10 text-[#65486f]" />;
      case "Audio":
        return <Headphones className="size-10 text-[#65486f]" />;
      case "Gaming":
        return <Gamepad2 className="size-10 text-[#65486f]" />;
      case "Components":
        return <Cpu className="size-10 text-[#65486f]" />;
      default:
        return <Layers className="size-10 text-[#65486f]" />;
    }
  };

  return (
    <div className="group bg-[#f8f3f3] border border-[#eadcde] hover:border-[#65486f]/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none hover:shadow-lg relative">
      {/* Clickable Card Link Area */}
      <div>
        {/* Top Bar: Condition Badge & Wishlist Button */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-md ${
              product.condition === "New"
                ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                : product.condition === "Like New"
                ? "bg-[#eadcde] text-[#65486f] border border-[#d8c2c8]"
                : product.condition === "Good"
                ? "bg-[#e2e8f0] text-[#334155] border border-slate-300"
                : "bg-amber-100 text-amber-900 border border-amber-200"
            }`}
          >
            {product.condition}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWishlist(product.id);
            }}
            className={`p-1.5 rounded-full transition-colors cursor-pointer relative z-10 ${
              isWishlisted
                ? "text-rose-600 bg-rose-50 hover:bg-rose-100"
                : "text-[#716872] hover:text-[#1d1720] hover:bg-[#eadcde]"
            }`}
            aria-label={isWishlisted ? `Remove ${product.name} from saved items` : `Save ${product.name}`}
          >
            <Heart className={`size-4 ${isWishlisted ? "fill-rose-600" : ""}`} />
          </button>
        </div>

        {/* Product Visual Container with Real Image */}
        <div className="relative mb-3.5 aspect-[4/3] overflow-hidden rounded-xl border border-[#ded0d5] bg-[#ebe2e5]">
          <Link
            href={`/marketplace/products/${product.id}`}
            className="relative flex size-full items-center justify-center p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#65486f]"
            aria-label={`View details for ${product.name}`}
          >
            {product.image ? (
              <div className="relative flex size-full items-center justify-center">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="pointer-events-none select-none object-contain p-2 transition-transform duration-150 ease-out group-hover:scale-[1.02]"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                {getFallbackIcon(product.category)}
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#65486f]/80">
                  {product.category}
                </span>
              </div>
            )}
          </Link>

          {/* Quick View Button */}
          <button
            type="button"
            onClick={() => onQuickView(product)}
            className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-center gap-1.5 rounded-lg bg-[#19131b]/88 py-2 text-xs font-semibold text-white shadow-md backdrop-blur-sm transition-all duration-150 hover:bg-[#19131b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65486f] sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 cursor-pointer"
            aria-label={`Quick view ${product.name}`}
          >
            <Eye className="size-3.5 text-[#e59bc9]" />
            <span>Quick view</span>
          </button>
        </div>

        {/* Title */}
        <h3 className="text-sm sm:text-[15px] font-bold text-[#1d1720] line-clamp-2 leading-snug group-hover:text-[#65486f] transition-colors mb-1.5">
          <Link
            href={`/marketplace/products/${product.id}`}
            className="hover:underline focus-visible:outline-2 focus-visible:outline-[#65486f] rounded-xs"
            title={product.name}
          >
            {product.name}
          </Link>
        </h3>

        {/* Rating & Review Count */}
        <div className="flex items-center gap-1 text-xs text-[#716872] mb-1.5">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-[#1d1720]">{product.rating}</span>
          <span className="text-[#716872]">({product.reviewCount})</span>
        </div>

        {/* Specs snippet */}
        <p className="text-xs text-[#716872] line-clamp-1 mb-3 leading-relaxed">
          {product.specs}
        </p>
      </div>

      {/* Bottom Section: Seller, Location, Price & Cart Action */}
      <div className="pt-3 border-t border-[#eadcde] space-y-2.5">
        {/* Seller Name & Location */}
        <div className="space-y-0.5 text-xs text-[#716872]">
          <div className="flex items-center gap-1 font-semibold text-[#65486f]">
            <span className="truncate max-w-[160px]">{product.sellerName}</span>
            {product.isVerifiedSeller && (
              <CheckCircle2 className="size-3.5 text-emerald-600 fill-emerald-100 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1 text-[#716872]">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{product.location}</span>
          </div>
        </div>

        {/* Price & Add to Cart Action */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-extrabold text-[#1d1720]">
              ₱{product.price.toLocaleString()}
            </div>
            {product.originalPrice && (
              <div className="text-[11px] text-[#716872] line-through">
                ₱{product.originalPrice.toLocaleString()}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="p-2 text-[#fffafa] bg-[#65486f] hover:bg-[#7a5985] rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
