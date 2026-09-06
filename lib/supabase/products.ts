import { createClient } from "./client";
import { getCurrentUser } from "./auth";
import { ensureSellerShop } from "./shops";
import { uploadProductImage, deleteProductImage } from "./storage";
import {
  mapDbProductToMarketplaceProduct,
  mapDbProductToSellerProductItem,
} from "@/lib/marketplace/product-adapter";
import type { Product } from "@/components/marketplace/marketplace-data";
import type { SellerProductItem } from "@/lib/seller/seller-data";
import type {
  DbProduct,
  DbProductStatus,
  ProductWithRelations,
  CreateProductInput,
} from "./types";

/**
 * Fetches all active products for the public marketplace
 */
export async function getMarketplaceProducts(): Promise<Product[]> {
  try {
    const supabase = createClient();
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
      .gt("stock", 0)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.warn("Failed to fetch marketplace products from Supabase:", error?.message);
      return [];
    }

    return (data as ProductWithRelations[]).map(mapDbProductToMarketplaceProduct);
  } catch (err) {
    console.warn("Error in getMarketplaceProducts:", err);
    return [];
  }
}

/**
 * Fetches a single product by ID with all relations
 */
export async function getProductById(id: string): Promise<{
  product: Product;
  raw: ProductWithRelations;
  images: string[];
} | null> {
  try {
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

    if (error || !data) return null;

    const raw = data as ProductWithRelations;
    const product = mapDbProductToMarketplaceProduct(raw);

    const sortedImages = [...(raw.product_images || [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => img.storage_path);

    return { product, raw, images: sortedImages };
  } catch {
    return null;
  }
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
  const shop = await ensureSellerShop(
    user.id,
    user.user_metadata?.full_name || "Seller Shop"
  );

  const supabase = createClient();
  const cleanTitle = input.title.trim();
  const slugBase = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;
  const status: DbProductStatus = input.status || "draft";
  const publishedAt = status === "active" ? new Date().toISOString() : null;

  // 1. Insert product row
  const { data: productData, error: productError } = await supabase
    .from("products")
    .insert({
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
      published_at: publishedAt,
    })
    .select()
    .single();

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

  // Fetch images to delete from storage
  const { data: images } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  if (images && images.length > 0) {
    for (const img of images) {
      await deleteProductImage(img.storage_path);
    }
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`);
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

  const { data: cloned, error: cloneError } = await supabase
    .from("products")
    .insert({
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
      status: "draft",
      published_at: null,
    })
    .select()
    .single();

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
