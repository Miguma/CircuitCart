"use client";

import React from "react";
import {
  MarketplaceProvider,
  useMarketplace,
} from "@/components/marketplace/marketplace-provider";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { QuickViewDialog } from "@/components/marketplace/quick-view-dialog";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
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
      <MarketplaceHeader />
      <div className="flex-1 w-full animate-in fade-in duration-150 motion-reduce:animate-none">{children}</div>
      <MarketplaceFooter />

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
