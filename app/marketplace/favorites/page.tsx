"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ArrowLeft, ShoppingBag, Loader2 } from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";
import { ProductCard } from "@/components/marketplace/product-card";
import { Product } from "@/components/marketplace/marketplace-data";
import { getFavoriteProducts } from "@/lib/supabase/favorites";
import { toast } from "sonner";

function SavedProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#241c27] overflow-hidden flex flex-col justify-between animate-pulse h-full">
      {/* Product Image Placeholder */}
      <div className="relative w-full aspect-square bg-[#342339]/50 overflow-hidden">
        <div className="absolute top-2 inset-x-2 flex items-center justify-between">
          <div className="h-4 w-12 rounded-md bg-white/10" />
          <div className="size-6 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Card Content Placeholder */}
      <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-2">
        <div className="space-y-1.5">
          {/* Title */}
          <div className="h-3.5 bg-white/10 rounded w-4/5" />
          <div className="h-3.5 bg-white/10 rounded w-3/5" />

          {/* Specs */}
          <div className="h-2.5 bg-white/5 rounded w-11/12 mt-1" />

          {/* Seller / Location */}
          <div className="flex items-center justify-between pt-1">
            <div className="h-2.5 bg-white/5 rounded w-20" />
            <div className="h-2.5 bg-white/5 rounded w-12" />
          </div>

          {/* Rating */}
          <div className="h-2.5 bg-white/5 rounded w-16" />
        </div>

        {/* Bottom Row: Price + Action Button */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-1.5">
          <div className="space-y-1">
            <div className="h-4 bg-white/10 rounded w-16" />
            <div className="h-2.5 bg-white/5 rounded w-10" />
          </div>
          <div className="size-7 rounded-lg bg-[#342339] border border-white/10 shrink-0" />
        </div>
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const router = useRouter();
  const { userId, isLoading: isAccountLoading } = useMarketplaceAccount();
  const { favorites, toggleFavorite, addToCart, setQuickViewProduct } =
    useMarketplace();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isAccountLoading && !userId) {
      router.replace("/login?redirectTo=/marketplace/favorites");
    }
  }, [isAccountLoading, userId, router]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getFavoriteProducts()
      .then((data) => {
        if (active) {
          setProducts(data || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Could not load favorite products:", err);
        if (active) {
          setProducts([]);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // Filter products by current favorites state (handles instant optimistic unfavorite)
  const savedProducts = products.filter((p) => favorites.includes(p.id));

  const handleAddToCart = async (product: Product) => {
    const success = await addToCart(product);
    if (success) {
      toast.success(`Added "${product.name}" to your cart!`);
    }
  };

  if (!isAccountLoading && !userId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
        <p className="text-sm text-[#b9adb6]">Redirecting to login...</p>
      </div>
    );
  }

  const isPageLoading = isAccountLoading || isLoading;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#d6cbd5] mb-1">
            <Link
              href="/marketplace"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Saved Products
            </h1>
            {isPageLoading ? (
              <span className="w-7 h-5 rounded-full bg-white/10 animate-pulse inline-block" />
            ) : (
              <span className="px-2.5 py-0.5 text-xs font-bold bg-[#65486f] text-white rounded-full">
                {savedProducts.length}
              </span>
            )}
          </div>
          <p className="text-xs text-[#d6cbd5] mt-1">
            Items you have bookmarked for easy reference and price updates.
          </p>
        </div>

        {!isPageLoading && savedProducts.length > 0 && (
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#342339] hover:bg-[#45304b] text-white border border-white/10 rounded-xl transition-colors self-start sm:self-auto shadow-xs"
          >
            <ShoppingBag className="size-3.5 text-[#e59bc9]" />
            <span>Discover more</span>
          </Link>
        )}
      </div>

      {/* Loading Skeleton vs Empty State vs Products Display */}
      {isPageLoading ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 py-2"
          aria-busy="true"
          aria-label="Loading saved products"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-full">
              <SavedProductCardSkeleton />
            </div>
          ))}
        </div>
      ) : savedProducts.length === 0 ? (
        <div className="w-full bg-[#241c27] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-xl my-4 min-h-[230px] sm:min-h-[280px] flex flex-col items-center justify-center">
          <div className="size-12 sm:size-14 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-pink-300">
            <Heart className="size-6 sm:size-7 stroke-[1.5]" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">No saved products</h2>
          <p className="text-xs text-[#d6cbd5] max-w-sm mx-auto leading-relaxed">
            Tap the heart icon on any technology listing to save it here for later.
          </p>
          <div className="pt-2">
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-white rounded-xl transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              Browse products
            </Link>
          </div>
        </div>
      ) : (
        /* Favorites Grid: centered when 1-2 items, multi-column when more */
        <div
          className={
            savedProducts.length <= 2
              ? "flex flex-wrap justify-center gap-4 py-2"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 py-2"
          }
        >
          {savedProducts.map((prod) => (
            <div
              key={prod.id}
              className={
                savedProducts.length <= 2
                  ? "w-full max-w-[320px] flex-none"
                  : "w-full"
              }
            >
              <ProductCard
                product={prod}
                isWishlisted={true}
                onToggleWishlist={toggleFavorite}
                onQuickView={setQuickViewProduct}
                onAddToCart={handleAddToCart}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
