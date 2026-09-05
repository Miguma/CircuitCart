"use client";

import React from "react";
import {
  MarketplaceProvider,
  useMarketplace,
} from "@/components/marketplace/marketplace-provider";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { QuickViewDialog } from "@/components/marketplace/quick-view-dialog";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceMobileNav } from "@/components/marketplace/marketplace-mobile-nav";
import { Toaster, toast } from "sonner";

function MarketplaceLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    quickViewProduct,
    setQuickViewProduct,
    isFavorite,
    toggleFavorite,
    addToCart,
  } = useMarketplace();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] flex flex-col font-sans">
      <a
        href="#marketplace-content"
        className="fixed left-4 top-3 z-[70] -translate-y-20 rounded-xl bg-[#f8f3f3] px-4 py-2 text-sm font-bold text-[#1d1720] shadow-xl transition-transform focus:translate-y-0 motion-reduce:transition-none"
      >
        Skip to marketplace content
      </a>
      <MarketplaceHeader />
      <div
        id="marketplace-content"
        tabIndex={-1}
        className="flex-1 w-full pb-24 animate-in fade-in duration-150 focus:outline-none motion-reduce:animate-none md:pb-0"
      >
        {children}
      </div>
      <MarketplaceFooter />
      <MarketplaceMobileNav />

      <QuickViewDialog
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isWishlisted={
          quickViewProduct ? isFavorite(quickViewProduct.id) : false
        }
        onToggleWishlist={toggleFavorite}
        onAddToCart={(prod) => {
          addToCart(prod);
          toast.success(`Added "${prod.name}" to your cart!`);
        }}
      />
      <Toaster
        position="top-center"
        toastOptions={{
          className: "glass-toast font-sans text-xs font-medium",
        }}
      />
    </div>
  );
}

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MarketplaceProvider>
      <MarketplaceLayoutContent>{children}</MarketplaceLayoutContent>
    </MarketplaceProvider>
  );
}
