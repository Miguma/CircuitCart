"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  Home,
  Plus,
  ShoppingCart,
  User,
} from "lucide-react";
import { useMarketplace } from "./marketplace-provider";

const NAV_ITEMS = [
  { href: "/marketplace", label: "Home", icon: Home },
  { href: "/marketplace/favorites", label: "Saved", icon: Heart },
  { href: "/marketplace/cart", label: "Cart", icon: ShoppingCart },
  { href: "/marketplace/profile", label: "Profile", icon: User },
] as const;

export function MarketplaceMobileNav() {
  const pathname = usePathname();
  const { favorites, totalCartCount } = useMarketplace();

  const isActive = (href: string) =>
    href === "/marketplace" ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      aria-label="Marketplace mobile navigation"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden"
    >
      <div className="relative mx-auto grid h-16 max-w-md grid-cols-5 items-center rounded-2xl border border-white/15 bg-[#211724]/95 px-2 shadow-[0_18px_50px_rgba(15,9,17,0.45)] backdrop-blur-xl">
        {NAV_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9] ${
                active
                  ? "bg-white/10 text-[#fffafa]"
                  : "text-[#b9adb6] hover:bg-white/5 hover:text-[#fffafa]"
              }`}
            >
              <Icon className={`size-[18px] ${active ? "text-[#e59bc9]" : ""}`} />
              <span>{item.label}</span>
              {item.label === "Saved" && favorites.length > 0 && (
                <span className="absolute right-3 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-[#b78bd7] px-1 text-[9px] font-extrabold text-[#19131b]">
                  {favorites.length}
                </span>
              )}
            </Link>
          );
        })}

        <Link
          href="/marketplace/sell"
          aria-label="Sell an item"
          aria-current={pathname.startsWith("/marketplace/sell") ? "page" : undefined}
          className="group relative -mt-7 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-[#fffafa] focus-visible:outline-none"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/20 bg-[#65486f] shadow-[0_8px_22px_rgba(25,19,27,0.45)] transition-transform group-hover:-translate-y-0.5 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#e59bc9] motion-reduce:transform-none">
            <Plus className="size-5 text-[#fffafa]" />
          </span>
          <span>Sell</span>
        </Link>

        {NAV_ITEMS.slice(2).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9] ${
                active
                  ? "bg-white/10 text-[#fffafa]"
                  : "text-[#b9adb6] hover:bg-white/5 hover:text-[#fffafa]"
              }`}
            >
              <Icon className={`size-[18px] ${active ? "text-[#e59bc9]" : ""}`} />
              <span>{item.label}</span>
              {item.label === "Cart" && totalCartCount > 0 && (
                <span className="absolute right-3 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-[#e59bc9] px-1 text-[9px] font-extrabold text-[#19131b]">
                  {totalCartCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
