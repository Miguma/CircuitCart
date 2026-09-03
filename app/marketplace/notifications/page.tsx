"use client";

import React from "react";
import Link from "next/link";
import {
  Bell,
  ArrowLeft,
  CheckCheck,
  Tag,
  Sparkles,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { toast } from "sonner";

export default function NotificationsPage() {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    unreadNotificationsCount,
  } = useMarketplace();

  const getIcon = (type: string) => {
    switch (type) {
      case "price":
        return <Tag className="size-4 text-[#e59bc9]" />;
      case "welcome":
        return <Sparkles className="size-4 text-pink-300" />;
      case "seller":
        return <ShieldCheck className="size-4 text-emerald-400" />;
      default:
        return <Bell className="size-4 text-[#e59bc9]" />;
    }
  };

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
            {unreadNotificationsCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-[#65486f] text-white rounded-full">
                {unreadNotificationsCount} unread
              </span>
            )}
          </div>
        </div>

        {unreadNotificationsCount > 0 && (
          <button
            type="button"
            onClick={() => {
              markAllNotificationsAsRead();
              toast.success("All notifications marked as read.");
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#342339] hover:bg-[#45304b] text-white border border-white/10 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
          >
            <CheckCheck className="size-3.5 text-[#e59bc9]" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 shadow-sm ${
              notif.read
                ? "bg-[#241c27] border-white/10"
                : "bg-[#2d2232] border-[#e59bc9]/30 shadow-md"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  notif.read
                    ? "bg-[#342339]/60 text-[#b9adb6]"
                    : "bg-[#342339] border border-white/10"
                }`}
              >
                {getIcon(notif.type)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2
                    className={`text-xs sm:text-sm font-bold ${
                      notif.read ? "text-white/90" : "text-white"
                    }`}
                  >
                    {notif.title}
                  </h2>
                  {!notif.read && (
                    <span className="size-2 bg-emerald-400 rounded-full shrink-0" />
                  )}
                </div>

                <p className="text-xs text-[#b9adb6] leading-relaxed">
                  {notif.description}
                </p>

                <span className="text-[10px] text-[#937b8b] block pt-0.5">
                  {notif.date}
                </span>
              </div>
            </div>

            {!notif.read && (
              <button
                type="button"
                aria-label="Mark notification as read"
                onClick={() => {
                  markNotificationAsRead(notif.id);
                  toast.success("Notification marked as read.");
                }}
                className="p-2 text-[#b9adb6] hover:text-[#e59bc9] hover:bg-[#342339] rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                <Check className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
