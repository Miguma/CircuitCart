import React from "react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceProvider } from "@/components/marketplace/marketplace-provider";
import {
  DEMO_SHOP_PROFILE,
} from "@/lib/seller/seller-data";
import { DUMMY_PRODUCTS } from "@/components/marketplace/marketplace-data";
import { PublicShopClientView } from "./public-shop-client-view";

export function generateStaticParams() {
  return [{ slug: "techvault-cebu" }];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicShopPage({ params }: PageProps) {
  const { slug } = await params;

  // In demo mode, any valid techvault slug or slug match displays the shop profile
  const isMatch =
    slug === DEMO_SHOP_PROFILE.slug ||
    slug === "techvault-cebu" ||
    slug === "techvault";

  if (!isMatch) {
    // Render fallback shop or demo
  }

  const shopProducts = DUMMY_PRODUCTS.slice(0, 8);

  return (
    <MarketplaceProvider>
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] flex flex-col font-sans">
        <MarketplaceHeader />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
          <PublicShopClientView
            profile={DEMO_SHOP_PROFILE}
            products={shopProducts}
          />
        </main>

        <MarketplaceFooter />
      </div>
    </MarketplaceProvider>
  );
}
