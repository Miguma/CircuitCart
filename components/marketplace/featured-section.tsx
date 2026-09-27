"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Eye,
  Gamepad2,
  Headphones,
  Laptop,
  Loader2,
  MapPin,
  Mouse,
  Package,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tablet,
  Watch,
} from "lucide-react";
import { Product } from "./marketplace-data";
import { useMarketplaceAccount } from "./marketplace-account";

interface FeaturedSectionProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

function AuroraSparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="featured-aurora" x1="4" y1="3" x2="28" y2="29">
          <stop stopColor="#4285F4" />
          <stop offset="0.38" stopColor="#9B72CB" />
          <stop offset="0.7" stopColor="#D96570" />
          <stop offset="1" stopColor="#F9AB00" />
        </linearGradient>
      </defs>
      <path
        d="M16 1.5c1.15 7.84 6.66 13.35 14.5 14.5-7.84 1.15-13.35 6.66-14.5 14.5C14.85 22.66 9.34 17.15 1.5 16 9.34 14.85 14.85 9.34 16 1.5Z"
        fill="url(#featured-aurora)"
      />
    </svg>
  );
}

export function FeaturedSection({
  products,
  onAddToCart,
}: FeaturedSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const { userId, isLoading } = useMarketplaceAccount();
  const itemCount = products.length;
  const safeIndex = activeIndex % Math.max(itemCount, 1);
  const product = products[safeIndex];
  const isOwner = Boolean(userId && product?.sellerId === userId);

  useEffect(() => {
    if (itemCount <= 1 || isHovered || hasFocus) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % itemCount);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [hasFocus, isHovered, itemCount]);

  if (!product) return null;

  return (
    <section
      aria-label="Newest marketplace listings"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHasFocus(false);
        }
      }}
      className="group/banner cc-featured-banner relative isolate flex w-full items-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-r from-[#18131d] via-[#211928] to-[#241a26] p-3 shadow-xl sm:rounded-[1.75rem] sm:p-6 sm:pb-8 lg:p-7"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -left-16 top-1/4 size-48 rounded-full bg-[#4285f4]/10 blur-3xl" />
        <div className="absolute left-[42%] top-[-7rem] size-56 rounded-full bg-[#a855f7]/10 blur-3xl" />
        <div className="absolute -right-12 bottom-[-5rem] size-56 rounded-full bg-[#ec4899]/10 blur-3xl" />

        <div className="hidden xl:block">
          <div className="absolute left-10 top-9 grid size-9 place-items-center rounded-xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 text-[#b69cff] shadow-[0_0_24px_rgba(139,92,246,0.12)]">
            <Tablet className="size-4.5" strokeWidth={1.6} />
          </div>
          <div className="absolute left-8 top-[43%] grid size-10 place-items-center rounded-xl border border-[#4285f4]/20 bg-[#4285f4]/5 text-[#7db3ff] shadow-[0_0_24px_rgba(66,133,244,0.14)]">
            <Smartphone className="size-5" strokeWidth={1.6} />
          </div>
          <div className="absolute bottom-9 left-12 grid size-9 place-items-center rounded-xl border border-[#ec4899]/20 bg-[#ec4899]/5 text-[#f28bc0] shadow-[0_0_24px_rgba(236,72,153,0.12)]">
            <Camera className="size-4.5" strokeWidth={1.6} />
          </div>
          <div className="absolute left-[47%] top-7 grid size-10 place-items-center rounded-xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 text-[#b69cff] shadow-[0_0_24px_rgba(139,92,246,0.14)]">
            <Laptop className="size-5" strokeWidth={1.6} />
          </div>
          <div className="absolute bottom-8 left-[43%] grid size-9 place-items-center rounded-xl border border-[#4285f4]/20 bg-[#4285f4]/5 text-[#7db3ff] shadow-[0_0_24px_rgba(66,133,244,0.12)]">
            <Gamepad2 className="size-4.5" strokeWidth={1.6} />
          </div>
          <div className="absolute right-8 top-12 grid size-10 place-items-center rounded-xl border border-[#ec4899]/20 bg-[#ec4899]/5 text-[#f28bc0] shadow-[0_0_24px_rgba(236,72,153,0.14)]">
            <Headphones className="size-5" strokeWidth={1.6} />
          </div>
          <div className="absolute right-7 top-[48%] grid size-9 place-items-center rounded-xl border border-[#4285f4]/20 bg-[#4285f4]/5 text-[#7db3ff] shadow-[0_0_24px_rgba(66,133,244,0.12)]">
            <Mouse className="size-4.5" strokeWidth={1.6} />
          </div>
          <div className="absolute bottom-10 right-9 grid size-9 place-items-center rounded-xl border border-[#f9ab00]/20 bg-[#f9ab00]/5 text-[#f6c453] shadow-[0_0_24px_rgba(249,171,0,0.12)]">
            <Watch className="size-4.5" strokeWidth={1.6} />
          </div>
          <AuroraSparkle className="absolute bottom-14 left-[49%] size-6 opacity-75 drop-shadow-[0_0_12px_rgba(155,114,203,0.45)]" />
        </div>
      </div>

      <div
        key={product.id}
        role="group"
        aria-roledescription="slide"
        aria-label={`${safeIndex + 1} of ${itemCount}`}
        className="relative z-10 mx-auto grid w-full max-w-[60rem] grid-cols-1 items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-500 motion-reduce:animate-none sm:gap-6 md:grid-cols-12 md:gap-8 lg:gap-10"
      >
        {/* Product information shares the banner with a compact media column. */}
        <div className="min-w-0 space-y-1.5 sm:space-y-3 md:col-span-7">
          <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/40 bg-white px-2.5 py-0.5 text-[10px] font-semibold shadow-sm sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-sm">
            <Sparkles className="size-3 text-[#9c2c6e] sm:size-3.5" />
            <span className="text-[#9c2c6e]">{isOwner ? "Your new listing" : "New listing"}</span>
            {product.condition && (
              <>
                <span className="text-slate-400">•</span>
                <span className="font-medium text-slate-800">{product.condition}</span>
              </>
            )}
          </div>

          <h2
            className="text-white-forced line-clamp-2 text-xl font-bold leading-tight tracking-tight text-[#fffafa] sm:text-2xl md:text-3xl lg:text-4xl"
            title={product.name}
          >
            {product.name}
          </h2>

          <p className="cc-featured-desc hidden max-w-xl leading-relaxed text-white/60 md:line-clamp-2 md:text-base lg:text-lg">
            {product.specs}
          </p>

          {/* Seller & Location Info */}
          <div className="flex min-w-0 items-center gap-1.5 pt-0.5 text-[11px] text-white/50 sm:text-xs md:flex-wrap md:gap-3 md:pt-1 md:text-sm">
            <div className="cc-featured-seller flex min-w-0 items-center gap-1 font-semibold text-[#e59bc9]">
              <span className="truncate">{product.sellerName}</span>
              {product.isVerifiedSeller && (
                <CheckCircle2 className="size-3.5 text-emerald-400 fill-emerald-400/20" />
              )}
            </div>
            <span className="shrink-0 text-white/30">•</span>
            <div className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0 text-white/40" />
              <span className="truncate">{product.location}</span>
            </div>
          </div>

          {/* Price & Action Row */}
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 pt-0.5 md:gap-3 md:pt-1">
            <div className="text-xl font-extrabold text-[#fffafa] sm:text-2xl md:text-3xl lg:text-4xl">
              ₱{product.price.toLocaleString()}
            </div>
            {product.originalPrice && (
              <div className="text-[10px] text-white/40 line-through sm:text-xs md:text-sm">
                ₱{product.originalPrice.toLocaleString()}
              </div>
            )}
            {product.originalPrice && (
              <span className="rounded-md border border-emerald-700/50 bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300 md:px-2.5 md:text-xs">
                Save ₱{(product.originalPrice - product.price).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3 md:pt-1">
            <Link
              href={`/marketplace/products/${product.id}`}
              className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-[#65486f] px-2.5 text-xs font-semibold text-[#fffafa] shadow-xs transition-all hover:bg-[#7a5985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-11 sm:w-auto sm:gap-2 sm:px-6 sm:text-sm md:h-12"
            >
              <Eye className="size-4" />
              <span>View product</span>
            </Link>

            {isOwner ? (
              <Link
                href={`/seller/products?listing=${encodeURIComponent(product.id)}`}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/20 px-2.5 text-xs font-semibold text-[#fffafa] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-11 sm:w-auto sm:gap-2 sm:px-5 sm:text-sm md:h-12"
              >
                <Package className="size-4 text-[#e59bc9]" />
                Manage Listing
              </Link>
            ) : <button
              type="button"
              disabled={isLoading}
              onClick={() => onAddToCart(product)}
              className="inline-flex h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-transparent px-2.5 text-xs font-semibold text-[#fffafa] transition-all hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-50 sm:h-11 sm:w-auto sm:gap-2 sm:px-5 sm:text-sm md:h-12"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin text-[#e59bc9]" /> : <ShoppingCart className="size-4 text-[#e59bc9]" />}
              <span>Add to cart</span>
            </button>}
          </div>
        </div>

        {/* A bounded thumbnail avoids wide empty gutters around portrait photos. */}
        <div className="relative order-first mx-auto flex w-full max-w-none items-center justify-center sm:max-w-md md:order-none md:col-span-5 md:mx-0 md:max-w-80 md:justify-self-end">
          {product.image ? (
            <div className="relative aspect-[16/10] h-auto w-full overflow-hidden rounded-2xl border border-white/15 bg-[#19131b] shadow-[0_18px_50px_rgba(0,0,0,0.3)] md:aspect-square">
              <Link
                href={`/marketplace/products/${product.id}`}
                className="group relative block size-full overflow-hidden rounded-2xl bg-[#19131b] focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                aria-label={`View ${product.name}`}
              >
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 320px, (min-width: 768px) 280px, 90vw"
                  className="pointer-events-none select-none object-contain object-center transition-transform duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transform-none md:object-cover"
                />
              </Link>
            </div>
          ) : (
            <div className="relative flex aspect-[16/10] h-auto w-full flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#19131b]/60 p-4 text-center md:aspect-square">
              <Sparkles className="size-10 text-[#e59bc9]" />
              <span className="text-xs font-semibold text-white/60">{product.category}</span>
            </div>
          )}
        </div>
      </div>

      {itemCount > 1 && (
        <button
          type="button"
          onClick={() => {
            setActiveIndex((current) => (current + 1) % itemCount);
          }}
          aria-label="Show next listing"
          className="absolute right-24 top-1/2 z-30 hidden size-11 -translate-y-1/2 translate-x-2 items-center justify-center rounded-full border border-white/15 bg-[#2b2230]/90 text-[#fffafa] opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 hover:border-[#e59bc9]/50 hover:bg-[#65486f] focus:translate-x-0 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white group-hover/banner:translate-x-0 group-hover/banner:opacity-100 group-focus-within/banner:translate-x-0 group-focus-within/banner:opacity-100 motion-reduce:transition-none xl:flex"
        >
          <ChevronRight className="size-5" strokeWidth={2.2} />
        </button>
      )}

      {itemCount > 1 && (
        <div
          className="absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-2 backdrop-blur-sm md:flex"
          aria-label="Choose a featured listing"
        >
          {products.map((item, index) => {
            const isActive = index === safeIndex;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show listing ${index + 1}: ${item.name}`}
                aria-current={isActive ? "true" : undefined}
                className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9] ${
                  isActive
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/35 hover:bg-white/65"
                }`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
