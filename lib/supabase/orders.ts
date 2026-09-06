import { createClient } from "./client";
import { getCurrentUser } from "./auth";
import {
  DbDeliveryMethod,
  DbOrderStatus,
  OrderWithItems,
} from "./types";
import { SellerOrder, OrderStatus, FulfillmentMethod } from "@/lib/seller/seller-data";
import { getProductImageUrl } from "./storage";

export interface CheckoutInput {
  deliveryMethod: DbDeliveryMethod;
  shippingName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  buyerNote?: string;
}

/**
 * Derives a human-readable order reference code from an order UUID
 */
export function formatOrderReference(orderId: string): string {
  if (!orderId) return "CC-00000000";
  const clean = orderId.replace(/-/g, "").toUpperCase();
  return `CC-${clean.slice(0, 8)}`;
}

/**
 * Maps database order status to seller frontend status label
 */
export function mapDbStatusToSellerStatus(status: DbOrderStatus, deliveryMethod: DbDeliveryMethod): OrderStatus {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "preparing":
      return "Packed";
    case "ready":
      return deliveryMethod === "meetup" ? "Ready for Meetup" : "Packed";
    case "shipped":
      return "Shipped";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

/**
 * Maps seller UI status label back to database order status
 */
export function mapSellerStatusToDbStatus(status: OrderStatus): DbOrderStatus {
  switch (status) {
    case "Pending":
      return "pending";
    case "Confirmed":
      return "confirmed";
    case "Packed":
      return "preparing";
    case "Ready for Meetup":
      return "ready";
    case "Shipped":
      return "shipped";
    case "Delivered":
    case "Completed":
      return "completed";
    case "Cancelled":
    case "Refund Requested":
    case "Refunded":
      return "cancelled";
    default:
      return "pending";
  }
}

/**
 * Executes secure, atomic checkout via PostgreSQL RPC function
 */
export async function checkoutCart(input: CheckoutInput): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in to complete checkout.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("checkout_cart", {
    p_delivery_method: input.deliveryMethod,
    p_shipping_name: input.shippingName?.trim() || null,
    p_shipping_phone: input.shippingPhone?.trim() || null,
    p_shipping_address: input.shippingAddress?.trim() || null,
    p_buyer_note: input.buyerNote?.trim() || null,
  });

  if (error) {
    throw new Error(error.message || "Failed to process checkout.");
  }

  const orderRows = data as { order_id: string }[];
  return orderRows.map((r) => r.order_id);
}

/**
 * Fetches all orders placed by the current authenticated buyer
 */
export async function getBuyerOrders(): Promise<OrderWithItems[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        shops (
          id,
          name,
          slug,
          logo_url,
          banner_url,
          location,
          is_verified
        ),
        seller:profiles!orders_seller_id_fkey (
          id,
          full_name,
          avatar_url
        ),
        order_items (
          id,
          order_id,
          product_id,
          product_title,
          product_image_path,
          unit_price,
          quantity,
          line_total,
          created_at
        )
      `)
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.warn("Failed to load buyer orders:", error?.message);
      return [];
    }

    return data as OrderWithItems[];
  } catch (err) {
    console.warn("Error in getBuyerOrders:", err);
    return [];
  }
}

/**
 * Fetches all orders received by the current authenticated seller
 */
export async function getSellerOrders(): Promise<SellerOrder[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        shops (
          id,
          name,
          slug,
          location
        ),
        buyer:profiles!orders_buyer_id_fkey (
          id,
          full_name,
          username,
          avatar_url,
          location,
          created_at
        ),
        order_items (
          id,
          order_id,
          product_id,
          product_title,
          product_image_path,
          unit_price,
          quantity,
          line_total,
          created_at
        )
      `)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.warn("Failed to load seller orders:", error?.message);
      return [];
    }

    return (data as unknown as OrderWithItems[]).map((raw) => {
      const fulfillmentMethod: FulfillmentMethod =
        raw.delivery_method === "meetup" ? "Meetup" : "Delivery";

      const buyerName = raw.buyer?.full_name || "Verified Buyer";
      const buyerLocation = raw.buyer?.location || raw.shipping_address || "Cebu City";
      const memberSince = raw.buyer?.created_at
        ? new Date(raw.buyer.created_at).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })
        : "Aug 2026";

      const items = (raw.order_items || []).map((it) => ({
        id: it.id,
        productId: it.product_id || it.id,
        name: it.product_title,
        image: it.product_image_path
          ? getProductImageUrl(it.product_image_path)
          : "/images/macbook-air.png",
        condition: "Good" as const,
        quantity: it.quantity,
        unitPrice: Number(it.unit_price),
        totalPrice: Number(it.line_total),
        specs: "",
      }));

      const dateStr = new Date(raw.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return {
        id: raw.id,
        orderNumber: formatOrderReference(raw.id),
        buyer: {
          name: buyerName,
          avatar: raw.buyer?.avatar_url || undefined,
          rating: 5.0,
          reviewCount: 0,
          memberSince,
          phone: raw.shipping_phone || undefined,
          location: buyerLocation,
        },
        items,
        subtotal: Number(raw.subtotal),
        shippingFee: Number(raw.shipping_fee),
        total: Number(raw.total),
        fulfillmentMethod,
        deliveryDetails:
          raw.delivery_method === "delivery"
            ? {
                recipient: raw.shipping_name || buyerName,
                phone: raw.shipping_phone || "+63 900 000 0000",
                address: raw.shipping_address || "Cebu City, Central Visayas",
                courier: "J&T Express / Lalamove",
                estimatedDelivery: "1-2 Business Days",
              }
            : undefined,
        meetupDetails:
          raw.delivery_method === "meetup"
            ? {
                location: raw.shipping_address || raw.shops?.location || "Cebu IT Park, Lahug",
                preferredDate: dateStr,
                preferredTime: "2:00 PM - 5:00 PM",
                buyerNotes: raw.buyer_note || undefined,
              }
            : undefined,
        paymentMethod: "Cash on Delivery / Meetup",
        paymentStatus: raw.status === "completed" ? "Paid" : "Pending",
        status: mapDbStatusToSellerStatus(raw.status, raw.delivery_method),
        placedAt: dateStr,
      };
    });
  } catch (err) {
    console.warn("Error in getSellerOrders:", err);
    return [];
  }
}

/**
 * Cancels an order and transactionally restores product inventory
 */
export async function cancelBuyerOrder(orderId: string, reason?: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in to cancel an order.");
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: reason?.trim() || null,
  });

  if (error) {
    throw new Error(error.message || "Failed to cancel order.");
  }
}

/**
 * Updates a seller's order status with server-side validation
 */
export async function updateSellerOrderStatus(
  orderId: string,
  newStatus: DbOrderStatus
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in as a seller to update orders.");
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("update_seller_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
  });

  if (error) {
    throw new Error(error.message || "Failed to update order status.");
  }
}
