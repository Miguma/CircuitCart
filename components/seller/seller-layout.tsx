"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, PlusCircle } from "lucide-react";

import { Suspense } from "react";
import { GuidedTourController } from "@/components/tour";

interface SellerLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showAddProduct?: boolean;
  hidePageHeading?: boolean;
  isVerificationOnlyNav?: boolean;
}

const MANAGEMENT_LINKS = [
  { href: "/seller", label: "Overview", dataTour: "seller-overview" },
  { href: "/seller/products", label: "My Listings", dataTour: "seller-products" },
  { href: "/seller/orders", label: "Sales", dataTour: "seller-orders" },
  { href: "/marketplace/messages", label: "Messages", dataTour: "seller-messages" },
  { href: "/seller/shop", label: "My Shop", dataTour: "seller-shop" },
  { href: "/seller/analytics", label: "Analytics" },
  { href: "/seller/payouts", label: "Payouts" },
  { href: "/seller/verification", label: "Verification", dataTour: "seller-verification" },
];

const VERIFICATION_ONLY_LINKS = [
  { href: "/seller/verification", label: "Verification", dataTour: "seller-verification" },
];

// Seller routes retain their existing logic inside the shared marketplace shell.
export function SellerLayout({
  children,
  title,
  subtitle,
  showAddProduct = true,
  hidePageHeading = false,
  isVerificationOnlyNav = false,
}: SellerLayoutProps) {
  const pathname = usePathname();
  const navLinks = isVerificationOnlyNav ? VERIFICATION_ONLY_LINKS : MANAGEMENT_LINKS;

  return (
    <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <Suspense fallback={null}>
        <GuidedTourController tourId="seller" triggerLabel="Tour Seller Studio" />
      </Suspense>
      <nav aria-label="Selling tools" className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {navLinks.map((item) => (
          <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}
            data-tour={item.dataTour}
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${pathname === item.href ? "border-[#eadcde] bg-[#f8f3f3] text-[#1d1720]" : "border-white/10 bg-[#342339]/80 text-[#fffafa] hover:bg-[#45304b]"}`}>
            {item.label}
          </Link>
        ))}
      </nav>
      {!hidePageHeading && title && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/marketplace" className="mb-2 inline-flex items-center gap-1.5 text-xs text-[#d6cbd5] hover:text-white">
              <ArrowLeft className="size-3.5" /> Marketplace
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#fffafa]">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-[#d6cbd5]">{subtitle}</p>}
          </div>
          {showAddProduct && <Link href="/sell" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#65486f] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#7a5985] focus-visible:outline-2 focus-visible:outline-[#e59bc9]">
            <PlusCircle className="size-4 text-[#e59bc9]" /> Create Listing
          </Link>}
        </div>
      )}
      {children}
    </main>
  );
}
