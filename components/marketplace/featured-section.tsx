"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, MapPin, Eye, ShoppingCart, Sparkles, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "./marketplace-data";

interface FeaturedSectionProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export function FeaturedSection({
  product,
  onAddToCart,
}: FeaturedSectionProps) {
  return (
    <section
      aria-label="Featured Discovery"
      className="w-full bg-[#211a24] border border-white/10 rounded-3xl p-6 sm:p-8 overflow-hidden relative shadow-xl min-h-[340px] flex items-center"
    >
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left Column: Heading & Copy */}
        <div className="md:col-span-6 lg:col-span-7 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#342339] border border-white/10 rounded-full text-xs font-semibold text-[#e59bc9]">
            <Sparkles className="size-3.5 text-[#e59bc9]" />
            <span>Featured Deal</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#fffafa] leading-tight">
            Technology worth discovering
          </h2>

          <p className="text-sm text-[#d6cbd5] leading-relaxed max-w-lg">
            Explore verified new and pre-owned tech from trusted sellers across Cebu and the Visayas. Quality tested, transparently priced.
          </p>

          {/* Seller & Location Info */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#d6cbd5]">
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

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Link
              href={`/marketplace/products/${product.id}`}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-[#fffafa] rounded-xl transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              <Eye className="size-4" />
              <span>View product</span>
            </Link>
            <Button
              type="button"
              onClick={() => onAddToCart(product)}
              className="h-10 px-4 text-xs font-semibold bg-transparent text-[#fffafa] border border-white/20 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <ShoppingCart className="size-4 text-[#e59bc9]" />
              <span>Add to cart</span>
            </Button>
          </div>
        </div>

        {/* Right Column: Featured Product Card Preview */}
        <div className="md:col-span-6 lg:col-span-5 flex justify-center md:justify-end">
          <div className="w-full max-w-sm bg-[#f8f3f3] text-[#1d1720] border border-[#eadcde] rounded-2xl p-4 shadow-[0_12px_28px_rgba(25,19,27,0.5)] relative space-y-3">
            {/* Condition Badge & Savings */}
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#65486f] bg-[#eadcde] rounded-md">
                {product.condition}
              </span>
              {product.originalPrice && (
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Save ₱{(product.originalPrice - product.price).toLocaleString()}
                </span>
              )}
            </div>

            {/* Product Image Box */}
            <Link
              href={`/marketplace/products/${product.id}`}
              className="block relative rounded-xl overflow-hidden bg-[#ebe2e5] border border-[#ded0d5] h-40 flex items-center justify-center p-3 group"
              aria-label={`View ${product.name}`}
            >
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 360px"
                  className="object-contain p-2 group-hover:scale-[1.02] transition-transform duration-150 ease-out"
                />
              ) : (
                <div className="flex items-center justify-center">
                  <Laptop className="size-12 text-[#65486f]" />
                </div>
              )}
            </Link>

            {/* Product Title & Specs */}
            <div>
              <h3 className="text-base font-bold text-[#1d1720] line-clamp-1">
                <Link
                  href={`/marketplace/products/${product.id}`}
                  className="hover:underline"
                >
                  {product.name}
                </Link>
              </h3>
              <p className="text-xs text-[#716872] line-clamp-2 mt-1 leading-relaxed">
                {product.specs}
              </p>
            </div>

            {/* Price Row */}
            <div className="flex items-baseline gap-2 pt-1 border-t border-[#eadcde]">
              <span className="text-2xl font-extrabold text-[#1d1720]">
                ₱{product.price.toLocaleString()}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-[#716872] line-through">
                  ₱{product.originalPrice.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
