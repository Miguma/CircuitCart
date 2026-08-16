"use client";

import React, { useEffect } from "react";
import {
  X,
  Star,
  CheckCircle2,
  MapPin,
  Heart,
  ShoppingCart,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "./marketplace-data";

interface QuickViewDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onAddToCart: (product: Product) => void;
}

export function QuickViewDialog({
  product,
  isOpen,
  onClose,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
}: QuickViewDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#19131b]/80 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Modal Container */}
      <div
        className="bg-[#f8f3f3] text-[#1d1720] border border-[#eadcde] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#716872] hover:text-[#1d1720] bg-[#eadcde] hover:bg-[#d8c2c8] rounded-full transition-colors z-10"
          aria-label="Close details"
        >
          <X className="size-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 max-h-[85vh] overflow-y-auto">
          {/* Left Visual Banner */}
          <div
            className="md:col-span-5 p-6 flex flex-col justify-between text-white relative min-h-[220px]"
            style={{
              background: `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
            }}
          >
            <div>
              <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-pink-200/80 bg-white/10 rounded-md backdrop-blur-xs">
                {product.category}
              </span>
              <h3 className="text-xl font-extrabold text-white mt-3 leading-tight">
                {product.name}
              </h3>
            </div>

            <div className="pt-4 border-t border-white/15 text-xs text-white/80 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>CircuitCart Buyer Protection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="size-4 text-pink-300" />
                <span>Meetup or Express Shipping</span>
              </div>
            </div>
          </div>

          {/* Right Product Details */}
          <div className="md:col-span-7 p-6 space-y-4">
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-md ${
                    product.condition === "New"
                      ? "bg-emerald-100 text-emerald-900"
                      : product.condition === "Like New"
                      ? "bg-[#eadcde] text-[#65486f]"
                      : product.condition === "Good"
                      ? "bg-[#e2e8f0] text-[#334155]"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {product.condition}
                </span>

                <div className="flex items-center gap-1 text-xs text-[#716872]">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-[#1d1720]">
                    {product.rating}
                  </span>
                  <span className="text-[#716872]">({product.reviewCount} reviews)</span>
                </div>
              </div>

              <h2 id="dialog-title" className="text-xl font-bold text-[#1d1720] leading-snug">
                {product.name}
              </h2>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2 pt-1 border-t border-[#eadcde]">
              <span className="text-3xl font-extrabold text-[#1d1720]">
                ₱{product.price.toLocaleString()}
              </span>
              {product.originalPrice && (
                <span className="text-sm text-[#716872] line-through">
                  ₱{product.originalPrice.toLocaleString()}
                </span>
              )}
            </div>

            {/* Specifications */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-[#1d1720] uppercase tracking-wider">
                Specifications
              </h4>
              <p className="text-xs text-[#716872] bg-[#eadcde]/50 p-3 rounded-xl border border-[#eadcde] leading-relaxed">
                {product.specs}
              </p>
            </div>

            {/* Seller & Location Info */}
            <div className="space-y-1 pt-1">
              <h4 className="text-xs font-semibold text-[#1d1720] uppercase tracking-wider">
                Seller Information
              </h4>
              <div className="flex items-center justify-between text-xs text-[#1d1720] bg-[#eadcde]/50 p-3 rounded-xl border border-[#eadcde]">
                <div className="flex items-center gap-1.5 font-semibold text-[#65486f]">
                  <span>{product.sellerName}</span>
                  {product.isVerifiedSeller && (
                    <CheckCircle2 className="size-4 text-emerald-600 fill-emerald-100" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-[#716872]">
                  <MapPin className="size-3.5" />
                  <span>{product.location}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => {
                  onAddToCart(product);
                  onClose();
                }}
                className="flex-1 h-11 text-xs font-semibold bg-[#65486f] text-white hover:bg-[#7a5985] rounded-xl shadow-xs transition-all"
              >
                <ShoppingCart className="size-4" />
                Add to cart
              </Button>

              <button
                type="button"
                onClick={() => onToggleWishlist(product.id)}
                className={`p-3 rounded-xl border transition-all ${
                  isWishlisted
                    ? "border-rose-200 bg-rose-50 text-rose-600"
                    : "border-[#eadcde] bg-white text-[#716872] hover:bg-[#eadcde]"
                }`}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart className={`size-5 ${isWishlisted ? "fill-rose-600" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
