import { createClient } from "./client";
import { getCurrentUser, getCurrentUserProfile } from "./auth";
import { ensureSellerShop } from "./shops";


import {
  uploadProductImage,
  deleteProductImage,
  getProductImageUrl,
} from "./storage";
import {
  mapDbProductToMarketplaceProduct,
  mapDbProductToSellerProductItem,
} from "@/lib/marketplace/product-adapter";
import type { Product } from "@/components/marketplace/marketplace-data";
import type { SellerProductItem } from "@/lib/seller/seller-data";
import type {
  DbProduct,
  DbProductCondition,
  DbProductStatus,
  ProductWithRelations,
  CreateProductInput,
} from "./types";

/**
 * Fetches all active products for the public marketplace.
 *
 * Migration Compatibility:
 * 1. Post-migration: Strictly requires status = 'active' AND verification_status = 'approved'.
 * 2. Pre-migration: If the database schema has not applied the AI verification migration yet
 *    (PostgREST error 42703 'undefined_column' on verification_status), falls back to the
 *    legacy schema condition (status = 'active') so existing products remain viewable during
 *    pre-migration development.
 * 3. Error Safety: Database errors (network, auth, down) are logged and thrown rather than
 *    silently swallowed into empty arrays, allowing the UI to render the dedicated error state.
 *    No unconditional fallback is ever used.
 */
export async function getMarketplaceProducts(): Promise<Product[]> {
  const supabase = createClient();

  // Primary post-migration query: require status = 'active' AND verification_status = 'approved'
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      shops (
        id,
        name,
        slug,
        is_verified,
        location
      ),
      profiles (
        id,
        full_name,
        avatar_url
      ),
      product_images (
        id,
        storage_path,
        sort_order
      )
    `)
    .eq("status", "active")
    .eq("verification_status", "approved")
    .gt("stock", 0)
    .order("created_at", { ascending: false });

  if (!error && data) {
    return (data as ProductWithRelations[]).map(mapDbProductToMarketplaceProduct);
  }

  // Check if error specifically indicates 'verification_status' column does not exist (pre-migration DB)
  const isMissingVerificationColumn =
    error?.code === "42703" ||
    (typeof error?.message === "string" &&
      error.message.toLowerCase().includes("verification_status") &&
      error.message.toLowerCase().includes("does not exist"));

  if (isMissingVerificationColumn) {
    console.info(
      "[Marketplace] Pre-migration schema detected: 'verification_status' column does not exist. Using legacy active products filter."
    );

    const legacyResponse = await supabase
      .from("products")
      .select(`
        *,
        shops (
          id,
          name,
          slug,
          is_verified,
          location
        ),
        profiles (
          id,
          full_name,
          avatar_url
        ),
        product_images (
          id,
          storage_path,
          sort_order
        )
      `)
      .eq("status", "active")
      .gt("stock", 0)
      .order("created_at", { ascending: false });

    if (legacyResponse.error) {
      console.error(
        "Supabase marketplace fetch error (legacy schema):",
        legacyResponse.error
      );
      throw new Error(
        `Failed to fetch marketplace products: ${legacyResponse.error.message}`
      );
    }

    return ((legacyResponse.data || []) as ProductWithRelations[]).map(
      mapDbProductToMarketplaceProduct
    );
  }

  // Real database error (network, down, auth, or unexpected error)
  console.error("Supabase marketplace fetch error:", error);
  throw new Error(
    `Failed to fetch marketplace products: ${error?.message || "Database query failed"}`
  );
}

/**
 * Fetches a single product by ID with all relations
 */
export async function getProductById(id: string): Promise<{
  product: Product;
  raw: ProductWithRelations;
  images: string[];
} | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      shops (
        id,
        name,
        slug,
        description,
        is_verified,
        location
      ),
      profiles (
        id,
        full_name,
        avatar_url
      ),
      product_images (
        id,
        storage_path,
        sort_order
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Supabase getProductById error:", error);
    throw new Error(`Failed to fetch product details: ${error.message}`);
  }

  if (!data) return null;

  const raw = data as ProductWithRelations;

  // Schema-aware public visibility check:
  // Post-migration: Must be status === 'active' AND verification_status === 'approved'.
  // Pre-migration (verification_status is not a column on the row): Must be status === 'active'.
  const hasVerificationColumn =
    "verification_status" in raw &&
    raw.verification_status !== undefined &&
    raw.verification_status !== null;

  const isPubliclyVisible = hasVerificationColumn
    ? raw.status === "active" && raw.verification_status === "approved"
    : raw.status === "active";

  if (!isPubliclyVisible) {
    const currentUser = await getCurrentUser().catch(() => null);
    const isOwner = currentUser?.id === raw.seller_id;
    const isAdmin = currentUser?.email === "admin@circuitcart.com";
    if (!isOwner && !isAdmin) {
      return null;
    }
  }

  const product = mapDbProductToMarketplaceProduct(raw);

  const sortedImages = [...(raw.product_images || [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((img) => getProductImageUrl(img.storage_path));

  return { product, raw, images: sortedImages };
}

/**
 * Fetches all products owned by a seller for the seller dashboard
 */
export async function getSellerProducts(sellerId: string): Promise<SellerProductItem[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_images (
          id,
          storage_path,
          sort_order
        )
      `)
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.warn("Failed to fetch seller products:", error?.message);
      return [];
    }

    return (data as (DbProduct & { product_images?: { storage_path: string; sort_order: number }[] })[]).map(
      (item) => {
        const sortedImages = [...(item.product_images || [])].sort(
          (a, b) => a.sort_order - b.sort_order
        );
        const primaryPath = sortedImages[0]?.storage_path;
        return mapDbProductToSellerProductItem(item, primaryPath);
      }
    );
  } catch (err) {
    console.warn("Error in getSellerProducts:", err);
    return [];
  }
}

/**
 * Creates a new product listing along with image uploads
 */
export async function createProduct(
  input: CreateProductInput,
  imageFiles: File[]
): Promise<{ id: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in as a seller to create a product.");
  }

  // Ensure seller has an active shop row
  const userProfile = await getCurrentUserProfile();
  const defaultShopName = userProfile?.full_name || userProfile?.username || "Seller Shop";
  const shop = await ensureSellerShop(user.id, defaultShopName);


  const supabase = createClient();
  const cleanTitle = input.title.trim();
  const slugBase = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;
  // New listings start as draft pending AI product verification
  const status: DbProductStatus = "draft";

  // 1. Insert product row
  const baseProductPayload = {
    seller_id: user.id,
    shop_id: shop.id,
    title: cleanTitle,
    slug,
    category: input.category,
    condition: input.condition,
    price: input.price,
    original_price: input.original_price || null,
    stock: input.stock,
    specs: input.specs?.trim() || null,
    description: input.description?.trim() || null,
    location: input.location?.trim() || shop.location || "Cebu City, Central Visayas",
    status,
    published_at: null,
  };

  let productData: DbProduct | null = null;
  let productError: { message?: string; code?: string } | null = null;

  const insertWithVerification = await supabase
    .from("products")
    .insert({
      ...baseProductPayload,
      verification_status: "pending",
    })
    .select()
    .single();

  if (
    insertWithVerification.error &&
    (insertWithVerification.error.code === "42703" ||
      insertWithVerification.error.message?.includes("verification_status"))
  ) {
    const fallbackInsert = await supabase
      .from("products")
      .insert(baseProductPayload)
      .select()
      .single();
    productData = fallbackInsert.data as DbProduct | null;
    productError = fallbackInsert.error;
  } else {
    productData = insertWithVerification.data as DbProduct | null;
    productError = insertWithVerification.error;
  }

  if (productError || !productData) {
    throw new Error(`Failed to create product: ${productError?.message || "Database insert error"}`);
  }

  const productId = productData.id;

  // 2. Upload images (up to 5)
  const imageRows: { product_id: string; storage_path: string; sort_order: number }[] = [];
  const uploadedPaths: string[] = [];
  let uploadFailureError: Error | null = null;

  for (let i = 0; i < Math.min(imageFiles.length, 5); i++) {
    const file = imageFiles[i];
    try {
      const { storagePath } = await uploadProductImage(user.id, productId, file);
      uploadedPaths.push(storagePath);
      imageRows.push({
        product_id: productId,
        storage_path: storagePath,
        sort_order: i,
      });
    } catch (uploadErr) {
      console.error(`Failed to upload image index ${i}:`, uploadErr);
      uploadFailureError =
        uploadErr instanceof Error
          ? uploadErr
          : new Error(`Failed to upload image "${file.name}"`);
      break;
    }
  }

  // If any selected image failed to upload, roll back uploaded files and product row
  if (uploadFailureError) {
    for (const path of uploadedPaths) {
      await deleteProductImage(path).catch(() => {});
    }
    await supabase.from("products").delete().eq("id", productId);
    throw new Error(
      `Image upload failed: ${uploadFailureError.message}. The product was not created.`
    );
  }

  // 3. Insert product_images rows
  if (imageRows.length > 0) {
    const { error: imgError } = await supabase
      .from("product_images")
      .insert(imageRows);

    if (imgError) {
      for (const path of uploadedPaths) {
        await deleteProductImage(path).catch(() => {});
      }
      await supabase.from("products").delete().eq("id", productId);
      throw new Error(
        `Failed to save product images: ${imgError.message}. The product was not created.`
      );
    }
  }

  return { id: productId };
}

export interface UpdateProductPayload {
  productId: string;
  input: {
    title: string;
    category: string;
    condition: DbProductCondition;
    price: number;
    original_price?: number | null;
    stock: number;
    specs?: string;
    description?: string;
    location?: string;
    status?: DbProductStatus;
  };
  keptExistingImages: {
    id: string;
    storage_path: string;
    sort_order: number;
  }[];
  newImageFiles: {
    file: File;
    sort_order: number;
  }[];
  removedStoragePaths: string[];
}

/**
 * Updates an existing product listing and synchronizes images
 */
export async function updateProduct(payload: UpdateProductPayload): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in as a seller to update a product.");
  }

  const supabase = createClient();
  const { productId, input, keptExistingImages, newImageFiles, removedStoragePaths } = payload;

  // 1. Verify ownership from database
  const { data: existing, error: fetchErr } = await supabase
    .from("products")
    .select("id, seller_id, status, stock")
    .eq("id", productId)
    .single();

  if (fetchErr || !existing) {
    throw new Error("Product not found.");
  }

  if (existing.seller_id !== user.id) {
    throw new Error("You do not have permission to edit this product.");
  }

  // 2. Adjust status if stock reached 0 or replenished
  let nextStatus: DbProductStatus = input.status || existing.status || "active";
  if (input.stock === 0 && nextStatus === "active") {
    nextStatus = "sold_out";
  } else if (input.stock > 0 && nextStatus === "sold_out") {
    nextStatus = "active";
  }

  // 3. Update products row
  const cleanTitle = input.title.trim();
  const { error: updateErr } = await supabase
    .from("products")
    .update({
      title: cleanTitle,
      category: input.category,
      condition: input.condition,
      price: input.price,
      original_price: input.original_price || null,
      stock: input.stock,
      specs: input.specs?.trim() || null,
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (updateErr) {
    throw new Error(`Failed to update product: ${updateErr.message}`);
  }

  // 4. Handle image synchronization (upload new, update order, insert new rows, delete removed)
  const uploadedPaths: string[] = [];
  const newImageRows: { product_id: string; storage_path: string; sort_order: number }[] = [];

  try {
    // 4a. Upload new image files with their explicit UI sort_order
    for (let i = 0; i < newImageFiles.length; i++) {
      const item = newImageFiles[i];
      try {
        const { storagePath } = await uploadProductImage(user.id, productId, item.file);
        uploadedPaths.push(storagePath);
        newImageRows.push({
          product_id: productId,
          storage_path: storagePath,
          sort_order: item.sort_order,
        });
      } catch (uploadErr) {
        console.error(`Failed to upload image during update:`, uploadErr);
        throw new Error(
          uploadErr instanceof Error
            ? uploadErr.message
            : `Failed to upload "${item.file.name}".`
        );
      }
    }

    // 5. Update existing image sort orders in parallel
    if (keptExistingImages && keptExistingImages.length > 0) {
      const results = await Promise.all(
        keptExistingImages.map((img) =>
          supabase
            .from("product_images")
            .update({ sort_order: img.sort_order })
            .eq("id", img.id)
        )
      );

      const failed = results.find((res) => res.error);
      if (failed?.error) {
        throw new Error(`Failed to update image order: ${failed.error.message}`);
      }
    }

    // 6. Insert new image rows
    if (newImageRows.length > 0) {
      const { error: insertImgErr } = await supabase
        .from("product_images")
        .insert(newImageRows);

      if (insertImgErr) {
        throw new Error(`Failed to save new images: ${insertImgErr.message}`);
      }
    }

    // 7. Delete removed images from product_images table and storage bucket
    if (removedStoragePaths.length > 0) {
      const { error: deleteImgErr } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", productId)
        .in("storage_path", removedStoragePaths);

      if (deleteImgErr) {
        throw new Error(`Failed to delete removed images: ${deleteImgErr.message}`);
      }

      for (const storagePath of removedStoragePaths) {
        await deleteProductImage(storagePath).catch((err) => {
          console.warn(`Could not delete storage object ${storagePath}:`, err);
        });
      }
    }
  } catch (imageOpErr) {
    // If ANY step failed after new Storage objects were uploaded during THIS attempt, clean them up
    if (uploadedPaths.length > 0) {
      for (const p of uploadedPaths) {
        await deleteProductImage(p).catch((cleanupErr) => {
          console.warn(`Failed to clean up newly uploaded image ${p}:`, cleanupErr);
        });
      }
    }
    throw imageOpErr;
  }
}

/**
 * Updates a product's status (e.g. 'archived', 'active', 'draft')
 */
export async function updateProductStatus(
  productId: string,
  status: DbProductStatus
): Promise<void> {
  const supabase = createClient();
  const publishedAt = status === "active" ? new Date().toISOString() : undefined;

  const updatePayload: Partial<DbProduct> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (publishedAt) {
    updatePayload.published_at = publishedAt;
  }

  const { error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", productId);

  if (error) {
    throw new Error(`Failed to update product status: ${error.message}`);
  }
}

/**
 * Deletes a product owned by the authenticated seller
 */
export async function deleteProduct(productId: string): Promise<void> {
  const supabase = createClient();

  // Capture image paths before the product (and its product_images rows) is removed
  const { data: images } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`);
  }

  // Storage RLS only permits deleting objects that no product_images row references,
  // so cleanup must run after the cascade. Paths still used by a duplicated listing
  // are intentionally retained by the policy.
  if (images && images.length > 0) {
    for (const img of images) {
      await deleteProductImage(img.storage_path);
    }
  }
}

/**
 * Duplicates an existing product as a draft listing
 */
export async function duplicateProduct(productId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in to duplicate a product.");
  }

  const supabase = createClient();
  const { data: original, error: origError } = await supabase
    .from("products")
    .select(`
      *,
      product_images (
        storage_path,
        sort_order
      )
    `)
    .eq("id", productId)
    .single();

  if (origError || !original) {
    throw new Error("Product to duplicate not found.");
  }

  // Create duplicate product as draft
  const cloneTitle = `${original.title} (Copy)`;
  const slugBase = cloneTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;

  const baseClonePayload = {
    seller_id: user.id,
    shop_id: original.shop_id,
    title: cloneTitle,
    slug,
    category: original.category,
    condition: original.condition,
    price: original.price,
    original_price: original.original_price,
    stock: original.stock,
    specs: original.specs,
    description: original.description,
    location: original.location,
    status: "draft" as const,
    published_at: null,
  };

  let cloned: DbProduct | null = null;
  let cloneError: { message?: string; code?: string } | null = null;

  const cloneWithVerification = await supabase
    .from("products")
    .insert({
      ...baseClonePayload,
      verification_status: "pending",
    })
    .select()
    .single();

  if (
    cloneWithVerification.error &&
    (cloneWithVerification.error.code === "42703" ||
      cloneWithVerification.error.message?.includes("verification_status"))
  ) {
    const fallbackClone = await supabase
      .from("products")
      .insert(baseClonePayload)
      .select()
      .single();
    cloned = fallbackClone.data as DbProduct | null;
    cloneError = fallbackClone.error;
  } else {
    cloned = cloneWithVerification.data as DbProduct | null;
    cloneError = cloneWithVerification.error;
  }

  if (cloneError || !cloned) {
    throw new Error(`Failed to clone product: ${cloneError?.message || "Database error"}`);
  }

  // Link existing image paths to the cloned product
  if (original.product_images && original.product_images.length > 0) {
    const clonedImages = original.product_images.map((img: { storage_path: string; sort_order: number }) => ({
      product_id: cloned.id,
      storage_path: img.storage_path,
      sort_order: img.sort_order,
    }));

    await supabase.from("product_images").insert(clonedImages);
  }

  return cloned.id;
}

export interface VerifyProductResponse {
  success: boolean;
  decision: "TECH_APPROVED" | "NON_TECH_REJECTED" | "UNCERTAIN";
  status: "approved" | "rejected" | "uncertain";
  productStatus: "active" | "draft";
  confidence: number;
  reason: string;
  suggestedCategory?: string | null;
  flaggedReasons?: string[];
  modelUsed?: string;
  contentHash?: string;
  error?: string;
  retryAfterSeconds?: number;
}

/**
 * Triggers server-side AI product verification for a product listing.
 */
export async function verifyProductWithAi(
  productId: string,
  imagePreviews?: string[]
): Promise<VerifyProductResponse> {
  const res = await fetch(`/api/products/${encodeURIComponent(productId)}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagePreviews }),
  });

  const data = await res.json().catch(() => ({ error: "Failed to parse response." }));
  if (!res.ok) {
    throw new Error(data.error || `Verification failed with status ${res.status}`);
  }

  return data as VerifyProductResponse;
}

