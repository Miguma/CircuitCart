"use client";

import React from "react";
import { Heart, Eye, MapPin, CheckCircle2, Star, ShoppingCart } from "lucide-react";
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
  return (
    <div className="group bg-[#f8f3f3] border border-[#eadcde] hover:border-[#65486f]/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg relative">
      {/* Top Bar: Condition Badge & Wishlist Button */}
      <div>
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
            onClick={() => onToggleWishlist(product.id)}
            className={`p-1.5 rounded-full transition-all ${
              isWishlisted
                ? "text-rose-600 bg-rose-50 hover:bg-rose-100"
                : "text-[#716872] hover:text-[#1d1720] hover:bg-[#eadcde]"
            }`}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`size-4 ${isWishlisted ? "fill-rose-600" : ""}`} />
          </button>
        </div>

        {/* Product Visual Banner / Tech Graphic */}
        <div
          className="w-full h-36 rounded-xl mb-3.5 flex items-center justify-center relative overflow-hidden group-hover:scale-[1.01] transition-transform duration-200 shadow-inner"
          style={{
            background: `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
          }}
        >
          <div className="text-white/90 text-center px-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-pink-200/70 block mb-1">
              {product.category}
            </span>
            <span className="text-sm font-bold text-white line-clamp-1">
              {product.name}
            </span>
          </div>

          {/* Quick View Overlay Button */}
          <button
            type="button"
            onClick={() => onQuickView(product)}
            className="absolute inset-0 bg-[#19131b]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-xs font-semibold text-white"
          >
            <Eye className="size-4 text-[#e59bc9]" />
            Quick view
          </button>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-[#1d1720] line-clamp-2 leading-snug group-hover:text-[#65486f] transition-colors mb-1.5">
          {product.name}
        </h3>

        {/* Rating & Review Count */}
        <div className="flex items-center gap-1 text-xs text-[#716872] mb-2">
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
            <span className="truncate max-w-[150px]">{product.sellerName}</span>
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
            onClick={() => onAddToCart(product)}
            className="p-2 text-[#fffafa] bg-[#65486f] hover:bg-[#7a5985] rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
