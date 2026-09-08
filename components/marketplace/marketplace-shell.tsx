"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";
import { MarketplaceProvider, useMarketplace } from "./marketplace-provider";
import { MarketplaceAccountProvider } from "./marketplace-account";
import { MarketplaceHeader } from "./marketplace-header";
import { MarketplaceFooter } from "./marketplace-footer";
import { MarketplaceMobileNav } from "./marketplace-mobile-nav";
import { QuickViewDialog } from "./quick-view-dialog";

function SearchNavigationSync() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.get("q");
  const { setSearchQuery } = useMarketplace();
  useEffect(() => {
    if (pathname === "/marketplace" && query !== null) setSearchQuery(query);
  }, [pathname, query, setSearchQuery]);
  return null;
}

function MarketplaceShellContent({ children }: { children: React.ReactNode }) {
  const { quickViewProduct, setQuickViewProduct, isFavorite, toggleFavorite, addToCart } = useMarketplace();
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#8f7375] via-[#3a283e] to-[#19131b] text-[#fffafa] flex flex-col font-sans">
      <Suspense fallback={null}><SearchNavigationSync /></Suspense>
      <a href="#marketplace-content" className="fixed left-4 top-3 z-[70] -translate-y-20 rounded-xl bg-[#f8f3f3] px-4 py-2 text-sm font-bold text-[#1d1720] shadow-xl transition-transform focus:translate-y-0 motion-reduce:transition-none">Skip to marketplace content</a>
      <MarketplaceHeader />
      <div id="marketplace-content" tabIndex={-1} className="flex-1 w-full pb-24 animate-in fade-in duration-150 focus:outline-none motion-reduce:animate-none md:pb-0">{children}</div>
      <MarketplaceFooter />
      <MarketplaceMobileNav />
      <QuickViewDialog product={quickViewProduct} isOpen={!!quickViewProduct} onClose={() => setQuickViewProduct(null)}
        isWishlisted={quickViewProduct ? isFavorite(quickViewProduct.id) : false} onToggleWishlist={toggleFavorite}
        onAddToCart={(product) => { addToCart(product); toast.success(`Added "${product.name}" to your cart!`); }} />
      <Toaster position="top-center" toastOptions={{ className: "glass-toast font-sans text-xs font-medium" }} />
    </div>
  );
}

export function MarketplaceShell({ children }: { children: React.ReactNode }) {
  return <MarketplaceAccountProvider><MarketplaceProvider><MarketplaceShellContent>{children}</MarketplaceShellContent></MarketplaceProvider></MarketplaceAccountProvider>;
}
