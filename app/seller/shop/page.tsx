"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  ShieldCheck,
  MapPin,
  Star,
  CheckCircle2,
  ExternalLink,
  Edit2,
  Phone,
  Mail,
  Award,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import { DEMO_SELLER_STATS } from "@/lib/seller/seller-data";
import { toast } from "sonner";

export default function SellerShopPage() {
  const [shopBio, setShopBio] = useState(
    "Verified hardware vendor specializing in laptops, GPU upgrades, and high-end mechanical keyboards. Pickups available at Cebu IT Park, Lahug."
  );

  return (
    <SellerLayout
      title="Shop Profile"
      subtitle="Customize how your shop and verified badge appear to buyers."
      showAddProduct={true}
    >
      <div className="max-w-4xl space-y-6">
        {/* Shop Card */}
        <div className="bg-[#1e1322]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
          {/* Header Cover Banner */}
          <div className="h-32 bg-gradient-to-r from-[#432c45] via-[#281729] to-[#684d72] relative p-6 flex items-end">
            <div className="absolute top-4 right-4">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white transition-colors"
              >
                <span>View Buyer View</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>

          <div className="p-6 sm:p-8 relative space-y-6">
            {/* Avatar & Title Info */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20">
              <div className="flex items-end gap-4">
                <div className="size-20 sm:size-24 rounded-2xl bg-[#3d2743] border-4 border-[#1e1322] flex items-center justify-center text-[#e59bc9] font-black text-2xl sm:text-3xl shadow-2xl shrink-0">
                  {DEMO_SELLER_STATS.shopName.charAt(0)}
                </div>
                <div className="mb-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#fffafa]">
                      {DEMO_SELLER_STATS.shopName}
                    </h2>
                    {DEMO_SELLER_STATS.isVerified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                        <ShieldCheck className="size-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#e59bc9] font-semibold mt-0.5">
                    {DEMO_SELLER_STATS.shopHandle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toast.success("Shop profile changes saved.")}
                className="px-4 py-2 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer"
              >
                Save Profile
              </button>
            </div>

            {/* Location & Stats row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#b9adb6] pt-2 border-t border-white/[0.08]">
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-[#e59bc9]" />
                <span>{DEMO_SELLER_STATS.location}</span>
              </div>
              <span>&bull;</span>
              <div className="flex items-center gap-1.5">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="text-white font-bold">
                  {DEMO_SELLER_STATS.sellerRating}
                </span>
                <span>({DEMO_SELLER_STATS.reviewCount} reviews)</span>
              </div>
              <span>&bull;</span>
              <div className="flex items-center gap-1.5">
                <Award className="size-3.5 text-emerald-400" />
                <span>{DEMO_SELLER_STATS.completedOrdersCount} orders fulfilled</span>
              </div>
            </div>

            {/* Bio Editor */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#fffafa] uppercase tracking-wider block">
                Shop Bio & Policies
              </label>
              <textarea
                rows={3}
                value={shopBio}
                onChange={(e) => setShopBio(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
