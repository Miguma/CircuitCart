import React from "react";
import { notFound } from "next/navigation";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceProvider } from "@/components/marketplace/marketplace-provider";
import { type SellerShopProfile } from "@/lib/seller/seller-data";
import { Product } from "@/components/marketplace/marketplace-data";
import { getShopBySlug } from "@/lib/supabase/shops";
import { getMarketplaceProducts } from "@/lib/supabase/products";
import { PublicShopClientView } from "./public-shop-client-view";

export function generateStaticParams() {
  return [{ slug: "techvault-cebu" }];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicShopPage({ params }: PageProps) {
  const { slug } = await params;

  const dbShop = await getShopBySlug(slug).catch((err) => {
    console.warn("Could not load shop from Supabase:", err);
    return null;
  });

  if (!dbShop) {
    notFound();
  }

  const profile: SellerShopProfile = {
    id: dbShop.id,
    shopName: dbShop.name,
    slug: dbShop.slug,
    description: dbShop.description || "Welcome to our CircuitCart store.",
    logo: dbShop.logo_url || undefined,
    banner: dbShop.banner_url || undefined,
    location: dbShop.location || "Cebu City, Central Visayas",
    contactPreference: "CircuitCart Chat",
    businessType: "Individual Tech Seller",
    memberSince: new Date(dbShop.created_at).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    }),
    rating: 5.0,
    reviewCount: 0,
    completedOrders: 0,
    responseRate: 100,
    isVerified: dbShop.is_verified,
    shopStatus: dbShop.status === "vacation" ? "Vacation Mode" : "Active",
    fulfillmentPreference: "Both",
    defaultMeetupArea: dbShop.location || "Cebu IT Park, Lahug",
    handlingTime: "Ships or meets within 24 hours",
  };

  // Fetch active products for this shop
  let shopProducts: Product[] = [];
  try {
    const allActive = await getMarketplaceProducts();
    shopProducts = allActive.filter(
      (p) => p.sellerName === dbShop.name || p.sellerId === dbShop.owner_id
    );
  } catch (err) {
    console.warn("Could not load shop products from Supabase:", err);
    shopProducts = [];
  }


  return (
    <MarketplaceProvider>
      <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] flex flex-col font-sans">
        <MarketplaceHeader />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
          <PublicShopClientView
            profile={profile}
            products={shopProducts}
          />
        </main>

        <MarketplaceFooter />
      </div>
    </MarketplaceProvider>
  );
}
