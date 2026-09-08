import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";

export default function CreateListingLayout({ children }: { children: React.ReactNode }) {
  return <MarketplaceShell>{children}</MarketplaceShell>;
}
