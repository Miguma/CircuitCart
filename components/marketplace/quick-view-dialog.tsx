"use client";

import React, { useEffect, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Laptop,
  Smartphone,
  Headphones,
  Gamepad2,
  Cpu,
  Layers,
  Loader2,
  Package,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "./marketplace-data";
import { useMarketplaceAccount } from "./marketplace-account";
import { getProductById } from "@/lib/supabase/products";

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
  const [prevProductId, setPrevProductId] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);

  const productId = product?.id ?? null;

  // Adjust state during render when product changes
  if (productId !== prevProductId) {
    setPrevProductId(productId);
    setSelectedImageIndex(0);
    setFetchedImages([]);
  }

  // Fetch freshest images from Supabase asynchronously if listing was updated
  useEffect(() => {
    if (!product?.id) return;

    let isMounted = true;
    getProductById(product.id)
      .then((res) => {
        if (isMounted && res?.images && res.images.length > 0) {
          setFetchedImages(res.images);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [product?.id]);

  const images = fetchedImages.length > 0
    ? fetchedImages
    : (product?.images && product.images.length > 0)
      ? product.images
      : (product?.image ? [product.image] : []);

  useEffect(() => {
    if (!isOpen || images.length <= 1) return;

    const interval = setInterval(() => {
      setSelectedImageIndex((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, images.length, selectedImageIndex]);

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

  const currentImage = images[selectedImageIndex] || product.image;

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

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
          className="absolute top-4 right-4 p-2 text-[#716872] hover:text-[#1d1720] bg-[#eadcde] hover:bg-[#d8c2c8] rounded-full transition-colors z-20 cursor-pointer"
          aria-label="Close details"
        >
          <X className="size-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 max-h-[85vh] overflow-y-auto">
          {/* Left Visual Area with Real Product Images Slideshow */}
          <div className="md:col-span-5 p-4 sm:p-5 flex flex-col justify-between bg-[#efe7ea] border-b md:border-b-0 md:border-r border-[#eadcde] relative">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#65486f] bg-[#eadcde] rounded-md">
                  {product.category}
                </span>

                {images.length > 1 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold text-[#65486f] bg-[#eadcde] rounded-md">
                    {selectedImageIndex + 1} / {images.length}
                  </span>
                )}
              </div>

              {/* Main Product Media Container */}
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-[#ded0d5] bg-[#ebe2e5] shadow-xs flex items-center justify-center group">
                {currentImage ? (
                  <>
                    <Image
                      key={currentImage}
                      src={currentImage}
                      alt={`${product.name} image ${selectedImageIndex + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 360px"
                      className="pointer-events-none select-none object-cover object-center transition-opacity duration-300"
                    />

                    {/* Left and Right Manual Navigation Chevrons */}
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrevImage}
                          aria-label="Previous image"
                          className="absolute left-2 top-1/2 -translate-y-1/2 size-7 sm:size-8 rounded-full bg-white/80 hover:bg-white text-[#1d1720] shadow-sm backdrop-blur-xs flex items-center justify-center transition-all cursor-pointer z-10 hover:scale-105 active:scale-95"
                        >
                          <ChevronLeft className="size-4" />
                        </button>

                        <button
                          type="button"
                          onClick={handleNextImage}
                          aria-label="Next image"
                          className="absolute right-2 top-1/2 -translate-y-1/2 size-7 sm:size-8 rounded-full bg-white/80 hover:bg-white text-[#1d1720] shadow-sm backdrop-blur-xs flex items-center justify-center transition-all cursor-pointer z-10 hover:scale-105 active:scale-95"
                        >
                          <ChevronRight className="size-4" />
                        </button>

                        {/* Dot Indicators */}
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 px-2 py-1 bg-black/30 backdrop-blur-xs rounded-full">
                          {images.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageIndex(idx);
                              }}
                              aria-label={`View image ${idx + 1}`}
                              className={`size-1.5 sm:size-2 rounded-full transition-all cursor-pointer ${
                                idx === selectedImageIndex
                                  ? "bg-white scale-125"
                                  : "bg-white/50 hover:bg-white/80"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1.5 p-4 text-center">
                    {getFallbackIcon(product.category)}
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#65486f]/80">
                      {product.category}
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnails Row */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                  {images.map((img, idx) => {
                    const isActive = idx === selectedImageIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        aria-label={`Select product image ${idx + 1}`}
                        className={`relative size-12 rounded-xl overflow-hidden shrink-0 border bg-[#ebe2e5] transition-all cursor-pointer ${
                          isActive
                            ? "ring-2 ring-[#65486f] border-transparent shadow-xs scale-100"
                            : "border-[#ded0d5] opacity-65 hover:opacity-100 hover:border-[#65486f]/50"
                        }`}
                      >
                        <Image
                          src={img}
                          alt={`${product.name} thumbnail ${idx + 1}`}
                          fill
                          sizes="48px"
                          className="object-cover object-center pointer-events-none"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2.5 mt-2.5 border-t border-[#ded0d5] text-[11px] text-[#716872] space-y-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                <span>Buyer protection verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="size-3.5 text-[#65486f] shrink-0" />
                <span>Local meetup & shipping options</span>
              </div>
            </div>
          </div>

          {/* Right Product Details */}
          <div className="md:col-span-7 p-4 sm:p-5 space-y-3">
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
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

              <h3 id="dialog-title" className="text-base sm:text-lg font-extrabold text-[#1d1720] leading-snug">
                {product.name}
              </h3>

              {/* Rating */}
              <div className="flex items-center gap-1.5 text-xs text-[#716872] mt-1">
                {product.reviewCount > 0 ? (
                  <>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-[#1d1720]">{product.rating}</span>
                    </div>
                    <span>•</span>
                    <span>{product.reviewCount} reviews</span>
                  </>
                ) : (
                  <span>No reviews yet</span>
                )}
              </div>
            </div>

            {/* Seller Card */}
            <div className="bg-[#f0e6e9] border border-[#eadcde] rounded-xl p-2.5 flex items-center justify-between text-xs">
              <div>
                <div className="flex items-center gap-1 font-bold text-[#65486f]">
                  <span>{product.sellerName}</span>
                  {product.isVerifiedSeller && (
                    <CheckCircle2 className="size-3.5 text-emerald-600 fill-emerald-100 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-[#716872] mt-0.5 text-[11px]">
                  <MapPin className="size-3 shrink-0" />
                  <span>{product.location}</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-white text-[#65486f] rounded-md border border-[#ded0d5]">
                Verified Seller
              </span>
            </div>

            {/* Key Specs */}
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-[#1d1720] uppercase tracking-wider">
                Highlights & Specs
              </span>
              <p className="text-xs text-[#716872] leading-relaxed bg-white p-2.5 rounded-xl border border-[#eadcde]">
                {product.specs}
              </p>
            </div>

            {/* Price & Action Row */}
            <div className="pt-1 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-[#1d1720]">
                    ₱{product.price.toLocaleString()}
                  </div>
                  {product.originalPrice && (
                    <div className="text-[11px] text-[#716872] line-through">
                      Original: ₱{product.originalPrice.toLocaleString()} (Save ₱{(product.originalPrice - product.price).toLocaleString()})
                    </div>
                  )}
                </div>

                {isOwner ? (
                  <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#65486f] bg-[#efe7ea] border border-[#ded0d5] rounded-xl flex items-center gap-1 shadow-2xs">
                    <Package className="size-3 text-[#65486f]" />
                    <span>Your listing</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => onToggleWishlist(product.id)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isWishlisted
                        ? "bg-rose-50 border-rose-200 text-rose-600"
                        : "bg-white border-[#eadcde] text-[#716872] hover:text-[#1d1720]"
                    }`}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <Heart className={`size-4 ${isWishlisted ? "fill-rose-600" : ""}`} />
                  </button>
                )}
              </div>

              {isOwner ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/seller/products?listing=${encodeURIComponent(product.id)}`}
                      onClick={onClose}
                      className="w-full h-10 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <Package className="size-4" />
                      <span>Manage Listing</span>
                    </Link>

                    <Link
                      href="/seller/orders"
                      onClick={onClose}
                      className="w-full h-10 bg-white hover:bg-[#f0e6e9] text-[#1d1720] border border-[#eadcde] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ClipboardList className="size-4 text-[#65486f]" />
                      <span>View Orders</span>
                    </Link>
                  </div>

                  <div className="text-center pt-0.5">
                    <Link
                      href={`/marketplace/products/${product.id}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#65486f] hover:underline"
                    >
                      <span>View public listing</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      onAddToCart(product);
                    }}
                    className="w-full h-10 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                    <span>Add to cart</span>
                  </Button>

                  <Link
                    href={`/marketplace/products/${product.id}`}
                    onClick={onClose}
                    className="w-full h-10 bg-white hover:bg-[#f0e6e9] text-[#1d1720] border border-[#eadcde] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Full details</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
