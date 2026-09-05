import type {
  CategoryFilter,
  Product,
} from "@/components/marketplace/marketplace-data";

export const PRODUCT_CONDITIONS = [
  "All",
  "New",
  "Like New",
  "Good",
  "Fair",
] as const;

export const PRICE_RANGES = [
  { value: "all", label: "Any price" },
  { value: "under-5000", label: "Under ₱5,000" },
  { value: "5000-20000", label: "₱5,000 – ₱20,000" },
  { value: "over-20000", label: "Over ₱20,000" },
] as const;

export const PRODUCT_SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" },
  { value: "rating", label: "Highest rated" },
] as const;

export type ProductConditionFilter = (typeof PRODUCT_CONDITIONS)[number];
export type PriceRangeFilter = (typeof PRICE_RANGES)[number]["value"];
export type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];

export interface CatalogFilters {
  query: string;
  category: CategoryFilter;
  condition: ProductConditionFilter;
  priceRange: PriceRangeFilter;
  minPrice?: number | null;
  maxPrice?: number | null;
  verifiedOnly: boolean;
  sort: ProductSort;
}

function isInPriceRange(
  price: number,
  range: PriceRangeFilter,
  minPrice?: number | null,
  maxPrice?: number | null
) {
  if (typeof minPrice === "number" && !isNaN(minPrice) && minPrice > 0) {
    if (price < minPrice) return false;
  }
  if (typeof maxPrice === "number" && !isNaN(maxPrice) && maxPrice > 0) {
    if (price > maxPrice) return false;
  }
  if ((minPrice == null || isNaN(minPrice) || minPrice <= 0) &&
      (maxPrice == null || isNaN(maxPrice) || maxPrice <= 0)) {
    if (range === "under-5000") return price < 5_000;
    if (range === "5000-20000") return price >= 5_000 && price <= 20_000;
    if (range === "over-20000") return price > 20_000;
  }
  return true;
}

export function filterAndSortProducts(
  products: Product[],
  filters: CatalogFilters
) {
  const query = filters.query.trim().toLowerCase();

  const filtered = products.filter((product) => {
    const searchableText = [
      product.name,
      product.specs,
      product.sellerName,
      product.location,
      product.category,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (filters.category === "All" || product.category === filters.category) &&
      (filters.condition === "All" ||
        product.condition === filters.condition) &&
      isInPriceRange(
        product.price,
        filters.priceRange,
        filters.minPrice,
        filters.maxPrice
      ) &&
      (!filters.verifiedOnly || product.isVerifiedSeller) &&
      (!query || searchableText.includes(query))
    );
  });

  if (filters.sort === "price-low") {
    return filtered.toSorted((a, b) => a.price - b.price);
  }

  if (filters.sort === "price-high") {
    return filtered.toSorted((a, b) => b.price - a.price);
  }

  if (filters.sort === "rating") {
    return filtered.toSorted(
      (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount
    );
  }

  return filtered;
}

export function hasActiveCatalogFilters(filters: CatalogFilters) {
  return (
    filters.query.trim() !== "" ||
    filters.category !== "All" ||
    filters.condition !== "All" ||
    filters.priceRange !== "all" ||
    (filters.minPrice != null && !isNaN(filters.minPrice) && filters.minPrice > 0) ||
    (filters.maxPrice != null && !isNaN(filters.maxPrice) && filters.maxPrice > 0) ||
    filters.verifiedOnly ||
    filters.sort !== "recommended"
  );
}
