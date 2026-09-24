import { createClient } from "./client";
import { getCurrentUser } from "./auth";
import type { DbNotification } from "./types";

/**
 * Fetches notifications for the current authenticated user, ordered newest first.
 */
export async function getNotifications(limit = 50): Promise<DbNotification[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Failed to fetch notifications:", error.message);
    throw new Error(error.message || "Failed to fetch notifications.");
  }

  return (data as DbNotification[]) || [];
}

/**
 * Gets the count of unread notifications for the current authenticated user.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const user = await getCurrentUser();
    if (!user) return 0;

    const supabase = createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null);

    if (error) {
      console.warn("Failed to fetch unread notification count:", error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.warn("Error in getUnreadNotificationCount:", err);
    return 0;
  }
}

/**
 * Marks a specific notification as read via the secure mark_notification_read RPC.
 */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in to update notifications.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  if (error) {
    console.warn("Failed to mark notification as read:", error.message);
    throw new Error(error.message || "Failed to mark notification as read.");
  }

  return Boolean(data);
}

/**
 * Marks all unread notifications as read for the current user via mark_all_notifications_read RPC.
 * @returns Number of notifications updated
 */
export async function markAllNotificationsRead(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in to update notifications.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("mark_all_notifications_read");

  if (error) {
    console.warn("Failed to mark all notifications as read:", error.message);
    throw new Error(error.message || "Failed to mark all notifications as read.");
  }

  return (data as number) ?? 0;
}
