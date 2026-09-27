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
import { useMarketplaceAccount } from "./marketplace-account";

export function MarketplaceMobileNav() {
  const pathname = usePathname();
  const { favorites, totalCartCount } = useMarketplace();
  const { userId } = useMarketplaceAccount();

  const navItems = [
    { href: "/marketplace", label: "Home", icon: Home },
    { href: "/marketplace/favorites", label: "Saved", icon: Heart },
    { href: "/marketplace/cart", label: "Cart", icon: ShoppingCart },
    userId
      ? { href: "/marketplace/profile", label: "Profile", icon: User }
      : { href: "/login", label: "Log in", icon: User },
  ];

  const isActive = (href: string) =>
    href === "/marketplace" ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      aria-label="Marketplace mobile navigation"
      className="fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 sm:inset-x-3 md:hidden"
    >
      <div className="relative mx-auto grid h-14 max-w-md grid-cols-5 items-center rounded-2xl border cc-border cc-surface-card px-2 shadow-[0_14px_36px_rgba(15,9,17,0.38)] backdrop-blur-xl">
        {navItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9] ${
                active
                  ? "cc-surface-secondary cc-text-primary font-bold"
                  : "cc-text-muted hover:cc-surface-secondary hover:cc-text-primary"
              }`}
            >
              <Icon className={`size-[17px] ${active ? "text-[#e59bc9]" : ""}`} />
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
          className="group relative -mt-5 flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold cc-text-primary focus-visible:outline-none"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl border border-white/20 bg-[#65486f] shadow-[0_8px_22px_rgba(25,19,27,0.45)] transition-transform group-hover:-translate-y-0.5 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#e59bc9] motion-reduce:transform-none">
            <Plus className="size-[18px] text-white" />
          </span>
          <span>Sell</span>
        </Link>

        {navItems.slice(2).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9] ${
                active
                  ? "cc-surface-secondary cc-text-primary font-bold"
                  : "cc-text-muted hover:cc-surface-secondary hover:cc-text-primary"
              }`}
            >
              <Icon className={`size-[17px] ${active ? "text-[#e59bc9]" : ""}`} />
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
