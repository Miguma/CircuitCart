"use client";

import React, { useEffect, useState } from "react";
import {
  Package,
  Search,
  Tag,
  Loader2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { getAdminProducts } from "@/lib/supabase/admin";
import { getProductImageUrl } from "@/lib/supabase/storage";
import type { ProductWithRelations, DbProductStatus } from "@/lib/supabase/types";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import Link from "next/link";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | DbProductStatus
  >("all");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminProducts();
      setProducts(data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load products";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await getAdminProducts();
        if (isMounted) {
          setProducts(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : "Failed to load products";
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

  const filteredProducts = products.filter((p) => {
    const matchesStatus =
      statusFilter === "all" || p.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.title.toLowerCase().includes(term) ||
      (p.category && p.category.toLowerCase().includes(term)) ||
      (p.profiles?.full_name &&
        p.profiles.full_name.toLowerCase().includes(term)) ||
      (p.shops?.name && p.shops.name.toLowerCase().includes(term));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Product Catalog"
        subtitle="Review marketplace product listings, pricing, and availability."
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#342339]/40 p-4 rounded-2xl border border-white/10">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 text-[#8f7d8c] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, category, or seller..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-black/30 p-1 rounded-xl border border-white/5">
          {(["all", "active", "draft", "sold_out", "archived"] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  statusFilter === status
                    ? "bg-[#65486f] text-white shadow-xs"
                    : "text-[#b9adb6] hover:text-white"
                }`}
              >
                {status.replace("_", " ")}{" "}
                <span className="text-[10px] opacity-70">
                  (
                  {status === "all"
                    ? products.length
                    : products.filter((p) => p.status === status).length}
                  )
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl bg-[#342339]/30 border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#b9adb6]">
            <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
            <p className="text-xs">Loading product catalog...</p>
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
        ) : filteredProducts.length === 0 ? (
          <div className="p-12">
            <AdminEmptyState
              icon={Package}
              title="No Products Found"
              description="No marketplace listings match your filter parameters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1e1322] border-b border-white/10 text-[#8f7d8c] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">Item</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Seller & Shop</th>
                  <th className="p-4">Condition</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#fffafa]">
                {filteredProducts.map((prod) => {
                  const primaryImage = prod.product_images?.[0]?.storage_path
                    ? getProductImageUrl(prod.product_images[0].storage_path)
                    : null;

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="size-11 rounded-lg bg-black/40 border border-white/10 overflow-hidden relative flex items-center justify-center shrink-0">
                            {primaryImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={primaryImage}
                                alt={prod.title}
                                className="w-full h-full object-contain p-0.5"
                              />
                            ) : (
                              <Package className="size-5 text-[#8f7d8c]" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-[#fffafa] truncate">
                              {prod.title}
                            </p>
                            <p className="text-[10px] text-[#8f7d8c] font-mono truncate">
                              ID: {prod.id.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b9adb6] bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/5">
                          <Tag className="size-3 text-[#e59bc9]" />
                          <span>{prod.category || "General"}</span>
                        </span>
                      </td>

                      <td className="p-4 font-extrabold text-[#e59bc9]">
                        ₱{Number(prod.price).toLocaleString()}
                      </td>

                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-[#fffafa] truncate max-w-[150px]">
                            {prod.profiles?.full_name ||
                              prod.profiles?.username ||
                              "Seller"}
                          </p>
                          {prod.shops?.name && (
                            <p className="text-[10px] text-[#8f7d8c] truncate max-w-[150px]">
                              {prod.shops.name}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="text-[11px] text-[#b9adb6] capitalize">
                          {prod.condition || "used"}
                        </span>
                      </td>

                      <td className="p-4">
                        <AdminStatusBadge type="product" status={prod.status} />
                      </td>

                      <td className="p-4 text-right">
                        <Link
                          href={`/marketplace/product/${prod.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#e59bc9] hover:underline"
                        >
                          <span>Marketplace</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
