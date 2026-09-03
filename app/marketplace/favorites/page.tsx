"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Heart, ArrowLeft, ShoppingBag } from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { ProductCard } from "@/components/marketplace/product-card";
import { DUMMY_PRODUCTS } from "@/components/marketplace/marketplace-data";
import { toast } from "sonner";

export default function FavoritesPage() {
  const { favorites, toggleFavorite, addToCart, setQuickViewProduct } =
    useMarketplace();

  const savedProducts = useMemo(() => {
    return DUMMY_PRODUCTS.filter((prod) => favorites.includes(prod.id));
  }, [favorites]);

  const handleAddToCart = (product: (typeof DUMMY_PRODUCTS)[0]) => {
    addToCart(product);
    toast.success(`Added "${product.name}" to your cart!`);
  };

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
            <span className="px-2.5 py-0.5 text-xs font-bold bg-[#65486f] text-white rounded-full">
              {savedProducts.length}
            </span>
          </div>
          <p className="text-xs text-[#d6cbd5] mt-1">
            Items you have bookmarked for easy reference and price updates.
          </p>
        </div>

        {savedProducts.length > 0 && (
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#342339] hover:bg-[#45304b] text-white border border-white/10 rounded-xl transition-colors self-start sm:self-auto shadow-xs"
          >
            <ShoppingBag className="size-3.5 text-[#e59bc9]" />
            <span>Discover more</span>
          </Link>
        )}
      </div>

      {/* Empty State vs Products Display */}
      {savedProducts.length === 0 ? (
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
              ? "flex flex-wrap justify-center gap-6 py-2"
              : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 py-2"
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
