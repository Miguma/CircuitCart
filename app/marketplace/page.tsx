"use client";

import React, { useState, useMemo } from "react";
import { Sparkles, ShoppingBag, Flame, ShieldCheck, RefreshCw } from "lucide-react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { FeaturedSection } from "@/components/marketplace/featured-section";
import { ProductCard } from "@/components/marketplace/product-card";
import { QuickViewDialog } from "@/components/marketplace/quick-view-dialog";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import {
  DUMMY_PRODUCTS,
  CATEGORIES,
  CategoryFilter,
  Product,
} from "@/components/marketplace/marketplace-data";

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("All");
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [cartCount, setCartCount] = useState<number>(0);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Toggle wishlist item
  const handleToggleWishlist = (productId: string) => {
    setWishlistIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  // Add to cart
  const handleAddToCart = (product: Product) => {
    setCartCount((prev) => prev + 1);
    alert(`Added "${product.name}" to your cart!`);
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return DUMMY_PRODUCTS.filter((prod) => {
      const matchesCategory =
        selectedCategory === "All" || prod.category === selectedCategory;
      const matchesQuery =
        searchQuery.trim() === "" ||
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.specs.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

  // Featured deal product
  const featuredProduct = DUMMY_PRODUCTS.find((p) => p.isFeatured) || DUMMY_PRODUCTS[0];

  // Section grouping
  const recommendedProducts = useMemo(
    () => filteredProducts.filter((p) => p.section === "Recommended for you"),
    [filteredProducts]
  );
  const preOwnedProducts = useMemo(
    () => filteredProducts.filter((p) => p.section === "Pre-owned finds"),
    [filteredProducts]
  );
  const gamingProducts = useMemo(
    () => filteredProducts.filter((p) => p.section === "Popular in gaming"),
    [filteredProducts]
  );
  const trustedProducts = useMemo(
    () => filteredProducts.filter((p) => p.section === "Trusted sellers"),
    [filteredProducts]
  );

  const hasSearchFilterActive = searchQuery.trim() !== "" || selectedCategory !== "All";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] flex flex-col font-sans">
      {/* Sticky Header */}
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        wishlistCount={wishlistIds.length}
        cartCount={cartCount}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat as CategoryFilter)}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Horizontal Category Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar select-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${
                selectedCategory === cat
                  ? "bg-[#f8f3f3] text-[#1d1720] font-bold shadow-xs"
                  : "bg-[#342339]/80 text-[#fffafa] border border-white/10 hover:bg-[#45304b]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Compact Featured Discovery Section (Shown when no specific search is active) */}
        {!hasSearchFilterActive && (
          <FeaturedSection
            product={featuredProduct}
            onQuickView={setQuickViewProduct}
            onAddToCart={handleAddToCart}
          />
        )}

        {/* Search / Filter Empty State */}
        {filteredProducts.length === 0 ? (
          <div className="bg-[#211a24] border border-white/10 rounded-3xl p-12 text-center space-y-4 my-8 shadow-xl">
            <div className="size-12 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
              <RefreshCw className="size-6" />
            </div>
            <h3 className="text-xl font-bold text-[#fffafa]">
              No products found
            </h3>
            <p className="text-sm text-[#b9adb6] max-w-md mx-auto">
              We couldn&apos;t find any items matching &ldquo;{searchQuery || selectedCategory}&rdquo;. Try clearing your search or picking a different category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold bg-[#65486f] text-white hover:bg-[#7a5985] rounded-xl transition-colors"
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          /* SECTIONED PRODUCT LISTINGS (Used exactly once each) */
          <div className="space-y-10">
            {/* SECTION 1: Recommended for you */}
            {recommendedProducts.length > 0 && (
              <section aria-labelledby="heading-recommended" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-[#e59bc9]" />
                    <h2 id="heading-recommended" className="text-xl font-bold text-[#fffafa]">
                      Recommended for you
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-[#b9adb6]">
                    {recommendedProducts.length} items
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  {recommendedProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      isWishlisted={wishlistIds.includes(prod.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onQuickView={setQuickViewProduct}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 2: Pre-owned finds */}
            {preOwnedProducts.length > 0 && (
              <section aria-labelledby="heading-preowned" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-5 text-[#b78bd7]" />
                    <h2 id="heading-preowned" className="text-xl font-bold text-[#fffafa]">
                      Pre-owned finds
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-[#b9adb6]">
                    {preOwnedProducts.length} items
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  {preOwnedProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      isWishlisted={wishlistIds.includes(prod.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onQuickView={setQuickViewProduct}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 3: Popular in gaming */}
            {gamingProducts.length > 0 && (
              <section aria-labelledby="heading-gaming" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="size-5 text-[#e59bc9]" />
                    <h2 id="heading-gaming" className="text-xl font-bold text-[#fffafa]">
                      Popular in gaming
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-[#b9adb6]">
                    {gamingProducts.length} items
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  {gamingProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      isWishlisted={wishlistIds.includes(prod.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onQuickView={setQuickViewProduct}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 4: Trusted sellers */}
            {trustedProducts.length > 0 && (
              <section aria-labelledby="heading-trusted" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-[#b78bd7]" />
                    <h2 id="heading-trusted" className="text-xl font-bold text-[#fffafa]">
                      Trusted sellers
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-[#b9adb6]">
                    {trustedProducts.length} items
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  {trustedProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      isWishlisted={wishlistIds.includes(prod.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onQuickView={setQuickViewProduct}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Accessible Quick-View Modal Dialog */}
      <QuickViewDialog
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        onAddToCart={handleAddToCart}
      />

      {/* Compact CircuitCart Footer */}
      <MarketplaceFooter />
    </div>
  );
}
