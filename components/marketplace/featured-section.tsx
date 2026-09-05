"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, MapPin, Eye, ShoppingCart, Sparkles } from "lucide-react";
import { Product } from "./marketplace-data";

interface FeaturedSectionProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function FeaturedSection({
  product,
  onAddToCart,
}: FeaturedSectionProps) {
  return (
    <section
      aria-label="Featured Discovery"
      className="w-full bg-[#211a24] border border-white/10 rounded-3xl p-6 sm:p-8 overflow-hidden relative shadow-xl min-h-[260px] flex items-center"
    >
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left Column: Heading & Copy (7 cols) */}
        <div className="md:col-span-7 lg:col-span-8 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#342339] border border-white/10 rounded-full text-xs font-semibold text-[#e59bc9]">
            <Sparkles className="size-3.5 text-[#e59bc9]" />
            <span>Featured Deal</span>
            {product.condition && (
              <>
                <span className="text-white/30">•</span>
                <span className="text-white font-medium">{product.condition}</span>
              </>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#fffafa] leading-tight">
            {product.name}
          </h2>

          <p className="text-xs sm:text-sm text-[#d6cbd5] leading-relaxed max-w-xl line-clamp-2">
            {product.specs}
          </p>

          {/* Seller & Location Info */}
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-[#d6cbd5]">
            <div className="flex items-center gap-1 font-semibold text-[#e59bc9]">
              <span>{product.sellerName}</span>
              {product.isVerifiedSeller && (
                <CheckCircle2 className="size-3.5 text-emerald-400 fill-emerald-400/20" />
              )}
            </div>
            <span className="text-[#d6cbd5]/40">•</span>
            <div className="flex items-center gap-1">
              <MapPin className="size-3.5 text-[#d6cbd5]" />
              <span>{product.location}</span>
            </div>
          </div>

          {/* Price & Action Row */}
          <div className="flex flex-wrap items-baseline gap-3 pt-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#fffafa]">
              ₱{product.price.toLocaleString()}
            </div>
            {product.originalPrice && (
              <div className="text-xs sm:text-sm text-[#b9adb6] line-through">
                ₱{product.originalPrice.toLocaleString()}
              </div>
            )}
            {product.originalPrice && (
              <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-700/50">
                Save ₱{(product.originalPrice - product.price).toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1.5">
            <Link
              href={`/marketplace/products/${product.id}`}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-[#fffafa] rounded-xl transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              <Eye className="size-4" />
              <span>View product</span>
            </Link>

            <button
              type="button"
              onClick={() => onAddToCart(product)}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-xs font-semibold bg-transparent text-[#fffafa] border border-white/20 hover:bg-white/10 rounded-xl transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              <ShoppingCart className="size-4 text-[#e59bc9]" />
              <span>Add to cart</span>
            </button>
          </div>
        </div>

        {/* Right Column: Transparent Product Artwork (5 cols) */}
        <div className="md:col-span-5 lg:col-span-4 flex items-center justify-center relative min-h-[160px] sm:min-h-[200px]">
          {product.image && (
            <Link
              href={`/marketplace/products/${product.id}`}
              className="relative w-full max-w-[280px] h-44 sm:h-52 flex items-center justify-center group"
              aria-label={`View ${product.name}`}
            >
              <Image
                src={product.image}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 320px"
                className="object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)] group-hover:scale-105 transition-transform duration-200"
              />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
