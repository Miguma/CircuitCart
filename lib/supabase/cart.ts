import { createClient } from "./client";
import { getCurrentUser } from "./auth";
import { CartItem } from "@/components/marketplace/marketplace-provider";
import { mapDbProductToMarketplaceProduct } from "@/lib/marketplace/product-adapter";
import { CartItemWithProduct } from "./types";

/**
 * Fetches all persistent cart items for the authenticated user
 */
export async function getCartItems(): Promise<CartItem[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        id,
        user_id,
        product_id,
        quantity,
        created_at,
        updated_at,
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
      console.warn("Failed to fetch cart items:", error?.message);
      return [];
    }

    const items: CartItem[] = [];

    for (const raw of data as unknown as CartItemWithProduct[]) {
      if (raw.products) {
        const product = mapDbProductToMarketplaceProduct(raw.products);
        const stockLimit = Math.max(1, product.stock ?? 1);
        const validQuantity = Math.max(1, Math.min(raw.quantity, stockLimit));
        items.push({
          product,
          quantity: validQuantity,
        });
      }
    }

    return items;
  } catch (err) {
    console.warn("Error in getCartItems:", err);
    return [];
  }
}

/**
 * Adds a product to the authenticated user's cart (or increments quantity)
 */
export async function addCartItem(productId: string, quantity = 1): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please log in to add items to your cart.");
  }

  const supabase = createClient();

  // 1. Fetch product to verify status and stock
  const { data: product, error: prodError } = await supabase
    .from("products")
    .select("id, status, stock, title")
    .eq("id", productId)
    .single();

  if (prodError || !product) {
    throw new Error("Product not found or unavailable.");
  }

  if (product.status !== "active") {
    throw new Error(`"${product.title}" is currently not available for purchase.`);
  }

  if (product.stock <= 0) {
    throw new Error(`"${product.title}" is currently sold out.`);
  }

  // 2. Check if product already exists in user's cart
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    const newQuantity = existing.quantity + quantity;
    if (newQuantity > product.stock) {
      throw new Error(`Cannot add more. Only ${product.stock} items available in stock.`);
    }

    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity: newQuantity })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update cart: ${updateError.message}`);
    }
  } else {
    if (quantity > product.stock) {
      throw new Error(`Only ${product.stock} items available in stock.`);
    }

    const { error: insertError } = await supabase
      .from("cart_items")
      .insert({
        user_id: user.id,
        product_id: productId,
        quantity,
      });

    if (insertError) {
      throw new Error(`Failed to add to cart: ${insertError.message}`);
    }
  }
}

/**
 * Updates the quantity of a cart item
 */
export async function updateCartItemQuantity(
  productId: string,
  quantity: number
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please log in to update your cart.");
  }

  if (quantity <= 0) {
    await removeCartItem(productId);
    return;
  }

  const supabase = createClient();

  // Verify stock
  const { data: product } = await supabase
    .from("products")
    .select("stock, title")
    .eq("id", productId)
    .single();

  if (product && quantity > product.stock) {
    throw new Error(`Maximum available stock for "${product.title}" is ${product.stock}.`);
  }

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("user_id", user.id)
    .eq("product_id", productId);

  if (error) {
    throw new Error(`Failed to update quantity: ${error.message}`);
  }
}

/**
 * Removes a product from the user's cart
 */
export async function removeCartItem(productId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", productId);

  if (error) {
    throw new Error(`Failed to remove item: ${error.message}`);
  }
}

/**
 * Clears all items in the user's cart
 */
export async function clearCart(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Failed to clear cart: ${error.message}`);
  }
}
