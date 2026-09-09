"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Store,
  Package,
  ShoppingBag,
  ShieldCheck,
  Building2,
  ArrowRight,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  getAdminDashboardStats,
  getAdminUsers,
  getAdminProducts,
  type AdminDashboardStats,
} from "@/lib/supabase/admin";
import { getPendingVerificationRequests } from "@/lib/supabase/verification";
import { getProductImageUrl } from "@/lib/supabase/storage";
import type {
  DbProfile,
  ProductWithRelations,
  SellerVerificationWithProfile,
} from "@/lib/supabase/types";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { toast } from "sonner";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalUsers: null,
    totalSellers: null,
    totalProducts: null,
    totalShops: null,
    pendingVerifications: null,
    totalOrders: null,
  });
  const [recentVerifications, setRecentVerifications] = useState<
    SellerVerificationWithProfile[]
  >([]);
  const [recentUsers, setRecentUsers] = useState<DbProfile[]>([]);
  const [recentProducts, setRecentProducts] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationsError, setVerificationsError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setVerificationsError(null);
    setUsersError(null);
    setProductsError(null);

    const [statsResult, verificationsResult, usersResult, productsResult] =
      await Promise.allSettled([
        getAdminDashboardStats(),
        getPendingVerificationRequests(),
        getAdminUsers(),
        getAdminProducts(),
      ]);

    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value);
    }

    if (verificationsResult.status === "fulfilled") {
      setRecentVerifications(verificationsResult.value.slice(0, 5));
    } else {
      setVerificationsError(verificationsResult.reason?.message || "Failed to load verification queue");
    }

    if (usersResult.status === "fulfilled") {
      setRecentUsers(usersResult.value.slice(0, 5));
    } else {
      setUsersError(usersResult.reason?.message || "Failed to load user directory");
    }

    if (productsResult.status === "fulfilled") {
      setRecentProducts(productsResult.value.slice(0, 5));
    } else {
      setProductsError(productsResult.reason?.message || "Failed to load marketplace products");
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        await fetchDashboardData();
      } catch (err) {
        console.error("Failed to load admin dashboard:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchDashboardData();
      toast.success("Dashboard metrics updated");
    } catch (err) {
      console.error("Failed to refresh dashboard:", err);
      toast.error("Failed to refresh admin metrics");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Admin Overview"
        subtitle="Live platform metrics and real-time operations status."
        actions={
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#342339] hover:bg-[#45304b] border border-white/10 text-xs font-semibold text-[#fffafa] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 text-[#e59bc9] ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            <span>Refresh</span>
          </button>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <AdminStatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={Users}
          loading={loading}
          href="/admin/users"
        />
        <AdminStatCard
          label="Verified Sellers"
          value={stats.totalSellers}
          icon={Store}
          loading={loading}
          href="/admin/sellers"
        />
        <AdminStatCard
          label="Active Shops"
          value={stats.totalShops}
          icon={Building2}
          loading={loading}
          href="/admin/shops"
        />
        <AdminStatCard
          label="Listings"
          value={stats.totalProducts}
          icon={Package}
          loading={loading}
          href="/admin/products"
        />
        <AdminStatCard
          label="Orders"
          value={stats.totalOrders}
          icon={ShoppingBag}
          loading={loading}
          href="/admin/orders"
        />
        <AdminStatCard
          label="Pending Queue"
          value={stats.pendingVerifications}
          icon={ShieldCheck}
          loading={loading}
          href="/admin/verifications"
        />
      </div>

      {/* Main Grid: Pending Verifications & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verification Queue (2 columns wide on large) */}
        <div className="lg:col-span-2 rounded-2xl bg-[#342339]/40 border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-5 text-[#e59bc9]" />
              <h2 className="text-base font-bold text-[#fffafa]">
                Pending Seller Applications
              </h2>
            </div>
            <Link
              href="/admin/verifications"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#e59bc9] hover:underline"
            >
              <span>View All</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center text-xs text-[#b9adb6]">
              Loading verification queue...
            </div>
          ) : verificationsError ? (
            <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-500/20 text-center space-y-2">
              <AlertTriangle className="size-6 text-rose-400 mx-auto" />
              <p className="text-xs font-semibold text-rose-200">{verificationsError}</p>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="text-[11px] font-bold text-[#e59bc9] hover:underline"
              >
                Retry
              </button>
            </div>
          ) : recentVerifications.length === 0 ? (
            <AdminEmptyState
              icon={CheckCircle2}
              title="Queue is Clear"
              description="There are currently no pending seller verification applications requiring manual review."
            />
          ) : (
            <div className="divide-y divide-white/5">
              {recentVerifications.map((item) => (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#fffafa]">
                        {item.full_name}
                      </span>
                      <AdminStatusBadge
                        type="verification"
                        status={item.status}
                      />
                      {item.automated_score !== null &&
                        item.automated_score !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[#b9adb6] font-mono">
                            AI: {item.automated_score}/100
                          </span>
                        )}
                    </div>
                    <p className="text-[11px] text-[#b9adb6]">
                      {item.seller_type} seller · ID: {item.id_type} ·{" "}
                      <span className="text-[#8f7d8c]">
                        Submitted {new Date(item.submitted_at).toLocaleDateString()}
                      </span>
                    </p>
                  </div>

                  <Link
                    href={`/admin/verifications?id=${item.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#65486f] border border-white/10 text-xs font-medium text-[#fffafa] transition-colors shrink-0 self-start sm:self-auto"
                  >
                    <Eye className="size-3.5 text-[#e59bc9]" />
                    <span>Review</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Registered Users */}
        <div className="rounded-2xl bg-[#342339]/40 border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users className="size-5 text-[#e59bc9]" />
              <h2 className="text-base font-bold text-[#fffafa]">
                Recent Users
              </h2>
            </div>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#e59bc9] hover:underline"
            >
              <span>View All</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center text-xs text-[#b9adb6]">
              Loading users...
            </div>
          ) : usersError ? (
            <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-500/20 text-center space-y-2">
              <AlertTriangle className="size-6 text-rose-400 mx-auto" />
              <p className="text-xs font-semibold text-rose-200">{usersError}</p>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="text-[11px] font-bold text-[#e59bc9] hover:underline"
              >
                Retry
              </button>
            </div>
          ) : recentUsers.length === 0 ? (
            <AdminEmptyState
              title="No Users"
              description="No registered user records found."
            />
          ) : (
            <div className="divide-y divide-white/5">
              {recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#fffafa] truncate">
                      {user.full_name || user.username || "Anonymous"}
                    </p>
                    <p className="text-[11px] text-[#8f7d8c] truncate">
                      {user.id.substring(0, 8)}... · Joined{" "}
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <AdminStatusBadge type="role" status={user.role} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Marketplace Listings */}
      <div className="rounded-2xl bg-[#342339]/40 border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package className="size-5 text-[#e59bc9]" />
            <h2 className="text-base font-bold text-[#fffafa]">
              Recent Marketplace Products
            </h2>
          </div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#e59bc9] hover:underline"
          >
            <span>View All</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center text-xs text-[#b9adb6]">
            Loading marketplace products...
          </div>
        ) : productsError ? (
          <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-500/20 text-center space-y-2">
            <AlertTriangle className="size-6 text-rose-400 mx-auto" />
            <p className="text-xs font-semibold text-rose-200">{productsError}</p>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="text-[11px] font-bold text-[#e59bc9] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : recentProducts.length === 0 ? (
          <AdminEmptyState
            title="No Products"
            description="No marketplace products have been listed yet."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {recentProducts.map((prod) => {
              const primaryImage = prod.product_images?.[0]?.storage_path
                ? getProductImageUrl(prod.product_images[0].storage_path)
                : null;

              return (
                <div
                  key={prod.id}
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 hover:border-white/10 transition-colors"
                >
                  <div className="aspect-video w-full rounded-lg bg-black/40 overflow-hidden relative flex items-center justify-center border border-white/5">
                    {primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryImage}
                        alt={prod.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="size-6 text-[#8f7d8c]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#fffafa] truncate">
                      {prod.title}
                    </h3>
                    <p className="text-xs font-extrabold text-[#e59bc9]">
                      ₱{Number(prod.price).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[#8f7d8c] truncate">
                      Seller:{" "}
                      {prod.profiles?.full_name ||
                        prod.profiles?.username ||
                        "Unknown"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
