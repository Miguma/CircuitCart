import { createClient } from "./client";
import { getCurrentUser } from "./auth";
import {
  DbMessage,
  MessageWithSender,
  ConversationWithDetails,
} from "./types";

/**
 * Formats a message timestamp into date groups ("Today", "Yesterday", "Sep 6")
 */
export function formatMessageDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return "Today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Formats a message timestamp into standard local time ("2:15 PM")
 */
export function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Fetches all conversations where the authenticated user is either the buyer or seller
 */
export async function getConversations(): Promise<ConversationWithDetails[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        *,
        buyer:profiles!conversations_buyer_id_fkey (
          id,
          full_name,
          username,
          avatar_url,
          location,
          role,
          created_at
        ),
        seller:profiles!conversations_seller_id_fkey (
          id,
          full_name,
          username,
          avatar_url,
          location,
          role,
          created_at
        ),
        shops (
          id,
          name,
          slug,
          logo_url,
          location,
          is_verified,
          status
        ),
        products (
          id,
          title,
          price,
          original_price,
          condition,
          stock,
          status,
          category,
          specs,
          location,
          product_images (
            id,
            storage_path,
            sort_order
          )
        ),
        orders (
          id,
          status,
          total,
          subtotal,
          shipping_fee,
          delivery_method,
          created_at
        ),
        messages (
          id,
          sender_id,
          body,
          created_at,
          read_at
        )
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (error || !data) {
      console.warn("Failed to fetch conversations:", error?.message);
      return [];
    }

    return (data as unknown as ConversationWithDetails[]).map((conv) => {
      const messages = (conv.messages || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const unreadCount = messages.filter(
        (m) => m.sender_id !== user.id && !m.read_at
      ).length;

      return {
        ...conv,
        messages,
        unread_count: unreadCount,
      };
    });
  } catch (err) {
    console.warn("Error in getConversations:", err);
    return [];
  }
}

/**
 * Fetches message history for a specific conversation in chronological order
 */
export async function getConversationMessages(
  conversationId: string
): Promise<MessageWithSender[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey (
          id,
          full_name,
          username,
          avatar_url,
          role
        )
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      console.warn("Failed to fetch conversation messages:", error?.message);
      return [];
    }

    return data as unknown as MessageWithSender[];
  } catch (err) {
    console.warn("Error in getConversationMessages:", err);
    return [];
  }
}

/**
 * Derives/creates a conversation for a product
 */
export async function getOrCreateProductConversation(
  productId: string
): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please log in to message the seller.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_product_conversation", {
    p_product_id: productId,
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to start conversation.");
  }

  return data as string;
}

/**
 * Derives/creates a conversation for an order (shared by buyer and seller)
 */
export async function getOrCreateOrderConversation(
  orderId: string
): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please log in to message regarding this order.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_order_conversation", {
    p_order_id: orderId,
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to start order conversation.");
  }

  return data as string;
}

/**
 * Derives/creates a general shop conversation
 */
export async function getOrCreateShopConversation(
  shopId: string
): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please log in to message the seller.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_shop_conversation", {
    p_shop_id: shopId,
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to start shop conversation.");
  }

  return data as string;
}

/**
 * Sends a new message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  body: string
): Promise<DbMessage> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in to send a message.");
  }

  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty.");
  }

  if (trimmed.length > 5000) {
    throw new Error("Message exceeds 5000 character limit.");
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to send message.");
  }

  return data as DbMessage;
}

/**
 * Marks unread incoming messages in a conversation as read
 */
export async function markConversationRead(
  conversationId: string
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) return;

    const supabase = createClient();
    await supabase.rpc("mark_conversation_messages_read", {
      p_conversation_id: conversationId,
    });
  } catch (err) {
    console.warn("Could not mark conversation as read:", err);
  }
}

/**
 * Subscribes to new incoming messages for a conversation via Supabase Realtime
 */
export function subscribeToConversation(
  conversationId: string,
  onMessage: (message: DbMessage) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.new) {
          onMessage(payload.new as DbMessage);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
