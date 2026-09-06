import React from "react";
import { notFound } from "next/navigation";
import { DUMMY_PRODUCTS, Product } from "@/components/marketplace/marketplace-data";
import { getProductById, getMarketplaceProducts } from "@/lib/supabase/products";
import ProductDetailClient from "./product-detail-client";

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateStaticParams() {
  return DUMMY_PRODUCTS.map((product) => ({
    id: product.id,
  }));
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;

  let product: Product | null = null;
  let relatedProducts: Product[] = [];

  // 1. Attempt to fetch real Supabase product
  try {
    const dbResult = await getProductById(id);
    if (dbResult) {
      product = dbResult.product;

      // Fetch related products from Supabase
      const allActive = await getMarketplaceProducts();
      relatedProducts = allActive
        .filter((p) => p.category === product?.category && p.id !== product?.id)
        .slice(0, 4);
    }
  } catch (err) {
    console.warn("Could not load product from Supabase:", err);
  }

  // 2. Fallback to demo products if not found in database
  if (!product) {
    const fallback = DUMMY_PRODUCTS.find((p) => p.id === id);
    if (fallback) {
      product = fallback;
      relatedProducts = DUMMY_PRODUCTS.filter(
        (p) => p.category === fallback.category && p.id !== fallback.id
      ).slice(0, 4);
    }
  }

  if (!product) {
    notFound();
  }

  return (
    <ProductDetailClient
      product={product}
      relatedProducts={relatedProducts}
    />
  );
}
