import React from "react";
import { notFound } from "next/navigation";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceProvider } from "@/components/marketplace/marketplace-provider";
import {
  DEMO_SHOP_PROFILE,
  type SellerShopProfile,
} from "@/lib/seller/seller-data";
import { DUMMY_PRODUCTS, Product } from "@/components/marketplace/marketplace-data";
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

  let profile: SellerShopProfile = DEMO_SHOP_PROFILE;
  let shopProducts: Product[] = DUMMY_PRODUCTS.slice(0, 8);
  let foundShop = false;

  // 1. Attempt to fetch real shop from Supabase
  try {
    const dbShop = await getShopBySlug(slug);
    if (dbShop) {
      foundShop = true;
      profile = {
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
      const allActive = await getMarketplaceProducts();
      const matched = allActive.filter((p) => p.sellerName === dbShop.name);
      if (matched.length > 0) {
        shopProducts = matched;
      } else {
        shopProducts = [];
      }
    }
  } catch (err) {
    console.warn("Could not load shop from Supabase:", err);
  }

  // 2. Fallback to demo profile if slug matches demo
  if (!foundShop) {
    const isDemoMatch =
      slug === DEMO_SHOP_PROFILE.slug ||
      slug === "techvault-cebu" ||
      slug === "techvault";

    if (isDemoMatch) {
      profile = DEMO_SHOP_PROFILE;
      shopProducts = DUMMY_PRODUCTS.slice(0, 8);
    } else {
      notFound();
    }
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
