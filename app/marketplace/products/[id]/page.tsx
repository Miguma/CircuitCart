import React from "react";
import { notFound } from "next/navigation";
import { Product } from "@/components/marketplace/marketplace-data";
import { getProductById, getMarketplaceProducts } from "@/lib/supabase/products";
import ProductDetailClient from "./product-detail-client";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;

  let product: Product | null = null;
  let productImages: string[] = [];
  let relatedProducts: Product[] = [];

  // Attempt to fetch real Supabase product
  try {
    const dbResult = await getProductById(id);
    if (dbResult) {
      product = dbResult.product;
      productImages = dbResult.images;

      // Fetch related products from Supabase active listings
      const allActive = await getMarketplaceProducts();
      relatedProducts = allActive
        .filter((p) => p.category === product?.category && p.id !== product?.id)
        .slice(0, 4);
    }
  } catch (err) {
    console.error("Could not load product from Supabase:", err);
  }

  // If Supabase product is unavailable or not found, return 404
  if (!product) {
    notFound();
  }

  return (
    <ProductDetailClient
      product={product}
      images={productImages}
      relatedProducts={relatedProducts}
    />
  );
}
