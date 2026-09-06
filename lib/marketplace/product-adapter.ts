import type { Product } from "@/components/marketplace/marketplace-data";
import type { SellerProductItem, ListingStatus } from "@/lib/seller/seller-data";
import type { ProductWithRelations, DbProduct, DbProductStatus } from "@/lib/supabase/types";
import { getProductImageUrl } from "@/lib/supabase/storage";

const VALID_CATEGORIES = [
  "Laptops",
  "Gaming",
  "Components",
  "Mobile",
  "Audio",
  "Accessories",
] as const;

function sanitizeCategory(cat: string): Product["category"] {
  if (VALID_CATEGORIES.includes(cat as Product["category"])) {
    return cat as Product["category"];
  }
  return "Accessories";
}

function mapDbStatusToListingStatus(status: DbProductStatus): ListingStatus {
  switch (status) {
    case "active":
      return "Active";
    case "draft":
      return "Draft";
    case "sold_out":
      return "Sold Out";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

/**
 * Converts a database product with its relations into a buyer Marketplace Product
 */
export function mapDbProductToMarketplaceProduct(dbProduct: ProductWithRelations): Product {
  // Sort images and pick the primary one
  const sortedImages = [...(dbProduct.product_images || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const primaryStoragePath = sortedImages[0]?.storage_path;
  const imageUrl = primaryStoragePath
    ? getProductImageUrl(primaryStoragePath)
    : "/images/macbook-air.png";

  const isVerified = Boolean(dbProduct.shops?.is_verified);
  const sellerName = dbProduct.shops?.name || dbProduct.profiles?.full_name || "CircuitCart Seller";
  const location = dbProduct.location || dbProduct.shops?.location || "Cebu City, Central Visayas";

  return {
    id: dbProduct.id,
    name: dbProduct.title,
    category: sanitizeCategory(dbProduct.category),
    price: Number(dbProduct.price),
    originalPrice: dbProduct.original_price ? Number(dbProduct.original_price) : undefined,
    condition: dbProduct.condition,
    rating: 5.0,
    reviewCount: 0,
    sellerName,
    sellerId: dbProduct.seller_id,
    shopId: dbProduct.shop_id || undefined,
    isVerifiedSeller: isVerified,
    location,
    section: "Recommended for you",
    specs: dbProduct.specs || "",
    stock: dbProduct.stock,
    badge: dbProduct.stock <= 2 && dbProduct.stock > 0 ? "Low Stock" : undefined,
    gradientFrom: "#432c45",
    gradientTo: "#281729",
    image: imageUrl,
    description: dbProduct.description || "",
  };
}

/**
 * Converts a database product into a Seller Dashboard Product Item
 */
export function mapDbProductToSellerProductItem(
  dbProduct: DbProduct,
  primaryStoragePath?: string
): SellerProductItem {
  const imageUrl = primaryStoragePath
    ? getProductImageUrl(primaryStoragePath)
    : undefined;

  const dateObj = new Date(dbProduct.updated_at);
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    id: dbProduct.id,
    name: dbProduct.title,
    category: sanitizeCategory(dbProduct.category),
    price: Number(dbProduct.price),
    stock: dbProduct.stock,
    status: mapDbStatusToListingStatus(dbProduct.status),
    views: 0,
    soldCount: 0,
    updatedAt: formattedDate,
    condition: dbProduct.condition,
    image: imageUrl,
    specs: dbProduct.specs || "",
  };
}
