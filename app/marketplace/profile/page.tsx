"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  User,
  MapPin,
  Mail,
  Calendar,
  Shield,
  Camera,
  Edit3,
  Store,
  Package,
  Heart,
  Tag,
  Star,
  ShoppingBag,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";
import { EditProfileModal } from "@/components/marketplace/edit-profile-modal";
import { getBuyerOrders } from "@/lib/supabase/orders";
import { getSellerProducts } from "@/lib/supabase/products";
import type { OrderWithItems } from "@/lib/supabase/types";
import type { SellerProductItem } from "@/lib/seller/seller-data";
import { toast } from "sonner";

type ProfileTab = "overview" | "purchases" | "listings" | "reviews";

export default function ProfilePage() {
  const { demoProfile, favorites } = useMarketplace();
  const { userId, profile, isSeller } = useMarketplaceAccount();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const [buyerOrders, setBuyerOrders] = useState<OrderWithItems[]>([]);
  const [sellerProducts, setSellerProducts] = useState<SellerProductItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchData() {
      try {
        const orders = await getBuyerOrders();
        if (!active) return;
        setBuyerOrders(orders || []);

        if (userId) {
          const prods = await getSellerProducts(userId);
          if (!active) return;
          setSellerProducts(prods || []);
        } else {
          setSellerProducts([]);
        }
      } catch (err) {
        console.error("Failed to load profile orders/products:", err);
      } finally {
        if (active) setDataLoading(false);
      }
    }

    fetchData();
    return () => {
      active = false;
    };
  }, [userId, refreshKey]);

  const activeListingsCount = sellerProducts.filter(
    (p) => p.status === "Active"
  ).length;



  const displayName = profile?.full_name || demoProfile.name;
  const displayUsername = profile?.username
    ? `@${profile.username}`
    : demoProfile.username;
  const displayLocation = profile?.location || demoProfile.location;
  const displayBio = profile?.bio || demoProfile.bio;
  const displayRole = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : isSeller
    ? "Seller"
    : "Buyer";
  const displayJoinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : demoProfile.joinedDate;

  const tabs: { key: ProfileTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "purchases", label: "Purchases", count: buyerOrders.length },
    { key: "listings", label: "Listings", count: activeListingsCount },
    { key: "reviews", label: "Reviews", count: 0 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Title & Breadcrumb */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-[#b9adb6] mb-1">
          <Link href="/marketplace" className="hover:text-white transition-colors">
            Marketplace
          </Link>
          <span>/</span>
          <span className="text-white font-medium">User Profile</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          My Profile
        </h1>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Profile Sidebar / Summary (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Main User Card */}
          <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden text-center sm:text-left flex flex-col items-center sm:items-start space-y-4">
            {/* Avatar with Camera Placeholder */}
            <div className="relative group">
              <div className="size-20 sm:size-24 rounded-full bg-[#65486f] border-2 border-white/20 flex items-center justify-center text-3xl font-extrabold text-white shadow-lg">
                {displayName.charAt(0) || "U"}
              </div>
              <button
                type="button"
                aria-label="Change profile photo"
                onClick={() =>
                  toast.info(
                    "Photo uploading will be available in future profile settings updates."
                  )
                }
                className="absolute bottom-0 right-0 size-7 bg-[#211a24] hover:bg-[#342339] border border-white/20 rounded-full flex items-center justify-center text-[#e59bc9] transition-colors cursor-pointer shadow-md focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
              >
                <Camera className="size-3.5" />
              </button>
            </div>

            {/* Name, Username, Location */}
            <div className="space-y-1 w-full text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {displayName}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded-md">
                  {displayRole}
                </span>
              </div>
              <p className="text-xs text-[#e59bc9] font-medium">
                {displayUsername}
              </p>
              <p className="text-xs text-[#b9adb6] flex items-center justify-center sm:justify-start gap-1 pt-1">
                <MapPin className="size-3.5 text-[#b9adb6] shrink-0" />
                <span>{displayLocation}</span>
              </p>
            </div>

            {/* Bio snippet */}
            <p className="text-xs text-[#b9adb6] leading-relaxed pt-1 border-t border-white/10 w-full text-center sm:text-left">
              {displayBio}
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
              <button
                ref={editButtonRef}
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 text-xs font-semibold bg-[#342339] hover:bg-[#45304b] text-white border border-white/10 rounded-xl transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
              >
                <Edit3 className="size-3.5 text-[#e59bc9]" />
                <span>Edit profile</span>
              </button>

              <Link
                href={isSeller ? "/seller" : "/sell"}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-white rounded-xl transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
              >
                <Store className="size-3.5 text-[#e59bc9]" />
                <span>{isSeller ? "Dashboard" : "Start selling"}</span>
              </Link>
            </div>
          </div>

          {/* Compact Seller Status Box */}
          <div className="bg-[#241c27] border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b9adb6]">
                Seller status
              </span>
              {isSeller ? (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/50 rounded-md">
                  Active seller
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/50 rounded-md">
                  Not enrolled
                </span>
              )}
            </div>
            <p className="text-xs text-[#b9adb6] leading-relaxed">
              {isSeller
                ? "Your shop and listings are active on CircuitCart marketplace."
                : "Complete seller verification before publishing technology listings on CircuitCart."}
            </p>
            <Link
              href={isSeller ? "/seller" : "/sell"}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#e59bc9] hover:text-white transition-colors"
            >
              <span>{isSeller ? "Manage your seller shop" : "Learn about seller verification"}</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: Profile Content Tabs & Details (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Navigation Tabs Bar */}
          <div
            role="tablist"
            aria-label="Profile section tabs"
            className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none no-scrollbar"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  id={`profile-tab-${tab.key}`}
                  aria-selected={isActive}
                  aria-controls={`profile-panel-${tab.key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer ${
                    isActive
                      ? "bg-[#65486f] text-white shadow-xs"
                      : "text-[#b9adb6] hover:bg-[#342339] hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="ml-1.5 px-1.5 py-0.2 bg-black/20 text-[10px] rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div
              role="tabpanel"
              id="profile-panel-overview"
              aria-labelledby="profile-tab-overview"
              className="space-y-6 animate-in fade-in duration-200"
            >
              {/* Activity Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-[#241c27] border border-white/10 rounded-2xl p-4 space-y-1 text-center sm:text-left">
                  <div className="size-8 rounded-lg bg-[#342339] flex items-center justify-center text-[#e59bc9] mx-auto sm:mx-0 mb-2">
                    <Package className="size-4" />
                  </div>
                  <div className="text-xl font-extrabold text-white">
                    {dataLoading ? "..." : buyerOrders.length}
                  </div>
                  <div className="text-[11px] font-medium text-[#b9adb6]">Orders</div>
                </div>

                <div className="bg-[#241c27] border border-white/10 rounded-2xl p-4 space-y-1 text-center sm:text-left">
                  <div className="size-8 rounded-lg bg-[#342339] flex items-center justify-center text-pink-300 mx-auto sm:mx-0 mb-2">
                    <Heart className="size-4 fill-pink-300/30" />
                  </div>
                  <div className="text-xl font-extrabold text-white">{favorites.length}</div>
                  <div className="text-[11px] font-medium text-[#b9adb6]">Saved products</div>
                </div>

                <div className="bg-[#241c27] border border-white/10 rounded-2xl p-4 space-y-1 text-center sm:text-left">
                  <div className="size-8 rounded-lg bg-[#342339] flex items-center justify-center text-[#b78bd7] mx-auto sm:mx-0 mb-2">
                    <Tag className="size-4" />
                  </div>
                  <div className="text-xl font-extrabold text-white">
                    {dataLoading ? "..." : activeListingsCount}
                  </div>
                  <div className="text-[11px] font-medium text-[#b9adb6]">Active listings</div>
                </div>

                <div className="bg-[#241c27] border border-white/10 rounded-2xl p-4 space-y-1 text-center sm:text-left">
                  <div className="size-8 rounded-lg bg-[#342339] flex items-center justify-center text-amber-300 mx-auto sm:mx-0 mb-2">
                    <Star className="size-4" />
                  </div>
                  <div className="text-xl font-extrabold text-white">0</div>
                  <div className="text-[11px] font-medium text-[#b9adb6]">Reviews</div>
                </div>
              </div>

              {/* Personal Information Grid */}
              <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <User className="size-4 text-[#e59bc9]" />
                    <span>Personal Details</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs font-semibold text-[#e59bc9] hover:text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                  >
                    Edit details
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-xs">
                  <div>
                    <span className="text-[#b9adb6] block mb-1">Full Name</span>
                    <span className="font-semibold text-white">{displayName}</span>
                  </div>

                  <div>
                    <span className="text-[#b9adb6] block mb-1">Username</span>
                    <span className="font-semibold text-white">{displayUsername}</span>
                  </div>

                  <div>
                    <span className="text-[#b9adb6] block mb-1">Email Address</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Mail className="size-3.5 text-[#b9adb6]" />
                      <span>{demoProfile.email}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[#b9adb6] block mb-1">Primary Location</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-[#b9adb6]" />
                      <span>{displayLocation}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[#b9adb6] block mb-1">Account Role</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Shield className="size-3.5 text-emerald-400" />
                      <span>{displayRole}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[#b9adb6] block mb-1">Date Joined</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-[#b9adb6]" />
                      <span>{displayJoinedDate}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[#b9adb6] block mb-1 text-xs">About Me</span>
                  <p className="text-xs text-white leading-relaxed bg-[#342339]/50 p-3.5 rounded-xl border border-white/5">
                    {displayBio}
                  </p>
                </div>
              </div>

              {/* Marketplace Preferences Card */}
              <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Info className="size-4 text-[#e59bc9]" />
                  <span>Marketplace Preferences</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#342339]/50 border border-white/5 rounded-xl p-3.5">
                    <span className="text-[#b9adb6] block mb-1">Default Currency</span>
                    <span className="font-semibold text-white">Philippine Peso (PHP ₱)</span>
                  </div>
                  <div className="bg-[#342339]/50 border border-white/5 rounded-xl p-3.5">
                    <span className="text-[#b9adb6] block mb-1">Local Trade Region</span>
                    <span className="font-semibold text-white">Metro Cebu & Visayas</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PURCHASES */}
          {activeTab === "purchases" && (
            <div
              role="tabpanel"
              id="profile-panel-purchases"
              aria-labelledby="profile-tab-purchases"
              className="space-y-4 animate-in fade-in duration-200"
            >
              {dataLoading ? (
                <div className="bg-[#241c27] border border-white/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                  <Loader2 className="size-8 text-[#e59bc9] animate-spin mb-3" />
                  <p className="text-xs text-[#b9adb6]">Loading your purchases...</p>
                </div>
              ) : buyerOrders.length === 0 ? (
                <div className="bg-[#241c27] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-xl min-h-[230px] sm:min-h-[280px] flex flex-col items-center justify-center">
                  <div className="size-12 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                    <ShoppingBag className="size-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    No purchases yet
                  </h3>
                  <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
                    Products you purchase on CircuitCart will appear here with tracking and transaction history.
                  </p>
                  <div className="pt-1">
                    <Link
                      href="/marketplace"
                      className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-white rounded-xl transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                    >
                      Browse marketplace
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-[#b9adb6]">
                      {buyerOrders.length} {buyerOrders.length === 1 ? "order" : "orders"} placed
                    </span>
                    <Link
                      href="/marketplace/orders"
                      className="text-xs font-bold text-[#e59bc9] hover:underline"
                    >
                      View all orders &rarr;
                    </Link>
                  </div>
                  <div className="space-y-2.5">
                    {buyerOrders.slice(0, 5).map((order) => (
                      <Link
                        key={order.id}
                        href="/marketplace/orders"
                        className="block bg-[#241c27] border border-white/10 hover:border-white/20 rounded-2xl p-4 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-white">
                              {order.shops?.name || "CircuitCart Shop"}
                            </span>
                            <p className="text-[11px] text-[#b9adb6] mt-0.5">
                              {order.order_items?.length || 0} item(s) • ₱{Number(order.total).toLocaleString()}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-[#342339] text-[#e59bc9] border border-white/10">
                            {order.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LISTINGS */}
          {activeTab === "listings" && (
            <div
              role="tabpanel"
              id="profile-panel-listings"
              aria-labelledby="profile-tab-listings"
              className="space-y-4 animate-in fade-in duration-200"
            >
              {dataLoading ? (
                <div className="bg-[#241c27] border border-white/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                  <Loader2 className="size-8 text-[#e59bc9] animate-spin mb-3" />
                  <p className="text-xs text-[#b9adb6]">Loading your listings...</p>
                </div>
              ) : sellerProducts.length === 0 ? (
                <div className="bg-[#241c27] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-xl min-h-[230px] sm:min-h-[280px] flex flex-col items-center justify-center">
                  <div className="size-12 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                    <Tag className="size-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {isSeller ? "No listings created yet" : "You are not selling yet"}
                  </h3>
                  <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
                    {isSeller
                      ? "Create your first tech listing to reach buyers across Cebu and Visayas."
                      : "Complete seller verification before creating your first listing and reaching buyers across Cebu."}
                  </p>
                  <div className="pt-1">
                    <Link
                      href={isSeller ? "/sell" : "/sell"}
                      className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-white rounded-xl transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                    >
                      {isSeller ? "Create listing" : "Start selling"}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-[#b9adb6]">
                      {sellerProducts.length} {sellerProducts.length === 1 ? "listing" : "listings"} total
                    </span>
                    <Link
                      href="/seller/products"
                      className="text-xs font-bold text-[#e59bc9] hover:underline"
                    >
                      Manage listings &rarr;
                    </Link>
                  </div>
                  <div className="space-y-2.5">
                    {sellerProducts.slice(0, 5).map((prod) => (
                      <Link
                        key={prod.id}
                        href={`/marketplace/product/${prod.id}`}
                        className="block bg-[#241c27] border border-white/10 hover:border-white/20 rounded-2xl p-4 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-white">
                              {prod.name}
                            </span>
                            <p className="text-[11px] text-[#b9adb6] mt-0.5">
                              ₱{prod.price.toLocaleString()} • Stock: {prod.stock ?? 0}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-800/50">
                            {prod.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* TAB 4: REVIEWS */}
          {activeTab === "reviews" && (
            <div
              role="tabpanel"
              id="profile-panel-reviews"
              aria-labelledby="profile-tab-reviews"
              className="bg-[#241c27] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-xl min-h-[230px] sm:min-h-[280px] flex flex-col items-center justify-center animate-in fade-in duration-200"
            >
              <div className="size-12 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-amber-300">
                <Star className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                No reviews yet
              </h3>
              <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
                Reviews from completed transactions and verified buyers will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Accessible Modal Dialog */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        triggerRef={editButtonRef}
        onProfileUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

