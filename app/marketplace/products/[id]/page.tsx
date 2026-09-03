import React from "react";
import { notFound } from "next/navigation";
import { DUMMY_PRODUCTS } from "@/components/marketplace/marketplace-data";
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
  const product = DUMMY_PRODUCTS.find((p) => p.id === id);

  if (!product) {
    notFound();
  }

  // Related products from the same category
  const relatedProducts = DUMMY_PRODUCTS.filter(
    (p) => p.category === product.category && p.id !== product.id
  ).slice(0, 4);

  return (
    <ProductDetailClient
      product={product}
      relatedProducts={relatedProducts}
    />
  );
}
