"use client";

import React, { useEffect, useState } from "react";
import {
  Store,
  Search,
  Building2,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { getAdminSellers, type SellerWithShop } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import Link from "next/link";

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<SellerWithShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminSellers();
      setSellers(data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load sellers";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await getAdminSellers();
        if (isMounted) {
          setSellers(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : "Failed to load sellers";
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

  const filteredSellers = sellers.filter((s) => {
    const term = searchTerm.toLowerCase();
    const nameMatch =
      (s.full_name && s.full_name.toLowerCase().includes(term)) ||
      (s.username && s.username.toLowerCase().includes(term)) ||
      s.id.toLowerCase().includes(term);
    const shopMatch = s.shops?.some(
      (shop) =>
        shop.name.toLowerCase().includes(term) ||
        (shop.description && shop.description.toLowerCase().includes(term))
    );
    return nameMatch || shopMatch;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Seller Management"
        subtitle="Manage approved merchant accounts and storefronts."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#342339] hover:bg-[#45304b] border border-white/10 text-xs font-semibold text-[#fffafa] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 text-[#e59bc9] ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/admin/verifications"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65486f] hover:bg-[#7a5885] text-white text-xs font-bold transition-colors"
            >
              <span>Review Applications</span>
            </Link>
          </div>
        }
      />

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-[#342339]/40 p-4 rounded-2xl border border-white/10">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 text-[#8f7d8c] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sellers or shop names..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
          />
        </div>
        <div className="text-xs text-[#b9adb6] font-semibold">
          Total Sellers: <span className="text-white">{sellers.length}</span>
        </div>
      </div>

      {/* Sellers List */}
      <div className="rounded-2xl bg-[#342339]/30 border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#b9adb6]">
            <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
            <p className="text-xs">Loading verified sellers...</p>
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
        ) : filteredSellers.length === 0 ? (
          <div className="p-12">
            <AdminEmptyState
              icon={Store}
              title="No Sellers Found"
              description="No seller accounts match your search criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1e1322] border-b border-white/10 text-[#8f7d8c] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">Seller</th>
                  <th className="p-4">Associated Shop</th>
                  <th className="p-4">Verification Status</th>
                  <th className="p-4">Approved Since</th>
                  <th className="p-4">Storefront Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#fffafa]">
                {filteredSellers.map((seller) => {
                  const shop = seller.shops?.[0];

                  return (
                    <tr
                      key={seller.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-[#65486f] border border-[#e59bc9]/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {(seller.full_name || seller.username || "S")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#fffafa] truncate">
                              {seller.full_name || "Unnamed Seller"}
                            </p>
                            <p className="text-[11px] text-[#8f7d8c] truncate">
                              @{seller.username || seller.id.substring(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        {shop ? (
                          <div className="space-y-0.5">
                            <p className="font-bold text-[#fffafa] flex items-center gap-1.5">
                              <Building2 className="size-3.5 text-[#e59bc9]" />
                              <span>{shop.name}</span>
                            </p>
                            <p className="text-[10px] text-[#8f7d8c] truncate max-w-xs">
                              {shop.description || "No description provided"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#8f7d8c] italic">
                            No shop profile setup yet
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/20">
                          <CheckCircle2 className="size-3 text-emerald-400" />
                          Verified Seller
                        </span>
                      </td>

                      <td className="p-4 text-[#b9adb6]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3 text-[#8f7d8c]" />
                          <span>
                            {seller.created_at
                              ? new Date(seller.created_at).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-[#fffafa] border border-white/10">
                          Active Store
                        </span>
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
