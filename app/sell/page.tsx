"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  PlusCircle,
  Package,
  Upload,
  CheckCircle2,
  Sparkles,
  Info,
  ShieldCheck,
} from "lucide-react";
import { CATEGORIES } from "@/components/marketplace/marketplace-data";
import { toast } from "sonner";

export default function AddProductPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Laptops");
  const [condition, setCondition] = useState("Like New");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [specs, setSpecs] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Cebu City, Central Visayas");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!title.trim() || !price) {
      toast.error("Please provide at least a product title and price.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      if (isDraft) {
        toast.success(`Saved "${title}" as a draft.`);
      } else {
        toast.success(`Published "${title}" to CircuitCart marketplace!`);
      }
      router.push("/seller/products");
    }, 600);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
          >
            <ArrowLeft className="size-3.5 text-[#e59bc9]" />
            <span>Back to My Products</span>
          </Link>

          <Link
            href="/seller"
            className="text-xs font-semibold text-[#e59bc9] hover:underline"
          >
            Seller Dashboard
          </Link>
        </div>

        {/* Page Heading */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#fffafa] tracking-tight flex items-center gap-2.5">
            <PlusCircle className="size-7 text-[#e59bc9]" />
            <span>Add New Product Listing</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#b9adb6] mt-1">
            List your tech item for verified buyers across Cebu and the Visayas.
          </p>
        </div>

        {/* Main Form */}
        <form
          onSubmit={(e) => handleSubmit(e, false)}
          className="bg-[#1e1322]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl"
        >
          {/* Section: Basic Information */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-[#fffafa] uppercase tracking-wider pb-2 border-b border-white/[0.08] flex items-center gap-2">
              <Package className="size-4 text-[#e59bc9]" />
              <span>General Information</span>
            </h2>

            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                Product Title <span className="text-[#e59bc9]">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Asus ROG Strix G16 Gaming Laptop 16GB RTX 4060"
                className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
              />
            </div>

            {/* Category & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                  Category <span className="text-[#e59bc9]">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
                >
                  {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                  Condition Grade <span className="text-[#e59bc9]">*</span>
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
                >
                  <option value="New">New (Factory Sealed)</option>
                  <option value="Like New">Like New (Mint Condition)</option>
                  <option value="Good">Good (Minor Wear)</option>
                  <option value="Fair">Fair (Fully Functional)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Pricing & Inventory */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-bold text-[#fffafa] uppercase tracking-wider pb-2 border-b border-white/[0.08] flex items-center gap-2">
              <Sparkles className="size-4 text-[#e59bc9]" />
              <span>Pricing & Inventory</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                  Listing Price (₱) <span className="text-[#e59bc9]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#b9adb6]">
                    ₱
                  </span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="42500"
                    className="w-full h-10 pl-7 pr-3 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#b9adb6] block mb-1.5">
                  Original Price (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#b9adb6]">
                    ₱
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="49990"
                    className="w-full h-10 pl-7 pr-3 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                  Stock Units <span className="text-[#e59bc9]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section: Specs & Details */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-bold text-[#fffafa] uppercase tracking-wider pb-2 border-b border-white/[0.08] flex items-center gap-2">
              <Info className="size-4 text-[#e59bc9]" />
              <span>Specifications & Description</span>
            </h2>

            <div>
              <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                Key Hardware Specs
              </label>
              <input
                type="text"
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder="e.g. Intel i7-13650HX, RTX 4060 8GB, 16GB DDR5, 512GB SSD, 165Hz"
                className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                Detailed Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe condition, inclusions (cables, box), battery health, or warranty details..."
                className="w-full p-3 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                Pickup / Shipping Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Cebu City, Central Visayas"
                className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] hover:bg-white/5 border border-white/10 rounded-xl transition-colors cursor-pointer text-center"
            >
              Save as Draft
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold bg-[#65486f] text-white hover:bg-[#7a5985] rounded-xl transition-all cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9] text-center"
            >
              {isSubmitting ? "Publishing..." : "Publish Listing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
