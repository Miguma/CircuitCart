import { createClient } from "./client";
import type { DbReview, ReviewWithAuthor, SubmitReviewInput } from "./types";

/**
 * Fetches all public reviews for a specific product, ordered newest first.
 * Strictly selects public-safe reviewer profile fields (id, full_name, avatar_url).
 */
export async function getProductReviews(productId: string): Promise<ReviewWithAuthor[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      id,
      order_item_id,
      order_id,
      product_id,
      buyer_id,
      rating,
      comment,
      created_at,
      updated_at,
      profiles:profiles (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to fetch product reviews:", error.message);
    throw new Error(error.message || "Could not retrieve reviews for this product.");
  }

  return (data || []) as unknown as ReviewWithAuthor[];
}

/**
 * Fetches the existing review for a specific order item (if any).
 * Used by order item cards to determine whether to render "Write Review" or "Edit Review".
 */
export async function getOrderItemReview(orderItemId: string): Promise<DbReview | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      id,
      order_item_id,
      order_id,
      product_id,
      buyer_id,
      rating,
      comment,
      created_at,
      updated_at
    `)
    .eq("order_item_id", orderItemId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to fetch order item review:", error.message);
    throw new Error(error.message || "Could not check review status for this order item.");
  }

  return (data as DbReview | null) ?? null;
}

/**
 * Fetches all reviews submitted for items belonging to a given order.
 * Allows batch status checking when rendering a buyer's order details.
 */
export async function getOrderReviews(orderId: string): Promise<DbReview[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      id,
      order_item_id,
      order_id,
      product_id,
      buyer_id,
      rating,
      comment,
      created_at,
      updated_at
    `)
    .eq("order_id", orderId);

  if (error) {
    console.warn("Failed to fetch order reviews:", error.message);
    throw new Error(error.message || "Could not retrieve reviews for this order.");
  }

  return (data as DbReview[]) || [];
}

/**
 * Submits or updates a verified product review via the secure submit_product_review RPC.
 * Automatically verifies completed-order eligibility, buyer ownership, and rating bounds.
 *
 * @returns The UUID of the created or updated review.
 */
export async function submitProductReview(input: SubmitReviewInput): Promise<string> {
  const { orderItemId, rating, comment } = input;

  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const cleanComment = comment ? comment.trim() : null;
  if (cleanComment && cleanComment.length > 1000) {
    throw new Error("Review comment must not exceed 1000 characters.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_product_review", {
    p_order_item_id: orderItemId,
    p_rating: rating,
    p_comment: cleanComment,
  });

  if (error) {
    throw new Error(error.message || "Failed to submit product review.");
  }

  return data as string;
}
