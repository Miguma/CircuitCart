"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  Search,
  Calendar,
  Loader2,
} from "lucide-react";
import { getAdminShops, type ShopWithOwner } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";

export default function AdminShopsPage() {
  const [shops, setShops] = useState<ShopWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await getAdminShops();
        if (isMounted) {
          setShops(data);
        }
      } catch (err) {
        console.error("Failed to load shops:", err);
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

  const filteredShops = shops.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.description && s.description.toLowerCase().includes(term)) ||
      (s.profiles?.full_name &&
        s.profiles.full_name.toLowerCase().includes(term)) ||
      (s.profiles?.username &&
        s.profiles.username.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Shops Directory"
        subtitle="Review registered storefronts, seller associations, and shop profiles."
      />

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-[#342339]/40 p-4 rounded-2xl border border-white/10">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 text-[#8f7d8c] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search shops by name, owner, or description..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
          />
        </div>
        <div className="text-xs text-[#b9adb6] font-semibold">
          Total Storefronts: <span className="text-white">{shops.length}</span>
        </div>
      </div>

      {/* Shops Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#b9adb6]">
          <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
          <p className="text-xs">Loading shops...</p>
        </div>
      ) : filteredShops.length === 0 ? (
        <AdminEmptyState
          icon={Building2}
          title="No Shops Found"
          description="No merchant shops match your search criteria."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredShops.map((shop) => (
            <div
              key={shop.id}
              className="p-5 rounded-2xl bg-[#342339]/40 border border-white/10 space-y-4 hover:border-white/20 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-[#65486f] border border-[#e59bc9]/30 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {shop.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#fffafa] line-clamp-1">
                        {shop.name}
                      </h3>
                      <p className="text-[11px] text-[#8f7d8c]">
                        Owner: {shop.profiles?.full_name || shop.profiles?.username || "Unknown"}
                      </p>
                    </div>
                  </div>
                  <AdminStatusBadge
                    type="shop"
                    status={shop.is_verified ? "verified" : "unverified"}
                  />
                </div>

                <p className="text-xs text-[#b9adb6] line-clamp-2 leading-relaxed">
                  {shop.description || "No shop description provided."}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-[#8f7d8c]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3 text-[#8f7d8c]" />
                  <span>
                    {shop.created_at
                      ? new Date(shop.created_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>

                <span className="font-mono text-[10px] text-[#b9adb6]">
                  ID: {shop.id.substring(0, 8)}...
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
