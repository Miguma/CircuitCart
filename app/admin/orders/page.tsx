"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Search,
  Calendar,
  Truck,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { getAdminOrders } from "@/lib/supabase/admin";
import type { DbOrder, DbOrderStatus } from "@/lib/supabase/types";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DbOrderStatus>("all");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminOrders();
      setOrders(data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load orders";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await getAdminOrders();
        if (isMounted) {
          setOrders(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : "Failed to load orders";
          setError(errorMsg);
        }
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

  const filteredOrders = orders.filter((o) => {
    const matchesStatus =
      statusFilter === "all" || o.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      o.id.toLowerCase().includes(term) ||
      o.buyer_id.toLowerCase().includes(term) ||
      (o.seller_id && o.seller_id.toLowerCase().includes(term)) ||
      (o.shipping_address && o.shipping_address.toLowerCase().includes(term));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Order Management"
        subtitle="Review marketplace transactions and fulfillment status."
        actions={
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#342339] hover:bg-[#45304b] border border-white/10 text-xs font-semibold text-[#fffafa] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 text-[#e59bc9] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#342339]/40 p-4 rounded-2xl border border-white/10">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 text-[#8f7d8c] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by order ID, buyer, or address..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-black/30 p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full">
          {(["all", "pending", "confirmed", "preparing", "ready", "shipped", "completed", "cancelled"] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? "bg-[#65486f] text-white shadow-xs"
                    : "text-[#b9adb6] hover:text-white"
                }`}
              >
                {status}{" "}
                <span className="text-[10px] opacity-70">
                  (
                  {status === "all"
                    ? orders.length
                    : orders.filter((o) => o.status === status).length}
                  )
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl bg-[#342339]/30 border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#b9adb6]">
            <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
            <p className="text-xs">Loading orders...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="size-10 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-rose-200">Database / Authorization Error</h3>
            <p className="text-xs text-[#b9adb6] max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#65486f] text-white text-xs font-semibold"
            >
              <RefreshCw className="size-3" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12">
            <AdminEmptyState
              icon={ShoppingBag}
              title="No Orders Found"
              description="No marketplace transactions match your current search or status filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1e1322] border-b border-white/10 text-[#8f7d8c] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Buyer ID</th>
                  <th className="p-4">Seller ID</th>
                  <th className="p-4">Total Amount</th>
                  <th className="p-4">Delivery Method</th>
                  <th className="p-4">Date Placed</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#fffafa]">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="p-4 font-mono font-bold text-[#fffafa]">
                      #{order.id.substring(0, 8)}
                    </td>

                    <td className="p-4 font-mono text-[11px] text-[#b9adb6]">
                      {order.buyer_id.substring(0, 8)}...
                    </td>

                    <td className="p-4 font-mono text-[11px] text-[#b9adb6]">
                      {order.seller_id
                        ? `${order.seller_id.substring(0, 8)}...`
                        : "—"}
                    </td>

                    <td className="p-4 font-extrabold text-[#e59bc9]">
                      ₱{Number(order.total).toLocaleString()}
                    </td>

                    <td className="p-4 text-[#b9adb6]">
                      <div className="flex items-center gap-1.5 capitalize">
                        <Truck className="size-3 text-[#8f7d8c]" />
                        <span>{order.delivery_method || "Delivery"}</span>
                      </div>
                    </td>

                    <td className="p-4 text-[#b9adb6]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 text-[#8f7d8c]" />
                        <span>
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <AdminStatusBadge type="order" status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
