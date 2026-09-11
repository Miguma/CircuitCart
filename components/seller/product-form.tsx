"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Package,
  Upload,
  Sparkles,
  Info,
  ImageIcon,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CATEGORIES } from "@/components/marketplace/marketplace-data";
import { createProduct, updateProduct } from "@/lib/supabase/products";
import { validateProductImage } from "@/lib/supabase/storage";
import type { DbProductCondition, DbProductStatus } from "@/lib/supabase/types";
import { toast } from "sonner";

export interface ExistingImageItem {
  id: string;
  storage_path: string;
  url: string;
  sort_order: number;
}

export interface InitialProductData {
  id: string;
  title: string;
  category: string;
  condition: DbProductCondition;
  price: number;
  originalPrice?: number | null;
  stock: number;
  specs?: string;
  description?: string;
  location?: string;
  status?: DbProductStatus;
  existingImages?: ExistingImageItem[];
}

interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: InitialProductData;
}

type FormImage =
  | { kind: "existing"; id: string; storagePath: string; url: string }
  | { kind: "new"; file: File; previewUrl: string; key: string };

export function ProductForm({ mode, initialData }: ProductFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialData?.title || "");
  const [category, setCategory] = useState(initialData?.category || "Laptops");
  const [condition, setCondition] = useState<DbProductCondition>(
    initialData?.condition || "Like New"
  );
  const [price, setPrice] = useState(
    initialData?.price !== undefined ? String(initialData.price) : ""
  );
  const [originalPrice, setOriginalPrice] = useState(
    initialData?.originalPrice ? String(initialData.originalPrice) : ""
  );
  const [stock, setStock] = useState(
    initialData?.stock !== undefined ? String(initialData.stock) : "1"
  );
  const [specs, setSpecs] = useState(initialData?.specs || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [location, setLocation] = useState(
    initialData?.location || "Cebu City, Central Visayas"
  );

  // Initialize images from initialData (if any)
  const [images, setImages] = useState<FormImage[]>(() => {
    if (!initialData?.existingImages) return [];
    return initialData.existingImages.map((img) => ({
      kind: "existing",
      id: img.id,
      storagePath: img.storage_path,
      url: img.url,
    }));
  });

  const [removedStoragePaths, setRemovedStoragePaths] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > 5) {
      toast.error("You can upload a maximum of 5 product photos.");
      return;
    }

    const newItems: FormImage[] = [];

    for (const file of files) {
      const check = validateProductImage(file);
      if (!check.valid) {
        toast.error(check.error || `Invalid image: ${file.name}`);
        continue;
      }
      newItems.push({
        kind: "new",
        file,
        previewUrl: URL.createObjectURL(file),
        key: `${file.name}-${Date.now()}-${Math.random()}`,
      });
    }

    setImages((prev) => [...prev, ...newItems]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    const target = images[index];
    if (target.kind === "existing") {
      setRemovedStoragePaths((prev) => [...prev, target.storagePath]);
    } else {
      URL.revokeObjectURL(target.previewUrl);
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveImage = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
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
      if (mode === "create") {
        const newFiles = images
          .filter((img): img is Extract<FormImage, { kind: "new" }> => img.kind === "new")
          .map((img) => img.file);

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
          newFiles
        );

        if (isDraft) {
          toast.success(`Saved "${title}" as a draft.`);
        } else {
          toast.success(`Published "${title}" to CircuitCart marketplace!`);
        }
      } else {
        if (!initialData?.id) {
          throw new Error("Missing product ID for edit mode.");
        }

        const keptExistingImages: { id: string; storage_path: string; sort_order: number }[] = [];
        const newFiles: File[] = [];

        images.forEach((img, idx) => {
          if (img.kind === "existing") {
            keptExistingImages.push({
              id: img.id,
              storage_path: img.storagePath,
              sort_order: idx,
            });
          } else {
            newFiles.push(img.file);
          }
        });

        await updateProduct({
          productId: initialData.id,
          input: {
            title: title.trim(),
            category,
            condition,
            price: numericPrice,
            original_price: numericOriginalPrice,
            stock: numericStock,
            specs: specs.trim() || undefined,
            description: description.trim() || undefined,
            location: location.trim() || undefined,
            status: isDraft ? "draft" : initialData.status,
          },
          keptExistingImages,
          newImageFiles: newFiles,
          removedStoragePaths,
        });

        toast.success(`Successfully saved changes for "${title.trim()}"!`);
      }

      router.push("/seller/products");
      router.refresh();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : mode === "create"
          ? "Failed to create product listing."
          : "Failed to update product listing.";
      toast.error(errorMsg);
      setIsSubmitting(false);
    }
  };

  return (
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
              min="0"
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
            {images.length}/5 photos
          </span>
        </div>

        <p className="text-xs text-[#b9adb6]">
          Upload up to 5 clear photos of your product (JPG, PNG, or WebP, max 5MB each). The first photo will be used as the primary cover.
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
          {images.map((img, idx) => {
            const imageUrl = img.kind === "existing" ? img.url : img.previewUrl;
            return (
              <div
                key={img.kind === "existing" ? img.id : img.key}
                className="relative aspect-square rounded-xl overflow-hidden bg-[#342339] border border-white/10 group"
              >
                <Image
                  src={imageUrl}
                  alt={`Product photo ${idx + 1}`}
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
                {idx === 0 && (
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#19131b]/85 backdrop-blur-xs text-[10px] font-bold text-[#e59bc9] shadow-xs">
                    Cover
                  </span>
                )}

                {/* Reorder arrows on hover */}
                <div className="absolute inset-x-0 top-1.5 px-1 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1 pointer-events-auto">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveImage(idx, "left")}
                        className="size-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-[#65486f] transition-colors cursor-pointer shadow-xs"
                        title="Move image left"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                    )}
                    {idx < images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveImage(idx, "right")}
                        className="size-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-[#65486f] transition-colors cursor-pointer shadow-xs"
                        title="Move image right"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="size-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-600 transition-colors pointer-events-auto cursor-pointer shadow-xs"
                    aria-label="Remove image"
                    title="Remove image"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {images.length < 5 && (
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
        <Link
          href="/seller/products"
          className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] hover:bg-white/5 border border-white/10 rounded-xl transition-colors text-center"
        >
          Cancel
        </Link>

        {mode === "create" && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] hover:bg-white/5 border border-white/10 rounded-xl transition-colors cursor-pointer text-center disabled:opacity-50"
          >
            Save as Draft
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold bg-[#65486f] text-white hover:bg-[#7a5985] rounded-xl transition-all cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9] text-center flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="size-4 animate-spin text-white" />}
          <span>
            {isSubmitting
              ? mode === "create"
                ? "Publishing..."
                : "Saving changes..."
              : mode === "create"
              ? "Publish Listing"
              : "Save Changes"}
          </span>
        </button>
      </div>
    </form>
  );
}
