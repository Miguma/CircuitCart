"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  PlusCircle,
  Package,
  Eye,
  MoreVertical,
  ExternalLink,
  Edit2,
  Copy,
  Archive,
  Trash2,
  Loader2,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import {
  DEMO_SELLER_PRODUCTS,
  type ListingStatus,
  type SellerProductItem,
} from "@/lib/seller/seller-data";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  getSellerProducts,
  deleteProduct,
  updateProductStatus,
  duplicateProduct,
} from "@/lib/supabase/products";
import { toast } from "sonner";

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProductItem[]>(DEMO_SELLER_PRODUCTS);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        const dbItems = await getSellerProducts(user.id);
        if (dbItems.length > 0) {
          setProducts(dbItems);
        }
      }
    } catch (err) {
      console.warn("Could not load Supabase seller products:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (user && active) {
          return getSellerProducts(user.id);
        }
        return [];
      })
      .then((dbItems) => {
        if (active) {
          if (dbItems && dbItems.length > 0) {
            setProducts(dbItems);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Could not load Supabase seller products:", err);
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Status counts
  const statusCounts = useMemo(() => {
    return {
      All: products.length,
      Active: products.filter((p) => p.status === "Active").length,
      Draft: products.filter((p) => p.status === "Draft").length,
      "Sold Out": products.filter((p) => p.status === "Sold Out").length,
      Archived: products.filter((p) => p.status === "Archived").length,
    };
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.specs.toLowerCase().includes(q);

      const matchesStatus =
        selectedStatus === "All" || p.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, selectedStatus]);

  // Actions
  const handleDuplicate = React.useCallback(
    async (prod: SellerProductItem) => {
      try {
        await duplicateProduct(prod.id);
        await fetchProducts();
        setActiveMenuId(null);
        toast.success(`Duplicated "${prod.name}" as a draft.`);
      } catch {
        // Fallback local duplicate if offline/demo
        const timestamp = Date.now();
        const newProd: SellerProductItem = {
          ...prod,
          id: `prod-${timestamp}`,
          name: `${prod.name} (Copy)`,
          status: "Draft",
          views: 0,
          soldCount: 0,
          updatedAt: "Just now",
        };
        setProducts((prev) => [newProd, ...prev]);
        setActiveMenuId(null);
        toast.success(`Duplicated "${prod.name}" as a draft.`);
      }
    },
    [fetchProducts]
  );

  const handleArchive = React.useCallback(
    async (id: string, currentStatus: ListingStatus) => {
      const newStatus = currentStatus === "Archived" ? "Active" : "Archived";
      const dbStatus = newStatus === "Active" ? "active" : "archived";

      try {
        await updateProductStatus(id, dbStatus);
        await fetchProducts();
        setActiveMenuId(null);
        toast.info(`Listing status updated to ${newStatus}.`);
      } catch {
        // Fallback local status change
        setProducts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: newStatus,
                  updatedAt: "Just now",
                }
              : p
          )
        );
        setActiveMenuId(null);
        toast.info(`Listing status updated to ${newStatus}.`);
      }
    },
    [fetchProducts]
  );

  const handleDelete = React.useCallback(
    async (id: string, name: string) => {
      const confirmed = window.confirm(`Are you sure you want to permanently delete "${name}"?`);
      if (!confirmed) return;

      try {
        await deleteProduct(id);
        await fetchProducts();
        setActiveMenuId(null);
        toast.success(`Removed "${name}" from your listings.`);
      } catch {
        // Fallback local delete
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setActiveMenuId(null);
        toast.success(`Removed "${name}" from your listings.`);
      }
    },
    [fetchProducts]
  );

  const getStatusBadge = (status: ListingStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Active
          </span>
        );
      case "Draft":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#45284f] border border-[#e59bc9]/30 text-[#e59bc9]">
            Draft
          </span>
        );
      case "Sold Out":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 border border-amber-500/30 text-amber-300">
            Sold Out
          </span>
        );
      case "Archived":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 border border-white/10 text-[#b9adb6]">
            Archived
          </span>
        );
    }
  };

  return (
    <SellerLayout
      title="My Products"
      subtitle="Manage your inventory, pricing, and hardware catalog."
      showAddProduct={true}
    >
      <div className="space-y-6">
        {/* ========================================================= */}
        {/* 1. CONTROLS: SEARCH & STATUS TABS                         */}
        {/* ========================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status filter tabs */}
          <div className="flex flex-wrap items-center gap-1.5 py-1">
            {(["All", "Active", "Draft", "Sold Out", "Archived"] as const).map(
              (st) => {
                const isSelected = selectedStatus === st;
                const count = statusCounts[st];
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStatus(st)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? "bg-[#65486f] text-white border border-white/20 shadow-xs"
                        : "bg-[#1e1322]/60 hover:bg-[#342339] text-[#b9adb6] hover:text-white border border-white/[0.06]"
                    }`}
                  >
                    <span>{st}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isSelected
                          ? "bg-white text-[#19131b]"
                          : "bg-white/10 text-[#d6cbd5]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {/* Search bar + Add Button */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#b9adb6] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your listings..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#1e1322]/80 border border-white/10 text-xs font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
              />
            </div>

            <Link
              href="/sell"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-semibold shadow-xs transition-all shrink-0 cursor-pointer"
            >
              <PlusCircle className="size-3.5 text-[#e59bc9]" />
              <span>Add Product</span>
            </Link>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. PRODUCT TABLE (Desktop) & STACKED CARDS (Mobile)       */}
        {/* ========================================================= */}
        <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="size-12 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                <Package className="size-6" />
              </div>
              <h3 className="text-base font-bold text-[#fffafa]">
                No products found
              </h3>
              <p className="text-xs text-[#b9adb6] max-w-sm mx-auto">
                No listings matched your active search or status filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("All");
                }}
                className="px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE (Hidden on small screens) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-white/[0.02] border-b border-white/[0.06] text-[#b9adb6] text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">Product</th>
                      <th className="py-3.5 px-4">Price</th>
                      <th className="py-3.5 px-4">Stock</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Views</th>
                      <th className="py-3.5 px-4">Sold</th>
                      <th className="py-3.5 px-4">Updated</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-[#d6cbd5]">
                    {filteredProducts.map((prod) => (
                      <tr
                        key={prod.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Product Column */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-10 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold shrink-0 overflow-hidden relative">
                              {prod.image ? (
                                <Image
                                  src={prod.image}
                                  alt={prod.name}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <Package className="size-5" />
                              )}
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <p className="font-bold text-[#fffafa] truncate text-xs sm:text-sm">
                                {prod.name}
                              </p>
                              <p className="text-[11px] text-[#b9adb6] truncate mt-0.5">
                                {prod.category} &bull; {prod.condition} &bull;{" "}
                                {prod.specs}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Price Column */}
                        <td className="py-4 px-4 font-bold text-[#fffafa]">
                          ₱{prod.price.toLocaleString()}
                        </td>

                        {/* Stock Column */}
                        <td className="py-4 px-4">
                          <span
                            className={`font-semibold ${
                              prod.stock === 0
                                ? "text-amber-400"
                                : prod.stock <= 2
                                ? "text-rose-400"
                                : "text-[#fffafa]"
                            }`}
                          >
                            {prod.stock}
                          </span>
                        </td>

                        {/* Status Column */}
                        <td className="py-4 px-4">
                          {getStatusBadge(prod.status)}
                        </td>

                        {/* Views Column */}
                        <td className="py-4 px-4">
                          <span className="flex items-center gap-1 text-xs text-[#b9adb6]">
                            <Eye className="size-3" />
                            {prod.views}
                          </span>
                        </td>

                        {/* Sold Column */}
                        <td className="py-4 px-4 font-semibold text-[#fffafa]">
                          {prod.soldCount}
                        </td>

                        {/* Updated Column */}
                        <td className="py-4 px-4 text-xs text-[#b9adb6] whitespace-nowrap">
                          {prod.updatedAt}
                        </td>

                        {/* Actions Column */}
                        <td className="py-4 px-5 text-right relative">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/marketplace/products/${prod.id}`}
                              className="size-8 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-[#b9adb6] hover:text-white transition-colors"
                              title="View listing on marketplace"
                            >
                              <ExternalLink className="size-3.5" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => toast.info(`Editing "${prod.name}"`)}
                              className="size-8 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-[#b9adb6] hover:text-white transition-colors"
                              title="Edit listing"
                            >
                              <Edit2 className="size-3.5" />
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveMenuId(
                                    activeMenuId === prod.id ? null : prod.id
                                  )
                                }
                                className="size-8 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-[#b9adb6] hover:text-white transition-colors"
                              >
                                <MoreVertical className="size-3.5" />
                              </button>

                              {activeMenuId === prod.id && (
                                <div className="absolute right-0 top-9 w-36 bg-[#281827] border border-white/10 rounded-xl shadow-2xl p-1 z-30 animate-in fade-in zoom-in-95 duration-150 text-left">
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicate(prod)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#d6cbd5] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Copy className="size-3" />
                                    <span>Duplicate</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleArchive(prod.id, prod.status)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#d6cbd5] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Archive className="size-3" />
                                    <span>
                                      {prod.status === "Archived"
                                        ? "Unarchive"
                                        : "Archive"}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDelete(prod.id, prod.name)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="size-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE STACKED CARDS (< md) */}
              <div className="md:hidden divide-y divide-white/[0.06]">
                {filteredProducts.map((prod) => (
                  <div key={prod.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold shrink-0 overflow-hidden relative">
                          {prod.image ? (
                            <Image
                              src={prod.image}
                              alt={prod.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <Package className="size-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#fffafa] truncate">
                            {prod.name}
                          </h4>
                          <p className="text-[11px] text-[#b9adb6] truncate mt-0.5">
                            {prod.category} &bull; {prod.condition}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(prod.status)}
                    </div>

                    <div className="flex items-center justify-between text-xs py-1 border-t border-b border-white/[0.04]">
                      <div>
                        <span className="text-[#8f7d8c]">Price:</span>{" "}
                        <span className="font-bold text-[#fffafa]">
                          ₱{prod.price.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8f7d8c]">Stock:</span>{" "}
                        <span className="font-semibold text-[#fffafa]">
                          {prod.stock}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8f7d8c]">Sold:</span>{" "}
                        <span className="font-semibold text-[#fffafa]">
                          {prod.soldCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Link
                        href={`/marketplace/products/${prod.id}`}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-[#d6cbd5] hover:text-white"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(prod)}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-[#d6cbd5] hover:text-white"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(prod.id, prod.name)}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/20 text-xs font-semibold text-rose-300 hover:text-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
