import { createClient } from "./client";
import { getCurrentUser } from "./auth";
import { Product } from "@/components/marketplace/marketplace-data";
import { mapDbProductToMarketplaceProduct } from "@/lib/marketplace/product-adapter";
import { FavoriteWithProduct } from "./types";

/**
 * Gets the list of product IDs favorited by the current authenticated user
 */
export async function getFavorites(): Promise<string[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.warn("Failed to fetch favorites:", error?.message);
      return [];
    }

    return data.map((row) => row.product_id);
  } catch (err) {
    console.warn("Error in getFavorites:", err);
    return [];
  }
}

/**
 * Gets full product models for all products favorited by the current user
 */
export async function getFavoriteProducts(): Promise<Product[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("favorites")
      .select(`
        id,
        user_id,
        product_id,
        created_at,
        products (
          *,
          shops (
            id,
            name,
            slug,
            logo_url,
            banner_url,
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
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.warn("Failed to fetch favorite products:", error?.message);
      return [];
    }

    const products: Product[] = [];

    for (const raw of data as unknown as FavoriteWithProduct[]) {
      if (raw.products) {
        products.push(mapDbProductToMarketplaceProduct(raw.products));
      }
    }

    return products;
  } catch (err) {
    console.warn("Error in getFavoriteProducts:", err);
    return [];
  }
}

/**
 * Adds a product to the user's favorites
 */
export async function addFavorite(productId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please log in to save favorites.");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("favorites")
    .upsert(
      { user_id: user.id, product_id: productId },
      { onConflict: "user_id,product_id" }
    );

  if (error) {
    throw new Error(`Failed to save favorite: ${error.message}`);
  }
}

/**
 * Removes a product from the user's favorites
 */
export async function removeFavorite(productId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", productId);

  if (error) {
    throw new Error(`Failed to remove favorite: ${error.message}`);
  }
}

/**
 * Toggles a product's favorite status for the current user
 */
export async function toggleFavorite(productId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please log in to save favorites.");
  }

  const supabase = createClient();

  // Check if already favorited
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await removeFavorite(productId);
    return false;
  } else {
    await addFavorite(productId);
    return true;
  }
}
