"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { ProductForm, InitialProductData } from "@/components/seller/product-form";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { getProductImageUrl } from "@/lib/supabase/storage";
import type { DbProductCondition, DbProductStatus } from "@/lib/supabase/types";

interface EditProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [initialData, setInitialData] = useState<InitialProductData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<"not_found" | "unauthorized" | "unauthenticated" | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setIsLoading(true);
      setErrorStatus(null);

      try {
        const user = await getCurrentUser();
        if (!user) {
          if (active) {
            setErrorStatus("unauthenticated");
            router.push(`/login?redirectTo=${encodeURIComponent(`/seller/products/${id}/edit`)}`);
          }
          return;
        }

        const supabase = createClient();
        const { data: product, error: fetchErr } = await supabase
          .from("products")
          .select(`
            id,
            seller_id,
            title,
            category,
            condition,
            price,
            original_price,
            stock,
            specs,
            description,
            location,
            status,
            product_images (
              id,
              storage_path,
              sort_order
            )
          `)
          .eq("id", id)
          .maybeSingle();

        if (!active) return;

        if (fetchErr || !product) {
          setErrorStatus("not_found");
          return;
        }

        if (product.seller_id !== user.id) {
          setErrorStatus("unauthorized");
          return;
        }

        const sortedImages = [...(product.product_images || [])].sort(
          (a, b) => a.sort_order - b.sort_order
        );

        const mappedImages = sortedImages.map((img) => ({
          id: img.id,
          storage_path: img.storage_path,
          url: getProductImageUrl(img.storage_path),
          sort_order: img.sort_order,
        }));

        setInitialData({
          id: product.id,
          title: product.title,
          category: product.category,
          condition: product.condition as DbProductCondition,
          price: Number(product.price),
          originalPrice: product.original_price ? Number(product.original_price) : null,
          stock: Number(product.stock),
          specs: product.specs || "",
          description: product.description || "",
          location: product.location || "",
          status: product.status as DbProductStatus,
          existingImages: mappedImages,
        });
      } catch (err) {
        console.error("Failed to load product for editing:", err);
        if (active) setErrorStatus("not_found");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadProduct();

    return () => {
      active = false;
    };
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-16 px-4 flex flex-col items-center justify-center font-sans">
        <Loader2 className="size-8 animate-spin text-[#e59bc9] mb-3" />
        <p className="text-xs font-semibold text-[#b9adb6]">Loading product details…</p>
      </div>
    );
  }

  if (errorStatus === "unauthorized") {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md mx-auto space-y-6">
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
          >
            <ArrowLeft className="size-3.5 text-[#e59bc9]" />
            <span>Back to My Products</span>
          </Link>

          <div className="bg-[#1e1322]/90 backdrop-blur-xl border border-rose-500/20 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl text-center">
            <div className="size-14 rounded-2xl bg-rose-950/50 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="size-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#fffafa] tracking-tight">
                Access Denied
              </h1>
              <p className="text-xs sm:text-sm text-[#b9adb6] leading-relaxed">
                You do not have permission to edit this product listing because it belongs to another seller.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/seller/products"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#65486f] hover:bg-[#7a5985] text-xs font-bold text-white shadow-xs transition-all"
              >
                Return to My Listings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorStatus === "not_found" || !initialData) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md mx-auto space-y-6">
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors"
          >
            <ArrowLeft className="size-3.5 text-[#e59bc9]" />
            <span>Back to My Products</span>
          </Link>

          <div className="bg-[#1e1322]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl text-center">
            <div className="size-14 rounded-2xl bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
              <AlertCircle className="size-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#fffafa] tracking-tight">
                Product Not Found
              </h1>
              <p className="text-xs sm:text-sm text-[#b9adb6] leading-relaxed">
                The product you are attempting to edit could not be found or may have been deleted.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/seller/products"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#65486f] hover:bg-[#7a5985] text-xs font-bold text-white shadow-xs transition-all"
              >
                Back to My Products
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
            <Edit className="size-7 text-[#e59bc9]" />
            <span>Edit Product Listing</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#b9adb6] mt-1">
            Update specifications, pricing, inventory, and photos for &ldquo;{initialData.title}&rdquo;.
          </p>
        </div>

        {/* Shared Product Form in Edit Mode */}
        <ProductForm mode="edit" initialData={initialData} />
      </div>
    </div>
  );
}
