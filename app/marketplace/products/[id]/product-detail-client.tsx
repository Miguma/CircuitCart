"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  ShoppingCart,
  CheckCircle2,
  MapPin,
  Star,
  ShieldCheck,
  Truck,
  Plus,
  Minus,
  Laptop,
  Smartphone,
  Headphones,
  Gamepad2,
  Cpu,
  Layers,
  Sparkles,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Product } from "@/components/marketplace/marketplace-data";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { ProductCard } from "@/components/marketplace/product-card";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";
import { ListingOwnerActions } from "@/components/marketplace/listing-owner-actions";
import { getOrCreateProductConversation } from "@/lib/supabase/messages";
import { toast } from "sonner";

interface ProductDetailClientProps {
  product: Product;
  images: string[];
  relatedProducts: Product[];
}

export default function ProductDetailClient({
  product,
  images,
  relatedProducts,
}: ProductDetailClientProps) {
  const router = useRouter();
  const { isFavorite, toggleFavorite, addToCart, setQuickViewProduct } =
    useMarketplace();
  const { userId, isLoading } = useMarketplaceAccount();
  const isOwner = Boolean(userId && product.sellerId === userId);

  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const wishlisted = isFavorite(product.id);
  const productImages = images.length > 0
    ? images
    : product.images && product.images.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];
  const selectedImage = productImages[selectedImageIndex] || product.image;

  const showPreviousImage = React.useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (productImages.length <= 1) return;
    setSelectedImageIndex((current) =>
      (current - 1 + productImages.length) % productImages.length
    );
  }, [productImages.length]);

  const showNextImage = React.useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (productImages.length <= 1) return;
    setSelectedImageIndex((current) =>
      (current + 1) % productImages.length
    );
  }, [productImages.length]);

  // Keyboard navigation for lightbox & gallery
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLightboxOpen) {
        if (e.key === "Escape") {
          setIsLightboxOpen(false);
        } else if (e.key === "ArrowLeft") {
          showPreviousImage();
        } else if (e.key === "ArrowRight") {
          showNextImage();
        }
      }
    };

    if (isLightboxOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLightboxOpen, showNextImage, showPreviousImage]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(price);

  const handleAddToCart = () => {
    if (isOwner || isLoading) return;
    addToCart(product, quantity);
    toast.success(`Added ${quantity} × "${product.name}" to cart!`);
  };

  const handleToggleFavorite = () => {
    if (isOwner || isLoading) return;
    toggleFavorite(product.id);
    if (!wishlisted) {
      toast.success(`Saved "${product.name}" to favorites.`);
    } else {
      toast.info(`Removed "${product.name}" from favorites.`);
    }
  };

  const handleMessageSeller = async () => {
    if (isStartingChat || isOwner || isLoading) return;
    setIsStartingChat(true);

    try {
      const convId = await getOrCreateProductConversation(product.id);
      router.push(`/marketplace/messages?conversationId=${convId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open conversation with seller.";
      toast.error(msg);
      setIsStartingChat(false);
    }
  };

  const getFallbackIcon = (category: string) => {
    switch (category) {
      case "Laptops":
        return <Laptop className="size-24 text-[#65486f]" />;
      case "Mobile":
        return <Smartphone className="size-24 text-[#65486f]" />;
      case "Audio":
        return <Headphones className="size-24 text-[#65486f]" />;
      case "Gaming":
        return <Gamepad2 className="size-24 text-[#65486f]" />;
      case "Components":
        return <Cpu className="size-24 text-[#65486f]" />;
      default:
        return <Layers className="size-24 text-[#65486f]" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#d6cbd5]">
        <Link
          href="/marketplace"
          className="hover:text-white transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          <span>Marketplace</span>
        </Link>
        <span>/</span>
        <span className="text-[#d6cbd5]">{product.category}</span>
        <span>/</span>
        <span className="text-white font-medium truncate max-w-[200px] sm:max-w-md">
          {product.name}
        </span>
      </nav>

      {/* Main Product Presentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Product Artwork Container (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <div
            onClick={() => selectedImage && setIsLightboxOpen(true)}
            className={`group/gallery relative flex aspect-[4/3] sm:aspect-square items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#171219] shadow-xl ${
              selectedImage ? "cursor-zoom-in" : ""
            }`}
          >
            {/* Condition Badge in Image Box */}
            <div className="absolute left-4 top-4 z-30">
              <span
                className={`rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-lg backdrop-blur-md ${
                  product.condition === "New"
                    ? "border-emerald-400/25 bg-emerald-950/75 text-emerald-300"
                    : product.condition === "Like New"
                    ? "border-white/10 bg-[#342339]/90 text-[#f2acd8]"
                    : product.condition === "Good"
                    ? "border-sky-300/20 bg-sky-950/75 text-sky-200"
                    : "border-amber-300/20 bg-amber-950/75 text-amber-200"
                }`}
              >
                {product.condition}
              </span>
            </div>

            {/* Favorite Button on Image */}
            {!isOwner && (
              <button
                type="button"
                disabled={isLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite();
                }}
                className={`absolute right-4 top-4 z-30 rounded-full border p-2.5 shadow-lg backdrop-blur-md transition-all cursor-pointer ${
                  wishlisted
                    ? "border-rose-400/30 bg-rose-950/80 text-rose-300"
                    : "border-white/15 bg-[#211a24]/85 text-white/75 hover:bg-[#342339] hover:text-white"
                }`}
                aria-label={wishlisted ? "Remove from saved items" : "Save product"}
              >
                <Heart className={`size-5 ${wishlisted ? "fill-rose-600" : ""}`} />
              </button>
            )}

            {/* Main Product Image */}
            {selectedImage ? (
              <>
                <Image
                  src={selectedImage}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 1024px) 100vw, 480px"
                  className="pointer-events-none scale-110 select-none object-cover opacity-20 blur-2xl"
                />
                <div
                  key={selectedImage}
                  className="absolute inset-3 animate-in overflow-hidden rounded-2xl bg-black/15 shadow-inner fade-in duration-200 motion-reduce:animate-none sm:inset-4"
                >
                  <Image
                    src={selectedImage}
                    alt={`${product.name} — image ${selectedImageIndex + 1} of ${productImages.length}`}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 480px"
                    className="pointer-events-none select-none object-contain object-center drop-shadow-xl"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                {getFallbackIcon(product.category)}
                <span className="text-xs font-bold uppercase tracking-wider text-[#d6cbd5]">
                  {product.category}
                </span>
              </div>
            )}

            {/* Navigation Arrows & Counter (Multiple Images Only) */}
            {productImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  aria-label="Show previous product image"
                  className="absolute left-3 top-1/2 z-30 flex size-9 sm:size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#211a24]/85 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-[#65486f] hover:scale-105 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="Show next product image"
                  className="absolute right-3 top-1/2 z-30 flex size-9 sm:size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#211a24]/85 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-[#65486f] hover:scale-105 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="absolute bottom-4 right-4 z-30 rounded-full border border-white/10 bg-[#211a24]/85 px-2.5 py-1 text-[11px] font-bold text-white/90 shadow-lg backdrop-blur-md">
                  {selectedImageIndex + 1} / {productImages.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnails Row (Multiple Images Only) */}
          {productImages.length > 1 && (
            <div
              className="flex gap-2.5 overflow-x-auto rounded-2xl border border-white/10 bg-[#211a24]/80 p-2.5 shadow-lg scrollbar-thin"
              aria-label="Product image gallery thumbnails"
            >
              {productImages.map((image, index) => {
                const isSelected = index === selectedImageIndex;

                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    aria-label={`Show product image ${index + 1}`}
                    aria-current={isSelected ? "true" : undefined}
                    className={`relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border-2 bg-[#171219] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9] ${
                      isSelected
                        ? "border-[#e59bc9] ring-2 ring-[#e59bc9]/30 opacity-100 scale-100 shadow-sm"
                        : "border-white/10 opacity-60 hover:border-white/40 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} thumbnail ${index + 1}`}
                      fill
                      sizes="80px"
                      className="object-contain p-1"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Fullscreen Lightbox Modal */}
          {isLightboxOpen && selectedImage && (
            <div
              className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-150"
              role="dialog"
              aria-modal="true"
              aria-label="Full screen image inspection"
              onClick={() => setIsLightboxOpen(false)}
            >
              {/* Top Bar */}
              <div
                className="w-full flex items-center justify-between z-10 max-w-5xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 text-white">
                  <span className="text-sm sm:text-base font-bold truncate max-w-[220px] sm:max-w-md">
                    {product.name}
                  </span>
                  {productImages.length > 1 && (
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white/90">
                      {selectedImageIndex + 1} / {productImages.length}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors cursor-pointer"
                  aria-label="Close full screen inspection"
                >
                  <ArrowLeft className="size-5 sm:hidden" />
                  <span className="hidden sm:inline text-xs font-semibold px-2 py-1 bg-white/10 rounded-lg">
                    Press ESC or Click to Close
                  </span>
                </button>
              </div>

              {/* Main Lightbox Inspection Image */}
              <div
                className="relative flex-1 w-full max-w-5xl my-4 flex items-center justify-center overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src={selectedImage}
                  alt={`${product.name} full view`}
                  fill
                  sizes="100vw"
                  className="object-contain select-none pointer-events-none drop-shadow-2xl"
                  priority
                />

                {/* Lightbox Prev / Next Controls */}
                {productImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      aria-label="Previous image"
                      className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 size-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xl"
                    >
                      <ChevronLeft className="size-6" />
                    </button>

                    <button
                      type="button"
                      onClick={showNextImage}
                      aria-label="Next image"
                      className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 size-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xl"
                    >
                      <ChevronRight className="size-6" />
                    </button>
                  </>
                )}
              </div>

              {/* Lightbox Thumbnails Strip */}
              {productImages.length > 1 && (
                <div
                  className="flex gap-2 overflow-x-auto max-w-2xl p-2 bg-black/40 rounded-2xl border border-white/10 scrollbar-thin z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {productImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative size-14 sm:size-16 rounded-xl overflow-hidden shrink-0 border-2 bg-black/50 transition-all cursor-pointer ${
                        idx === selectedImageIndex
                          ? "border-[#e59bc9] ring-2 ring-[#e59bc9]/40 scale-105"
                          : "border-white/15 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={img}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-contain p-1"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trust Highlights */}
          <div className="bg-[#241c27] border border-white/10 rounded-2xl p-4 space-y-2.5 text-xs text-[#d6cbd5]">
            <div className="flex items-center gap-2.5 text-white font-semibold">
              <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
              <span>Buyer protection will be enabled with the secure transaction system.</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#d6cbd5]">
              <Truck className="size-4 text-[#e59bc9] shrink-0" />
              <span>Delivery and meetup options will be configured during checkout development.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Product Details & Purchase Form (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header & Title */}
          <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#342339] text-[#e59bc9] rounded-md">
                  {product.category}
                </span>
                {product.badge && (
                  <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#65486f] text-white rounded-md flex items-center gap-1">
                    <Sparkles className="size-3" />
                    <span>{product.badge}</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {product.name}
              </h1>

              {/* Rating & Seller Location */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#d6cbd5] pt-1">
                {product.reviewCount > 0 ? (
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star className="size-4 fill-amber-400" />
                    <span className="font-bold text-white text-sm">{product.rating}</span>
                    <span>({product.reviewCount} customer reviews)</span>
                  </div>
                ) : (
                  <span className="text-xs text-[#b9adb6]">No reviews yet</span>
                )}
                <span>•</span>
                <div className="flex items-center gap-1 text-[#d6cbd5]">
                  <MapPin className="size-3.5 text-[#e59bc9]" />
                  <span>{product.location || "Location not provided"}</span>
                </div>
              </div>
            </div>


            {/* Price Box */}
            <div className="p-4 bg-[#342339]/50 border border-white/10 rounded-2xl flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {formatPrice(product.price)}
                </div>
                {product.originalPrice && (
                  <div className="text-xs text-[#d6cbd5] line-through mt-0.5">
                    Original Price: {formatPrice(product.originalPrice)}
                  </div>
                )}
              </div>

              {product.originalPrice && (
                <div className="px-3 py-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-bold">
                  Save {formatPrice(product.originalPrice - product.price)}
                </div>
              )}
            </div>

            {/* Seller Info Panel */}
            <div className="p-4 bg-[#342339]/30 border border-white/5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#d6cbd5] block mb-0.5">
                  {isOwner ? "Your listing" : "Sold by"}
                </span>
                <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                  <span>{product.sellerName}</span>
                  {product.isVerifiedSeller && (
                    <CheckCircle2 className="size-4 text-emerald-400 fill-emerald-400/20 shrink-0" />
                  )}
                </div>
              </div>

              {product.isVerifiedSeller && (
                <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-800/50 rounded-lg">
                  Verified Seller
                </span>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                About this item
              </h2>
              <p className="text-xs sm:text-sm text-[#d6cbd5] leading-relaxed">
                {product.description || product.specs}
              </p>
            </div>

            {/* Specifications List */}
            {product.specifications && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Technical Specifications
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {Object.entries(product.specifications).map(([key, val]) => (
                    <div
                      key={key}
                      className="p-2.5 bg-[#342339]/40 border border-white/5 rounded-xl"
                    >
                      <span className="text-[#b9adb6] block mb-0.5 font-medium">
                        {key}
                      </span>
                      <span className="text-white font-semibold">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Purchase / Action Row */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              {isOwner ? (
                <ListingOwnerActions productId={product.id} />
              ) : isLoading ? (
                <div role="status" className="flex h-12 items-center gap-2 text-xs text-[#d6cbd5]">
                  <Loader2 className="size-4 animate-spin text-[#e59bc9]" />
                  Loading listing actions…
                </div>
              ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                {/* Quantity Controls */}
                <div className="flex items-center justify-between sm:justify-start gap-3 bg-[#342339] border border-white/10 rounded-2xl p-1.5 shrink-0">
                  <span className="text-xs font-semibold text-[#d6cbd5] pl-2 sm:hidden">
                    Quantity:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      disabled={quantity <= 1}
                      className="size-8 rounded-xl bg-[#241c27] hover:bg-[#45304b] text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Minus className="size-4" />
                    </button>

                    <span className="w-8 text-center text-sm font-bold text-white">
                      {quantity}
                    </span>

                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((prev) => prev + 1)}
                      className="size-8 rounded-xl bg-[#241c27] hover:bg-[#45304b] text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 h-12 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs sm:text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  <ShoppingCart className="size-4.5" />
                  <span>Add {quantity > 1 ? `(${quantity}) ` : ""}to Cart</span>
                </button>

                {/* Message Seller Button */}
                <button
                  type="button"
                  onClick={handleMessageSeller}
                  disabled={isStartingChat}
                  className="h-12 px-5 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 text-xs sm:text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Message Seller"
                >
                  {isStartingChat ? (
                    <Loader2 className="size-4 animate-spin text-[#e59bc9]" />
                  ) : (
                    <MessageSquare className="size-4 text-[#e59bc9]" />
                  )}
                  <span>Message Seller</span>
                </button>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <section aria-labelledby="related-heading" className="space-y-4 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h2 id="related-heading" className="text-xl font-bold text-white">
              Related in {product.category}
            </h2>
            <Link
              href="/marketplace"
              className="text-xs font-semibold text-[#e59bc9] hover:text-white transition-colors"
            >
              Browse all items
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {relatedProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                isWishlisted={isFavorite(prod.id)}
                onToggleWishlist={toggleFavorite}
                onQuickView={setQuickViewProduct}
                onAddToCart={(p) => {
                  addToCart(p);
                  toast.success(`Added "${p.name}" to cart!`);
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
