import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";

export default function SellerRouteLayout({ children }: { children: React.ReactNode }) {
  return <MarketplaceShell>{children}</MarketplaceShell>;
}
