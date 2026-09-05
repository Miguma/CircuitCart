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
  Upload,
  Image as ImageIcon,
  Sparkles,
  Award,
  Clock,
  Truck,
  MessageSquare,
  Globe,
  Settings,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import {
  DEMO_SHOP_PROFILE,
  DEMO_SELLER_STATS,
  DEMO_SELLER_PRODUCTS,
  type SellerShopProfile,
} from "@/lib/seller/seller-data";
import { toast } from "sonner";

export default function SellerShopPage() {
  const [profile, setProfile] = useState<SellerShopProfile>(DEMO_SHOP_PROFILE);
  const [isSaving, setIsSaving] = useState(false);

  const bannerPresets = [
    { id: "plum", label: "Midnight Plum", gradient: "from-[#432c45] via-[#281729] to-[#684d72]" },
    { id: "sunset", label: "Visayas Mauve", gradient: "from-[#65486f] via-[#3d2743] to-[#1c121e]" },
    { id: "cyber", label: "Dark Hardware", gradient: "from-[#281827] via-[#1c121e] to-[#3a203f]" },
  ];
  const [selectedBannerPreset, setSelectedBannerPreset] = useState("plum");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Shop profile and public storefront updated!");
    }, 400);
  };

  return (
    <SellerLayout
      title="Shop Profile"
      subtitle="Manage how your shop appears to buyers on CircuitCart."
      showAddProduct={true}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ======================================================= */}
        {/* LEFT 7 COLUMNS: Editable Shop Information Form          */}
        {/* ======================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSave}
            className="bg-[#1e1322]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl"
          >
            {/* SECTION 1: Identity & Branding */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-[#fffafa] uppercase tracking-wider pb-2 border-b border-white/[0.08] flex items-center gap-2">
                <Store className="size-4 text-[#e59bc9]" />
                <span>Shop Branding & Identity</span>
              </h2>

              {/* Shop Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Shop Name <span className="text-[#e59bc9]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profile.shopName}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        shopName: e.target.value,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/(^-|-$)/g, ""),
                      }))
                    }
                    placeholder="e.g. TechVault Cebu"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Shop URL Slug <span className="text-[#e59bc9]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={profile.slug}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, slug: e.target.value }))
                      }
                      placeholder="techvault-cebu"
                      className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-mono text-[#e59bc9] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-[#b9adb6] mt-1 truncate">
                    circuitcart.com/shop/{profile.slug}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                  Shop Bio / Tagline
                </label>
                <textarea
                  rows={3}
                  value={profile.description}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Describe your shop, what tech you specialize in, and meetup areas..."
                  className="w-full p-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors resize-none"
                />
              </div>

              {/* Banner Presets */}
              <div>
                <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                  Storefront Cover Theme
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {bannerPresets.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBannerPreset(b.id)}
                      className={`h-12 rounded-xl bg-gradient-to-r ${b.gradient} border-2 flex items-center justify-center text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${
                        selectedBannerPreset === b.id
                          ? "border-[#e59bc9] ring-2 ring-[#e59bc9]/30"
                          : "border-white/10 opacity-70 hover:opacity-100"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 2: Location & Contact */}
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-bold text-[#fffafa] uppercase tracking-wider pb-2 border-b border-white/[0.08] flex items-center gap-2">
                <MapPin className="size-4 text-[#e59bc9]" />
                <span>Location & Business Details</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Location / Hub City
                  </label>
                  <input
                    type="text"
                    value={profile.location}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, location: e.target.value }))
                    }
                    placeholder="e.g. Cebu City, Central Visayas"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Business Type
                  </label>
                  <select
                    value={profile.businessType}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        businessType: e.target.value as SellerShopProfile["businessType"],
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] transition-colors"
                  >
                    <option value="Individual Tech Seller">Individual Tech Seller</option>
                    <option value="Registered Hardware Shop">Registered Hardware Shop</option>
                    <option value="Refurbisher">Hardware Refurbisher</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                  Default Meetup Coordinates
                </label>
                <input
                  type="text"
                  value={profile.defaultMeetupArea}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      defaultMeetupArea: e.target.value,
                    }))
                  }
                  placeholder="e.g. Cebu IT Park, Lahug / Ayala Center Cebu"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] transition-colors"
                />
              </div>
            </div>

            {/* SECTION 3: Operations & Fulfillment */}
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-bold text-[#fffafa] uppercase tracking-wider pb-2 border-b border-white/[0.08] flex items-center gap-2">
                <Settings className="size-4 text-[#e59bc9]" />
                <span>Shop Operations</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Shop Status
                  </label>
                  <select
                    value={profile.shopStatus}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        shopStatus: e.target.value as SellerShopProfile["shopStatus"],
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] transition-colors"
                  >
                    <option value="Active">Active & Accepting Orders</option>
                    <option value="Vacation Mode">Vacation Mode (Paused)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Fulfillment Mode
                  </label>
                  <select
                    value={profile.fulfillmentPreference}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        fulfillmentPreference: e.target.value as SellerShopProfile["fulfillmentPreference"],
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] transition-colors"
                  >
                    <option value="Both">Delivery & Meetup</option>
                    <option value="Delivery">Delivery Only</option>
                    <option value="Meetup">Meetup Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Handling Time
                  </label>
                  <select
                    value={profile.handlingTime}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        handlingTime: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] transition-colors"
                  >
                    <option value="Same Day">Same Day Dispatch</option>
                    <option value="1–2 days">1–2 Business Days</option>
                    <option value="2–3 days">2–3 Business Days</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] active:scale-[0.98]"
              >
                {isSaving ? "Saving..." : "Save Shop Profile"}
              </button>
            </div>
          </form>
        </div>

        {/* ======================================================= */}
        {/* RIGHT 5 COLUMNS: Live Buyer-Facing Preview Card         */}
        {/* ======================================================= */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#b9adb6] flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#e59bc9]" />
              <span>Live Buyer Preview</span>
            </span>
            <Link
              href={`/shop/${profile.slug}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#e59bc9] hover:text-white transition-colors"
            >
              <span>Open full shop</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>

          {/* Shop Card Surface */}
          <div className="bg-[#1e1322]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl space-y-0">
            {/* Banner preview */}
            <div
              className={`h-28 bg-gradient-to-r ${
                bannerPresets.find((b) => b.id === selectedBannerPreset)?.gradient ||
                "from-[#432c45] via-[#281729] to-[#684d72]"
              } p-4 flex items-end justify-end`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-xs text-white/80 border border-white/10">
                {profile.shopStatus}
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-4 -mt-10">
              {/* Avatar + Title */}
              <div className="flex items-end gap-3.5">
                <div className="size-16 rounded-2xl bg-[#3d2743] border-4 border-[#1e1322] flex items-center justify-center text-[#e59bc9] font-black text-2xl shadow-xl shrink-0">
                  {profile.shopName.charAt(0) || "T"}
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-extrabold text-[#fffafa] truncate">
                      {profile.shopName || "TechVault Cebu"}
                    </h3>
                    {profile.isVerified && (
                      <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-[#e59bc9] font-semibold">
                    @{profile.slug || "techvault"}
                  </p>
                </div>
              </div>

              {/* Location & Badges */}
              <div className="flex items-center gap-2 text-xs text-[#b9adb6]">
                <MapPin className="size-3.5 text-[#e59bc9] shrink-0" />
                <span className="truncate">{profile.location}</span>
                <span>&bull;</span>
                <span className="text-amber-300 font-semibold flex items-center gap-0.5">
                  ★ {profile.rating}
                </span>
              </div>

              {/* Bio */}
              <p className="text-xs text-[#d6cbd5] leading-relaxed line-clamp-3">
                {profile.description || "No shop description provided yet."}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.08] text-center text-xs">
                <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="font-extrabold text-sm text-[#fffafa]">
                    {profile.completedOrders}
                  </p>
                  <p className="text-[10px] text-[#b9adb6] mt-0.5">Orders</p>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="font-extrabold text-sm text-emerald-400">
                    {profile.responseRate}%
                  </p>
                  <p className="text-[10px] text-[#b9adb6] mt-0.5">Response</p>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="font-extrabold text-sm text-[#e59bc9]">
                    {DEMO_SELLER_PRODUCTS.length}
                  </p>
                  <p className="text-[10px] text-[#b9adb6] mt-0.5">Listings</p>
                </div>
              </div>

              {/* Meetup / Dispatch details */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-[#b9adb6] space-y-1">
                <div className="flex items-center gap-1.5 text-white font-semibold">
                  <Truck className="size-3.5 text-[#e59bc9]" />
                  <span>Dispatch: {profile.handlingTime}</span>
                </div>
                <p className="text-[11px] text-[#d6cbd5] truncate">
                  Meetup: {profile.defaultMeetupArea}
                </p>
              </div>

              {/* Link button */}
              <Link
                href={`/shop/${profile.slug}`}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#65486f]/40 hover:bg-[#65486f] border border-white/10 text-xs font-bold text-white transition-all shadow-xs text-center"
              >
                <span>View Public Shop Storefront</span>
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
