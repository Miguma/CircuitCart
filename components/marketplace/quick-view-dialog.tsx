"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  X,
  Star,
  CheckCircle2,
  MapPin,
  Heart,
  ShoppingCart,
  ShieldCheck,
  Truck,
  ArrowRight,
  Laptop,
  Smartphone,
  Headphones,
  Gamepad2,
  Cpu,
  Layers,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "./marketplace-data";
import { useMarketplaceAccount } from "./marketplace-account";
import { ListingOwnerActions } from "./listing-owner-actions";

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
  const { userId, isLoading } = useMarketplaceAccount();
  const isOwner = Boolean(userId && product?.sellerId === userId);

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

  const getFallbackIcon = (category: string) => {
    switch (category) {
      case "Laptops":
        return <Laptop className="size-16 text-[#65486f]" />;
      case "Mobile":
        return <Smartphone className="size-16 text-[#65486f]" />;
      case "Audio":
        return <Headphones className="size-16 text-[#65486f]" />;
      case "Gaming":
        return <Gamepad2 className="size-16 text-[#65486f]" />;
      case "Components":
        return <Cpu className="size-16 text-[#65486f]" />;
      default:
        return <Layers className="size-16 text-[#65486f]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 glass-dialog-overlay animate-in fade-in duration-150">
      {/* Modal Container */}
      <div
        className="bg-[#f8f3f3] text-[#1d1720] border border-[#eadcde] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#716872] hover:text-[#1d1720] bg-[#eadcde] hover:bg-[#d8c2c8] rounded-full transition-colors z-10 cursor-pointer"
          aria-label="Close details"
        >
          <X className="size-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 max-h-[85vh] overflow-y-auto">
          {/* Left Visual Area with Real Product Image */}
          <div className="md:col-span-5 p-6 flex flex-col justify-between bg-[#efe7ea] border-r border-[#eadcde] relative min-h-[240px]">
            <div>
              <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#65486f] bg-[#eadcde] rounded-md">
                {product.category}
              </span>
            </div>

            {/* Main Product Image Container */}
            <div className="relative w-full h-44 my-4 flex items-center justify-center">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 240px"
                  className="object-contain p-2"
                />
              ) : (
                getFallbackIcon(product.category)
              )}
            </div>

            <div className="pt-3 border-t border-[#ded0d5] text-[12px] text-[#716872] space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>Buyer protection with backend integration</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="size-3.5 text-[#65486f]" />
                <span>Local meetup and shipping options</span>
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

                {product.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#65486f] text-white rounded-md">
                    {product.badge}
                  </span>
                )}
              </div>

              <h3 id="dialog-title" className="text-lg font-extrabold text-[#1d1720] leading-snug">
                {product.name}
              </h3>

              {/* Rating */}
              <div className="flex items-center gap-1.5 text-xs text-[#716872] mt-1.5">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-[#1d1720]">{product.rating}</span>
                </div>
                <span>•</span>
                <span>{product.reviewCount} customer reviews</span>
              </div>
            </div>

            {/* Seller Card */}
            <div className="bg-[#f0e6e9] border border-[#eadcde] rounded-xl p-3 flex items-center justify-between text-xs">
              <div>
                <div className="flex items-center gap-1 font-bold text-[#65486f]">
                  <span>{product.sellerName}</span>
                  {product.isVerifiedSeller && (
                    <CheckCircle2 className="size-3.5 text-emerald-600 fill-emerald-100 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-[#716872] mt-0.5">
                  <MapPin className="size-3" />
                  <span>{product.location}</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-white text-[#65486f] rounded-md border border-[#ded0d5]">
                Verified Seller
              </span>
            </div>

            {/* Key Specs */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#1d1720] uppercase tracking-wider">
                Highlights & Specs
              </span>
              <p className="text-xs text-[#716872] leading-relaxed bg-white p-3 rounded-xl border border-[#eadcde]">
                {product.specs}
              </p>
            </div>

            {/* Price & Action Row */}
            <div className="pt-2 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-black text-[#1d1720]">
                    ₱{product.price.toLocaleString()}
                  </div>
                  {product.originalPrice && (
                    <div className="text-xs text-[#716872] line-through">
                      Original: ₱{product.originalPrice.toLocaleString()} (Save ₱{(product.originalPrice - product.price).toLocaleString()})
                    </div>
                  )}
                </div>

                {!isOwner && <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onToggleWishlist(product.id)}
                  className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                    isWishlisted
                      ? "bg-rose-50 border-rose-200 text-rose-600"
                      : "bg-white border-[#eadcde] text-[#716872] hover:text-[#1d1720]"
                  }`}
                  aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart className={`size-4 ${isWishlisted ? "fill-rose-600" : ""}`} />
                </button>}
              </div>

              {isOwner ? (
                <ListingOwnerActions productId={product.id} appearance="light" onNavigate={onClose} />
              ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    onAddToCart(product);
                  }}
                  className="w-full h-11 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                  <span>Add to cart</span>
                </Button>

                <Link
                  href={`/marketplace/products/${product.id}`}
                  onClick={onClose}
                  className="w-full h-11 bg-white hover:bg-[#f0e6e9] text-[#1d1720] border border-[#eadcde] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Full details</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              )}
              {isOwner && (
                <Link
                  href={`/marketplace/products/${product.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#65486f] hover:underline"
                >
                  View public listing
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
