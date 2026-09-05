"use client";

import React, { useMemo, useState } from "react";
import { Sparkles, ShoppingBag, Flame, ShieldCheck, RefreshCw } from "lucide-react";
import { FeaturedSection } from "@/components/marketplace/featured-section";
import { ProductCard } from "@/components/marketplace/product-card";
import { CatalogToolbar, FilterPanel } from "@/components/marketplace/catalog-toolbar";
import {
  DUMMY_PRODUCTS,
  CATEGORIES,
  Product,
} from "@/components/marketplace/marketplace-data";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import {
  filterAndSortProducts,
  hasActiveCatalogFilters,
  type PriceRangeFilter,
  type ProductConditionFilter,
  type ProductSort,
} from "@/lib/marketplace/catalog";
import { toast } from "sonner";

export default function MarketplacePage() {
  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    favorites,
    toggleFavorite,
    addToCart,
    setQuickViewProduct,
  } = useMarketplace();

  const [condition, setCondition] =
    useState<ProductConditionFilter>("All");
  const [priceRange, setPriceRange] = useState<PriceRangeFilter>("all");
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<ProductSort>("recommended");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Add to cart handler with toast
  const handleAddToCart = (product: Product) => {
    addToCart(product);
    toast.success(`Added "${product.name}" to your cart!`);
  };

  const catalogFilters = useMemo(
    () => ({
      query: searchQuery,
      category: selectedCategory,
      condition,
      priceRange,
      minPrice,
      maxPrice,
      verifiedOnly,
      sort,
    }),
    [
      searchQuery,
      selectedCategory,
      condition,
      priceRange,
      minPrice,
      maxPrice,
      verifiedOnly,
      sort,
    ]
  );

  const filteredProducts = useMemo(() => {
    return filterAndSortProducts(DUMMY_PRODUCTS, catalogFilters);
  }, [catalogFilters]);

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

  const hasSearchFilterActive = hasActiveCatalogFilters(catalogFilters);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setCondition("All");
    setPriceRange("all");
    setMinPrice(null);
    setMaxPrice(null);
    setVerifiedOnly(false);
    setSort("recommended");
  };

  // Dynamic grid column class based on filter panel open state
  const gridColsClass = isFilterOpen
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";

  return (
    <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-7">
      {/* ========================================================= */}
      {/* 1. HORIZONTAL TEXT CATEGORY NAVIGATION (Original Colors)   */}
      {/* ========================================================= */}
      <nav
        aria-label="Category navigation"
        className="w-full border-b border-white/10 pb-1 -mt-2"
      >
        <div className="flex items-center justify-center gap-6 sm:gap-8 overflow-x-auto scrollbar-none no-scrollbar select-none py-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`relative pb-3 text-sm transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] rounded-xs ${
                  isSelected
                    ? "font-bold text-[#fffafa]"
                    : "font-medium text-[#d6cbd5] hover:text-[#fffafa]"
                }`}
              >
                <span>{cat}</span>
                {isSelected && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#e59bc9] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ========================================================= */}
      {/* 2. PROMOTIONAL FEATURED BANNER (Shown when no filter active)*/}
      {/* ========================================================= */}
      {!hasSearchFilterActive && (
        <FeaturedSection
          product={featuredProduct}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* ========================================================= */}
      {/* 3. PRODUCT BROWSING HEADER & COMPACT FILTER TOOLBAR       */}
      {/* ========================================================= */}
      <CatalogToolbar
        resultCount={filteredProducts.length}
        condition={condition}
        priceRange={priceRange}
        minPrice={minPrice}
        maxPrice={maxPrice}
        verifiedOnly={verifiedOnly}
        sort={sort}
        isFilterOpen={isFilterOpen}
        onToggleFilter={() => setIsFilterOpen((prev) => !prev)}
        onConditionChange={setCondition}
        onPriceRangeChange={setPriceRange}
        onMinPriceChange={setMinPrice}
        onMaxPriceChange={setMaxPrice}
        onVerifiedOnlyChange={setVerifiedOnly}
        onSortChange={setSort}
        onClear={clearAllFilters}
      />

      {/* ========================================================= */}
      {/* 4. PRODUCT CATALOGUE + NON-MODAL SIDE-BY-SIDE FILTER PANEL*/}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row items-start gap-6 relative">
        {/* Left / Main Product Grid (Reflows seamlessly when filter opens) */}
        <div className="flex-1 w-full min-w-0 transition-all duration-300">
          {filteredProducts.length === 0 ? (
            /* Empty State */
            <div className="bg-[#211a24] border border-white/10 rounded-3xl p-12 text-center space-y-4 my-8 shadow-xl">
              <div className="size-12 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                <RefreshCw className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-[#fffafa]">
                No products found
              </h3>
              <p className="text-xs sm:text-sm text-[#b9adb6] max-w-md mx-auto leading-relaxed">
                We couldn&apos;t find any items matching &ldquo;{searchQuery || selectedCategory}&rdquo;. Try clearing your search or picking a different category.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold bg-[#65486f] text-white hover:bg-[#7a5985] rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Clear search and filters
              </button>
            </div>
          ) : hasSearchFilterActive ? (
            /* Filtered Search Grid */
            <section aria-labelledby="heading-results" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#e59bc9] mb-0.5">
                    Catalogue results
                  </p>
                  <h2 id="heading-results" className="text-xl sm:text-2xl font-bold text-[#fffafa]">
                    Products matching your choices
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
                >
                  Reset all
                </button>
              </div>

              <div className={`grid ${gridColsClass} gap-5 transition-all duration-300`}>
                {filteredProducts.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    isWishlisted={favorites.includes(prod.id)}
                    onToggleWishlist={toggleFavorite}
                    onQuickView={setQuickViewProduct}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            </section>
          ) : (
            /* Categorized Storefront Grid */
            <div className="space-y-10">
              {/* SECTION 1: Recommended for you */}
              {recommendedProducts.length > 0 && (
                <section aria-labelledby="heading-recommended" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4.5 text-[#e59bc9]" />
                      <h2 id="heading-recommended" className="text-xl sm:text-2xl font-bold text-[#fffafa]">
                        Recommended for you
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-[#b9adb6]">
                      {recommendedProducts.length} items
                    </span>
                  </div>

                  <div className={`grid ${gridColsClass} gap-5 transition-all duration-300`}>
                    {recommendedProducts.map((prod) => (
                      <ProductCard
                        key={prod.id}
                        product={prod}
                        isWishlisted={favorites.includes(prod.id)}
                        onToggleWishlist={toggleFavorite}
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
                      <ShoppingBag className="size-4.5 text-[#b78bd7]" />
                      <h2 id="heading-preowned" className="text-xl sm:text-2xl font-bold text-[#fffafa]">
                        Pre-owned finds
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-[#b9adb6]">
                      {preOwnedProducts.length} items
                    </span>
                  </div>

                  <div className={`grid ${gridColsClass} gap-5 transition-all duration-300`}>
                    {preOwnedProducts.map((prod) => (
                      <ProductCard
                        key={prod.id}
                        product={prod}
                        isWishlisted={favorites.includes(prod.id)}
                        onToggleWishlist={toggleFavorite}
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
                      <Flame className="size-4.5 text-[#e59bc9]" />
                      <h2 id="heading-gaming" className="text-xl sm:text-2xl font-bold text-[#fffafa]">
                        Popular in gaming
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-[#b9adb6]">
                      {gamingProducts.length} items
                    </span>
                  </div>

                  <div className={`grid ${gridColsClass} gap-5 transition-all duration-300`}>
                    {gamingProducts.map((prod) => (
                      <ProductCard
                        key={prod.id}
                        product={prod}
                        isWishlisted={favorites.includes(prod.id)}
                        onToggleWishlist={toggleFavorite}
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
                      <ShieldCheck className="size-4.5 text-emerald-400" />
                      <h2 id="heading-trusted" className="text-xl sm:text-2xl font-bold text-[#fffafa]">
                        Trusted sellers
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-[#b9adb6]">
                      {trustedProducts.length} items
                    </span>
                  </div>

                  <div className={`grid ${gridColsClass} gap-5 transition-all duration-300`}>
                    {trustedProducts.map((prod) => (
                      <ProductCard
                        key={prod.id}
                        product={prod}
                        isWishlisted={favorites.includes(prod.id)}
                        onToggleWishlist={toggleFavorite}
                        onQuickView={setQuickViewProduct}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Right: NON-MODAL Desktop Sticky Filter Sidebar (Content-Sized Compact Glassmorphic Card) */}
        {isFilterOpen && (
          <aside
            aria-label="Catalogue filter panel"
            className="hidden lg:flex flex-col w-[360px] xl:w-[380px] shrink-0 sticky top-[4.5rem] self-start h-auto max-h-[calc(100vh-5.5rem)] bg-[#1c121e]/75 backdrop-blur-xl saturate-125 border border-white/[0.08] rounded-2xl shadow-xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-250 z-20"
          >
            <FilterPanel
              resultCount={filteredProducts.length}
              condition={condition}
              priceRange={priceRange}
              minPrice={minPrice}
              maxPrice={maxPrice}
              verifiedOnly={verifiedOnly}
              sort={sort}
              onConditionChange={setCondition}
              onPriceRangeChange={setPriceRange}
              onMinPriceChange={setMinPrice}
              onMaxPriceChange={setMaxPrice}
              onVerifiedOnlyChange={setVerifiedOnly}
              onSortChange={setSort}
              onClear={clearAllFilters}
              onClose={() => setIsFilterOpen(false)}
            />
          </aside>
        )}

        {/* Mobile/Tablet Drawer fallback (< lg) */}
        {isFilterOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setIsFilterOpen(false)}
            />
            <div className="fixed inset-x-0 bottom-0 max-h-[85vh] bg-[#1c121e]/95 backdrop-blur-xl border-t border-white/[0.08] rounded-t-3xl shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom duration-250">
              <FilterPanel
                resultCount={filteredProducts.length}
                condition={condition}
                priceRange={priceRange}
                minPrice={minPrice}
                maxPrice={maxPrice}
                verifiedOnly={verifiedOnly}
                sort={sort}
                onConditionChange={setCondition}
                onPriceRangeChange={setPriceRange}
                onMinPriceChange={setMinPrice}
                onMaxPriceChange={setMaxPrice}
                onVerifiedOnlyChange={setVerifiedOnly}
                onSortChange={setSort}
                onClear={clearAllFilters}
                onClose={() => setIsFilterOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
