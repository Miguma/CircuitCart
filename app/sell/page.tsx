"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  PlusCircle,
  Package,
  Upload,
  Sparkles,
  Info,
  ImageIcon,
  X,
  Loader2,
} from "lucide-react";
import { CATEGORIES } from "@/components/marketplace/marketplace-data";
import { createProduct } from "@/lib/supabase/products";
import { validateProductImage } from "@/lib/supabase/storage";
import { getCurrentUserProfile, type UserProfile } from "@/lib/supabase/auth";
import { getMyVerificationRequest } from "@/lib/supabase/verification";
import type { DbProductCondition, DbSellerVerificationRequest } from "@/lib/supabase/types";
import { toast } from "sonner";

export default function AddProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verification, setVerification] = useState<DbSellerVerificationRequest | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Laptops");
  const [condition, setCondition] = useState<DbProductCondition>("Like New");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [specs, setSpecs] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Cebu City, Central Visayas");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadUserRole() {
      try {
        const [p, v] = await Promise.all([
          getCurrentUserProfile(),
          getMyVerificationRequest(),
        ]);
        setProfile(p);
        setVerification(v);
      } catch (err) {
        console.error("Failed to check seller privileges:", err);
      } finally {
        setIsCheckingRole(false);
      }
    }
    loadUserRole();
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedImages.length + files.length > 5) {
      toast.error("You can upload a maximum of 5 product photos.");
      return;
    }

    const validNewFiles: File[] = [];
    const validNewUrls: string[] = [];

    for (const file of files) {
      const check = validateProductImage(file);
      if (!check.valid) {
        toast.error(check.error || `Invalid image: ${file.name}`);
        continue;
      }
      validNewFiles.push(file);
      validNewUrls.push(URL.createObjectURL(file));
    }

    setSelectedImages((prev) => [...prev, ...validNewFiles]);
    setPreviewUrls((prev) => [...prev, ...validNewUrls]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();

    const numericPrice = parseFloat(price);
    if (!title.trim()) {
      toast.error("Please enter a product title.");
      return;
    }
    if (isNaN(numericPrice) || numericPrice <= 0) {
      toast.error("Please enter a valid listing price greater than 0.");
      return;
    }

    const numericStock = parseInt(stock, 10);
    if (isNaN(numericStock) || numericStock < 0) {
      toast.error("Stock quantity must be 0 or more.");
      return;
    }

    const numericOriginalPrice = originalPrice ? parseFloat(originalPrice) : null;

    setIsSubmitting(true);

    try {
      await createProduct(
        {
          title: title.trim(),
          category,
          condition,
          price: numericPrice,
          original_price: numericOriginalPrice,
          stock: numericStock,
          specs: specs.trim() || undefined,
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          status: isDraft ? "draft" : "active",
        },
        selectedImages
      );

      if (isDraft) {
        toast.success(`Saved "${title}" as a draft.`);
      } else {
        toast.success(`Published "${title}" to CircuitCart marketplace!`);
      }

      router.push("/seller/products");
      router.refresh();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create product listing.";
      toast.error(errorMsg);
      setIsSubmitting(false);
    }
  };

  if (isCheckingRole) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-16 px-4 flex flex-col items-center justify-center font-sans">
        <Loader2 className="size-8 animate-spin text-[#e59bc9] mb-3" />
        <p className="text-xs font-semibold text-[#b9adb6]">Verifying seller privileges…</p>
      </div>
    );
  }

  // Buyer verification guard screen
  if (profile?.role === "buyer") {
    const isPending = verification?.status === "pending";
    const isRejected = verification?.status === "rejected";

    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-xl mx-auto space-y-6">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
          >
            <ArrowLeft className="size-3.5 text-[#e59bc9]" />
            <span>Back to Marketplace</span>
          </Link>

          <div className="bg-[#1e1322]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center">
            <div className="size-14 rounded-2xl bg-[#65486f]/20 border border-[#e59bc9]/30 flex items-center justify-center mx-auto text-[#e59bc9]">
              {isPending ? (
                <Loader2 className="size-7 animate-spin text-[#e59bc9]" />
              ) : (
                <Package className="size-7" />
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#fffafa] tracking-tight">
                {isPending
                  ? "Your seller verification is under review"
                  : isRejected
                  ? "Your seller verification was not approved"
                  : "Verify your identity to start selling"}
              </h1>
              <p className="text-xs sm:text-sm text-[#b9adb6] leading-relaxed max-w-md mx-auto">
                {isPending
                  ? "Our compliance team is currently reviewing your submitted ID and selfie document. Once approved, your seller privileges and listing tools will activate automatically."
                  : isRejected
                  ? verification?.rejection_reason || "Your document did not meet verification criteria. Review the feedback and resubmit your application."
                  : "CircuitCart requires seller identity verification before creating product listings. This protects buyers and verified sellers across Cebu and the Visayas."}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/marketplace"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold text-[#b9adb6] hover:text-white transition-colors text-center"
              >
                Browse Marketplace
              </Link>

              <Link
                href="/seller/verification"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#65486f] hover:bg-[#7a5985] text-xs font-bold text-white shadow-xs transition-all text-center flex items-center justify-center gap-2"
              >
                <span>
                  {isPending
                    ? "Check Verification Status"
                    : isRejected
                    ? "Review & Resubmit"
                    : "Start Verification"}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                  onChange={(e) => setCondition(e.target.value as DbProductCondition)}
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

          {/* Section: Product Images */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h2 className="text-sm font-bold text-[#fffafa] uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="size-4 text-[#e59bc9]" />
                <span>Product Photos</span>
              </h2>
              <span className="text-xs text-[#b9adb6]">
                {previewUrls.length}/5 photos
              </span>
            </div>

            <p className="text-xs text-[#b9adb6]">
              Upload up to 5 clear photos of your product (JPG, PNG, or WebP, max 5MB each). The first photo will be used as the cover.
            </p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Photos Grid / Upload Trigger */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {previewUrls.map((url, idx) => (
                <div
                  key={url}
                  className="relative aspect-square rounded-xl overflow-hidden bg-[#342339] border border-white/10 group"
                >
                  <Image
                    src={url}
                    alt={`Product preview ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {idx === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#19131b]/80 text-[10px] font-bold text-[#e59bc9]">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {previewUrls.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-white/15 hover:border-[#e59bc9]/60 hover:bg-white/[0.02] flex flex-col items-center justify-center gap-1.5 text-[#b9adb6] hover:text-[#fffafa] transition-all cursor-pointer p-2"
                >
                  <Upload className="size-5 text-[#e59bc9]" />
                  <span className="text-[11px] font-semibold text-center">
                    Add Photo
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] hover:bg-white/5 border border-white/10 rounded-xl transition-colors cursor-pointer text-center disabled:opacity-50"
            >
              Save as Draft
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold bg-[#65486f] text-white hover:bg-[#7a5985] rounded-xl transition-all cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9] text-center flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin text-white" />}
              <span>{isSubmitting ? "Publishing..." : "Publish Listing"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
