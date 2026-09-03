"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  ShieldCheck,
  Truck,
  Info,
  Laptop,
  Smartphone,
  Headphones,
  Gamepad2,
  Cpu,
  Layers,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { toast } from "sonner";

export default function CartPage() {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalCartCount,
    cartSubtotal,
  } = useMarketplace();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(price);

  const shippingCost = cartSubtotal > 10000 || cartSubtotal === 0 ? 0 : 150;
  const grandTotal = cartSubtotal + shippingCost;

  const getFallbackIcon = (category: string) => {
    switch (category) {
      case "Laptops":
        return <Laptop className="size-8 text-[#65486f]" />;
      case "Mobile":
        return <Smartphone className="size-8 text-[#65486f]" />;
      case "Audio":
        return <Headphones className="size-8 text-[#65486f]" />;
      case "Gaming":
        return <Gamepad2 className="size-8 text-[#65486f]" />;
      case "Components":
        return <Cpu className="size-8 text-[#65486f]" />;
      default:
        return <Layers className="size-8 text-[#65486f]" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#d6cbd5] mb-1">
            <Link
              href="/marketplace"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Shopping Cart
            </h1>
            {totalCartCount > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-bold bg-[#65486f] text-white rounded-full">
                {totalCartCount} items
              </span>
            )}
          </div>
        </div>

        {cartItems.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearCart();
              toast.info("Cart cleared.");
            }}
            className="text-xs font-semibold text-[#d6cbd5] hover:text-rose-300 transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Cart Items vs Empty State */}
      {cartItems.length === 0 ? (
        <div className="w-full bg-[#241c27] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-xl my-4 min-h-[230px] sm:min-h-[280px] flex flex-col items-center justify-center">
          <div className="size-12 sm:size-14 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
            <ShoppingCart className="size-6 sm:size-7 stroke-[1.5]" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">Your cart is empty</h2>
          <p className="text-xs text-[#d6cbd5] max-w-sm mx-auto leading-relaxed">
            Discover technology worth giving a second story across verified sellers in Cebu.
          </p>
          <div className="pt-2">
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-white rounded-xl transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Cart Items List (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.product.id}
                className="bg-[#241c27] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md transition-all"
              >
                {/* Product Thumbnail */}
                <Link
                  href={`/marketplace/products/${item.product.id}`}
                  className="size-20 sm:size-24 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden shadow-inner p-1.5 bg-[#ebe2e5] border border-[#ded0d5] group"
                >
                  {item.product.image ? (
                    <Image
                      src={item.product.image}
                      alt={item.product.name}
                      width={96}
                      height={96}
                      className="size-full object-contain pointer-events-none group-hover:scale-105 transition-transform duration-150"
                    />
                  ) : (
                    getFallbackIcon(item.product.category)
                  )}
                </Link>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#342339] text-[#e59bc9] rounded-md">
                      {item.product.category}
                    </span>
                    <span className="text-[10px] text-[#d6cbd5]">
                      Condition: {item.product.condition}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-bold text-white truncate hover:text-[#e59bc9] transition-colors">
                    <Link href={`/marketplace/products/${item.product.id}`}>
                      {item.product.name}
                    </Link>
                  </h3>

                  <p className="text-xs text-[#d6cbd5] truncate">
                    Sold by {item.product.sellerName} ({item.product.location})
                  </p>

                  <div className="text-sm font-extrabold text-[#e59bc9] pt-1">
                    {formatPrice(item.product.price * item.quantity)}
                    {item.quantity > 1 && (
                      <span className="text-[11px] font-normal text-[#d6cbd5] ml-2">
                        ({formatPrice(item.product.price)} each)
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls & Remove */}
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                  <div className="flex items-center gap-2 bg-[#342339] border border-white/10 rounded-xl p-1">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${item.product.name}`}
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="size-7 rounded-lg bg-[#241c27] hover:bg-[#45304b] text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="size-3.5" />
                    </button>

                    <span className="w-8 text-center text-xs font-bold text-white">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.product.name}`}
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="size-7 rounded-lg bg-[#241c27] hover:bg-[#45304b] text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remove ${item.product.name} from cart`}
                    onClick={() => {
                      removeFromCart(item.product.id);
                      toast.info(`Removed "${item.product.name}" from cart.`);
                    }}
                    className="p-2 text-[#d6cbd5] hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Order Summary (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 space-y-5 shadow-xl">
              <h2 className="text-lg font-bold text-white pb-3 border-b border-white/10">
                Order Summary
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between text-[#d6cbd5]">
                  <span>Items Subtotal ({totalCartCount})</span>
                  <span className="font-semibold text-white">
                    {formatPrice(cartSubtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#d6cbd5]">
                  <span>Estimated Visayas Delivery</span>
                  <span className="font-semibold text-white">
                    {shippingCost === 0 ? "FREE" : formatPrice(shippingCost)}
                  </span>
                </div>

                {shippingCost === 0 && (
                  <div className="text-[11px] text-emerald-400 font-medium">
                    ✓ Free shipping unlocked (orders over ₱10,000)
                  </div>
                )}

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-sm">
                  <span className="font-bold text-white">Estimated Total</span>
                  <span className="font-extrabold text-base text-[#e59bc9]">
                    {formatPrice(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Notice & Demo Checkout Button */}
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  disabled
                  className="w-full py-3 bg-[#65486f]/50 border border-white/10 text-[#fffafa]/60 text-xs font-semibold rounded-xl cursor-not-allowed text-center shadow-xs"
                >
                  Proceed to Checkout
                </button>

                <div className="flex items-start gap-2 p-3 bg-[#342339]/60 border border-white/10 rounded-xl text-[11px] text-[#d6cbd5] leading-relaxed">
                  <Info className="size-4 text-[#e59bc9] shrink-0 mt-0.5" />
                  <span>
                    Checkout will become available after backend integration.
                  </span>
                </div>
              </div>

              {/* Guarantees / Expectations */}
              <div className="pt-4 border-t border-white/10 space-y-2 text-[11px] text-[#d6cbd5]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                  <span>Buyer protection will be enabled with the secure transaction system.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="size-3.5 text-pink-300 shrink-0" />
                  <span>Delivery and meetup options will be configured during checkout development.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
