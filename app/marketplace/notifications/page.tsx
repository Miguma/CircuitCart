"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ArrowLeft,
  CheckCheck,
  Check,
  PackageCheck,
  PackagePlus,
  Truck,
  XCircle,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Inbox,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/supabase/notifications";
import type { DbNotification, NotificationType } from "@/lib/supabase/types";
import { toast } from "sonner";

function formatNotificationDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateStr;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const { userId, isLoading: isAccountLoading } = useMarketplaceAccount();
  const { setUnreadNotificationsCount, refreshUnreadNotificationsCount } =
    useMarketplace();

  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  useEffect(() => {
    if (!isAccountLoading && !userId) {
      router.replace("/login?redirectTo=/marketplace/notifications");
    }
  }, [isAccountLoading, userId, router]);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    getNotifications(50)
      .then((data) => {
        if (!active) return;
        setNotifications(data);
        const unread = data.filter((n) => n.read_at === null).length;
        setUnreadNotificationsCount?.(unread);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn("Could not load notifications:", err);
        if (!active) return;
        setIsError(true);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, setUnreadNotificationsCount]);

  const reloadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const data = await getNotifications(50);
      setNotifications(data);
      const unread = data.filter((n) => n.read_at === null).length;
      setUnreadNotificationsCount?.(unread);
    } catch (err) {
      console.warn("Could not load notifications:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [setUnreadNotificationsCount]);

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  const getIcon = (type: NotificationType | string) => {
    switch (type) {
      case "order_new":
        return <PackagePlus className="size-4 text-[#e59bc9]" />;
      case "order_status":
        return <Truck className="size-4 text-[#b78bd7]" />;
      case "order_completed":
        return <PackageCheck className="size-4 text-emerald-400" />;
      case "order_cancelled":
        return <XCircle className="size-4 text-rose-400" />;
      case "message":
        return <MessageSquare className="size-4 text-[#e59bc9]" />;
      case "verification_approved":
        return <ShieldCheck className="size-4 text-emerald-400" />;
      case "verification_rejected":
        return <ShieldAlert className="size-4 text-rose-400" />;
      default:
        return <Bell className="size-4 text-[#e59bc9]" />;
    }
  };

  const handleNotificationClick = async (notif: DbNotification) => {
    if (notif.read_at === null) {
      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: nowIso } : n))
      );
      setUnreadNotificationsCount?.((prev) => Math.max(0, prev - 1));

      try {
        await markNotificationRead(notif.id);
        refreshUnreadNotificationsCount?.();
      } catch (err) {
        console.warn("Failed to mark notification as read in background:", err);
      }
    }

    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkSingleRead = async (
    e: React.MouseEvent,
    notifId: string
  ) => {
    e.stopPropagation();
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read_at: nowIso } : n))
    );
    setUnreadNotificationsCount?.((prev) => Math.max(0, prev - 1));
    toast.success("Notification marked as read.");

    try {
      await markNotificationRead(notifId);
      refreshUnreadNotificationsCount?.();
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
      toast.error("Failed to mark notification as read.");
      reloadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    if (isMarkingAll || unreadCount === 0) return;
    setIsMarkingAll(true);

    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at === null ? { ...n, read_at: nowIso } : n))
    );
    setUnreadNotificationsCount?.(0);

    try {
      await markAllNotificationsRead();
      refreshUnreadNotificationsCount?.();
      toast.success("All notifications marked as read.");
    } catch (err) {
      console.warn("Failed to mark all notifications as read:", err);
      toast.error("Failed to mark all notifications as read.");
      reloadNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  };

  if (isAccountLoading || !userId) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
        <p className="text-sm text-[#b9adb6]">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#b9adb6] mb-1">
            <Link
              href="/marketplace"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Notifications
            </h1>
            {!isLoading && unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-[#65486f] text-white rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        {!isLoading && unreadCount > 0 && (
          <button
            type="button"
            disabled={isMarkingAll}
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#342339] hover:bg-[#45304b] disabled:opacity-50 text-white border border-white/10 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
          >
            {isMarkingAll ? (
              <Loader2 className="size-3.5 text-[#e59bc9] animate-spin" />
            ) : (
              <CheckCheck className="size-3.5 text-[#e59bc9]" />
            )}
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-[#241c27] flex items-start gap-4 animate-pulse"
            >
              <div className="size-9 rounded-xl bg-[#342339] shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-[#342339] rounded-md w-1/3" />
                <div className="h-3 bg-[#342339] rounded-md w-3/4" />
                <div className="h-2.5 bg-[#342339] rounded-md w-1/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <div className="p-8 sm:p-12 rounded-2xl border border-white/10 bg-[#241c27] text-center space-y-3 shadow-sm">
          <Bell className="size-10 text-[#b9adb6] mx-auto opacity-40" />
          <h3 className="text-base font-semibold text-white">
            Notifications are temporarily unavailable.
          </h3>
          <p className="text-xs text-[#b9adb6] max-w-sm mx-auto">
            We could not load your notifications right now. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reloadNotifications}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#342339] hover:bg-[#45304b] text-white border border-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5 text-[#e59bc9]" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && notifications.length === 0 && (
        <div className="p-12 rounded-2xl border border-white/10 bg-[#241c27] text-center space-y-3 shadow-sm">
          <div className="size-12 rounded-2xl bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#b9adb6]">
            <Inbox className="size-6 text-[#e59bc9]" />
          </div>
          <h3 className="text-base font-bold text-white">No notifications yet.</h3>
          <p className="text-xs text-[#b9adb6] max-w-md mx-auto leading-relaxed">
            You are all caught up! Updates regarding your orders, seller applications, and customer messages will appear here.
          </p>
        </div>
      )}

      {/* Notifications List */}
      {!isLoading && !isError && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const isUnread = notif.read_at === null;

            return (
              <div
                key={notif.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(notif)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNotificationClick(notif);
                  }
                }}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 shadow-sm cursor-pointer hover:border-[#e59bc9]/50 ${
                  isUnread
                    ? "bg-[#2d2232] border-[#e59bc9]/30 shadow-md"
                    : "bg-[#241c27] border-white/10"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isUnread
                        ? "bg-[#342339] border border-white/10"
                        : "bg-[#342339]/60 text-[#b9adb6]"
                    }`}
                  >
                    {getIcon(notif.type)}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2
                        className={`text-xs sm:text-sm font-bold truncate ${
                          isUnread ? "text-white" : "text-white/90"
                        }`}
                      >
                        {notif.title}
                      </h2>
                      {isUnread && (
                        <span className="size-2 bg-emerald-400 rounded-full shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-[#b9adb6] leading-relaxed break-words">
                      {notif.message}
                    </p>

                    <span className="text-[10px] text-[#937b8b] block pt-0.5">
                      {formatNotificationDate(notif.created_at)}
                    </span>
                  </div>
                </div>

                {isUnread && (
                  <button
                    type="button"
                    aria-label="Mark notification as read"
                    onClick={(e) => handleMarkSingleRead(e, notif.id)}
                    className="p-2 text-[#b9adb6] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors shrink-0 cursor-pointer"
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
