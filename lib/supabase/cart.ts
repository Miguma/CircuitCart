import { createClient } from "./client";
import { getCurrentUser } from "./auth";
import { CartItem } from "@/components/marketplace/marketplace-provider";
import { mapDbProductToMarketplaceProduct } from "@/lib/marketplace/product-adapter";
import { CartItemWithProduct, CartOfferDetails } from "./types";

const DISMISSED_OFFERS_KEY = "circuitcart:dismissed_offers";

export function getDismissedOfferIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_OFFERS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markOfferDismissed(offerId: string): void {
  if (typeof window === "undefined") return;
  try {
    const dismissed = getDismissedOfferIds();
    dismissed.add(offerId);
    localStorage.setItem(DISMISSED_OFFERS_KEY, JSON.stringify(Array.from(dismissed)));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Fetches all persistent cart items for the authenticated user,
 * synchronizing and validating any attached or active private negotiated offers.
 */
export async function getCartItems(options?: { throwOnError?: boolean }): Promise<CartItem[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      if (options?.throwOnError) throw new Error("Your session expired. Sign in to refresh your cart.");
      return [];
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        id,
        user_id,
        product_id,
        quantity,
        offer_id,
        created_at,
        updated_at,
        chat_offers (
          id,
          unit_price,
          quantity,
          status,
          expires_at,
          conversation_id
        ),
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
      if (options?.throwOnError) throw new Error("Unable to refresh your cart. Your displayed items have been kept.");
      return [];
    }

    const items: CartItem[] = [];
    const dismissedOfferIds = getDismissedOfferIds();

    for (const raw of data as unknown as CartItemWithProduct[]) {
      if (!raw.products) continue;

      const product = mapDbProductToMarketplaceProduct(raw.products);
      let offerDetails: CartOfferDetails | undefined = undefined;
      let effectiveOfferId: string | undefined = undefined;
      let effectiveQuantity = raw.quantity;

      // 1. If cart row already has an offer_id attached, validate it
      if (raw.offer_id && raw.chat_offers) {
        const o = raw.chat_offers;
        const expiresAtMs = new Date(o.expires_at).getTime();
        const nowMs = Date.now();
        const isExpired = expiresAtMs <= nowMs;
        const isWithdrawn = o.status === "withdrawn" || o.status === "declined";
        const isValid = o.status === "accepted" && !isExpired && !isWithdrawn;

        if (isValid) {
          // Valid accepted offer: apply negotiated unit price and lock quantity
          product.originalPrice = product.price;
          product.price = Number(o.unit_price);
          effectiveOfferId = o.id;
          effectiveQuantity = o.quantity ?? raw.quantity;

          offerDetails = {
            id: o.id,
            unitPrice: Number(o.unit_price),
            quantity: o.quantity ?? raw.quantity,
            status: "accepted",
            expiresAt: o.expires_at,
            isExpired: false,
            isWithdrawn: false,
            isValid: true,
            conversationId: o.conversation_id || null,
          };
        } else {
          // Offer is expired, withdrawn, or declined.
          // Clear dead offer_id from database row so subsequent checkout RPC validations succeed at standard price
          try {
            await supabase
              .from("cart_items")
              .update({ offer_id: null })
              .eq("id", raw.id);
          } catch {
            // Ignore silent cleanup failure
          }

          effectiveOfferId = undefined;
          if (!dismissedOfferIds.has(o.id)) {
            offerDetails = {
              id: o.id,
              unitPrice: Number(o.unit_price),
              quantity: o.quantity ?? raw.quantity,
              status: isExpired ? "expired" : o.status,
              expiresAt: o.expires_at,
              isExpired,
              isWithdrawn,
              isValid: false,
              conversationId: o.conversation_id || null,
            };
          }
        }
      }

      // 2. If cart row had NO offer_id (or was created after offer was accepted):
      // Check if there is an active, accepted unexpired private offer for this buyer & product
      if (!effectiveOfferId && !offerDetails?.isExpired && !offerDetails?.isWithdrawn) {
        const { data: activeOffer } = await supabase
          .from("chat_offers")
          .select("id, unit_price, quantity, status, expires_at, conversation_id")
          .eq("buyer_id", user.id)
          .eq("product_id", raw.product_id)
          .eq("status", "accepted")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeOffer) {
          // Auto-reconcile cart row with the valid accepted offer
          try {
            await supabase
              .from("cart_items")
              .update({
                offer_id: activeOffer.id,
                quantity: activeOffer.quantity,
              })
              .eq("id", raw.id);
          } catch {
            // Ignore background sync failure
          }

          product.originalPrice = product.price;
          product.price = Number(activeOffer.unit_price);
          effectiveOfferId = activeOffer.id;
          effectiveQuantity = activeOffer.quantity;

          offerDetails = {
            id: activeOffer.id,
            unitPrice: Number(activeOffer.unit_price),
            quantity: activeOffer.quantity,
            status: "accepted",
            expiresAt: activeOffer.expires_at,
            isExpired: false,
            isWithdrawn: false,
            isValid: true,
            conversationId: activeOffer.conversation_id || null,
          };
        } else if (!offerDetails) {
          // If no active offer exists, check if there is an accepted or withdrawn offer that expired
          const { data: pastOffer } = await supabase
            .from("chat_offers")
            .select("id, unit_price, quantity, status, expires_at, conversation_id")
            .eq("buyer_id", user.id)
            .eq("product_id", raw.product_id)
            .in("status", ["accepted", "withdrawn"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pastOffer) {
            const isExpired = Date.parse(pastOffer.expires_at) <= Date.now();
            const isWithdrawn = pastOffer.status === "withdrawn";
            if ((isExpired || isWithdrawn) && !dismissedOfferIds.has(pastOffer.id)) {
              offerDetails = {
                id: pastOffer.id,
                unitPrice: Number(pastOffer.unit_price),
                quantity: pastOffer.quantity ?? raw.quantity,
                status: isExpired ? "expired" : pastOffer.status,
                expiresAt: pastOffer.expires_at,
                isExpired,
                isWithdrawn,
                isValid: false,
                conversationId: pastOffer.conversation_id || null,
              };
            }
          }
        }
      }

      const stockLimit = Math.max(1, product.stock ?? 1);
      const validQuantity = Math.max(1, Math.min(effectiveQuantity, stockLimit));

      items.push({
        product,
        quantity: validQuantity,
        offerId: effectiveOfferId,
        offer: offerDetails,
      });
    }

    return items;
  } catch (err) {
    console.warn("Error in getCartItems:", err);
    if (options?.throwOnError) throw err;
    return [];
  }
}

/**
 * Adds a product to the authenticated user's cart (or increments quantity).
 * If the buyer has an active accepted private offer, automatically binds the offer_id
 * and locks the quantity to the negotiated amount.
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
    .select("id, status, stock, title, price")
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

  // 2. Check for an active, accepted private offer for this buyer and product
  const { data: activeOffer } = await supabase
    .from("chat_offers")
    .select("id, quantity, unit_price, status, expires_at")
    .eq("buyer_id", user.id)
    .eq("product_id", productId)
    .eq("status", "accepted")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Check if product already exists in user's cart
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity, offer_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (activeOffer) {
    // If the buyer has an accepted private offer, the cart item MUST bind to that offer
    // and lock strictly to the negotiated quantity.
    if (existing) {
      const { error: updateError } = await supabase
        .from("cart_items")
        .update({
          offer_id: activeOffer.id,
          quantity: activeOffer.quantity,
        })
        .eq("id", existing.id);

      if (updateError) {
        throw new Error(`Failed to update cart: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from("cart_items")
        .insert({
          user_id: user.id,
          product_id: productId,
          quantity: activeOffer.quantity,
          offer_id: activeOffer.id,
        });

      if (insertError) {
        throw new Error(`Failed to add to cart: ${insertError.message}`);
      }
    }
    return;
  }

  // Standard item addition (no active private offer)
  if (existing) {
    const newQuantity = existing.quantity + quantity;
    if (newQuantity > product.stock) {
      throw new Error(`Cannot add more. Only ${product.stock} items available in stock.`);
    }

    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity: newQuantity, offer_id: null })
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
        offer_id: null,
      });

    if (insertError) {
      throw new Error(`Failed to add to cart: ${insertError.message}`);
    }
  }
}

/**
 * Updates the quantity of a cart item.
 * Prevents changing quantity away from negotiated quantity while an active offer is attached.
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

  // Check if item has an active accepted offer
  const { data: cartItem } = await supabase
    .from("cart_items")
    .select(`
      id,
      quantity,
      offer_id,
      chat_offers (
        id,
        status,
        quantity,
        expires_at
      )
    `)
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  const rawOffer = cartItem?.chat_offers as { status?: string; expires_at?: string; quantity?: number } | null;
  const isOfferValid = rawOffer?.status === "accepted" && new Date(rawOffer.expires_at || 0).getTime() > Date.now();

  if (isOfferValid && rawOffer?.quantity && quantity !== rawOffer.quantity) {
    throw new Error(
      `Quantity is locked to ${rawOffer.quantity} by your accepted private offer. To buy a different quantity, please dismiss the offer.`
    );
  }

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
 * Dismisses an offer on a cart item so it reverts to the standard listing price.
 */
export async function dismissCartOffer(productId: string, offerId?: string): Promise<void> {
  if (offerId) {
    markOfferDismissed(offerId);
  }
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("cart_items")
    .update({ offer_id: null })
    .eq("user_id", user.id)
    .eq("product_id", productId);

  if (error) {
    throw new Error(`Failed to dismiss offer: ${error.message}`);
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
