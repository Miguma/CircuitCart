"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  ShieldCheck,
  Truck,
  MapPin,
  Laptop,
  Smartphone,
  Headphones,
  Gamepad2,
  Cpu,
  Layers,
  Loader2,
  X,
  Store,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { checkoutCart } from "@/lib/supabase/orders";
import { DbDeliveryMethod } from "@/lib/supabase/types";
import { toast } from "sonner";

export default function CartPage() {
  const router = useRouter();
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart,
    resetLocalCart,
    totalCartCount,
    cartSubtotal,
  } = useMarketplace();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DbDeliveryMethod>("delivery");
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [buyerNote, setBuyerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(price);

  // Group cart items by shop/seller for accurate multi-order & shipping fee calculation
  const sellerGroups = React.useMemo(() => {
    const map = new Map<string, { sellerName: string; items: typeof cartItems }>();

    for (const item of cartItems) {
      const key =
        item.product.shopId ||
        item.product.sellerId ||
        item.product.sellerName ||
        "verified-seller";
      const name = item.product.sellerName || "Verified Seller";
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, { sellerName: name, items: [item] });
      }
    }

    return Array.from(map.entries()).map(([key, data]) => {
      const subtotal = data.items.reduce(
        (sum, it) => sum + it.product.price * it.quantity,
        0
      );
      const shippingFee =
        deliveryMethod === "meetup" || subtotal >= 10000 || subtotal === 0
          ? 0
          : 150;
      const total = subtotal + shippingFee;

      return {
        sellerKey: key,
        sellerName: data.sellerName,
        items: data.items,
        subtotal,
        shippingFee,
        total,
      };
    });
  }, [cartItems, deliveryMethod]);

  const sellerCount = sellerGroups.length;

  const overallShippingTotal = React.useMemo(
    () => sellerGroups.reduce((acc, g) => acc + g.shippingFee, 0),
    [sellerGroups]
  );

  const overallGrandTotal = cartSubtotal + overallShippingTotal;

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

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    if (deliveryMethod === "delivery") {
      if (!shippingName.trim()) {
        toast.error("Please enter your recipient name.");
        return;
      }
      if (!shippingPhone.trim()) {
        toast.error("Please enter your contact phone number.");
        return;
      }
      if (!shippingAddress.trim()) {
        toast.error("Please enter your complete delivery address.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const orderIds = await checkoutCart({
        deliveryMethod,
        shippingName,
        shippingPhone,
        shippingAddress,
        buyerNote,
      });

      // Synchronize client cart state without sending an unnecessary second DELETE request
      resetLocalCart();
      await refreshCart();

      toast.success(
        orderIds.length > 1
          ? `Successfully placed ${orderIds.length} orders across different shops!`
          : "Order placed successfully!"
      );

      setIsCheckoutOpen(false);
      router.push("/marketplace/orders");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again.";
      toast.error(msg);
      setIsSubmitting(false);
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
                      disabled={item.product.stock !== undefined && item.quantity >= item.product.stock}
                      className="size-7 rounded-lg bg-[#241c27] hover:bg-[#45304b] text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
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
                    {overallShippingTotal === 0 ? "FREE" : formatPrice(overallShippingTotal)}
                  </span>
                </div>

                {overallShippingTotal === 0 && cartSubtotal >= 10000 && (
                  <div className="text-[11px] text-emerald-400 font-medium">
                    ✓ Free shipping unlocked (orders over ₱10,000)
                  </div>
                )}

                {sellerCount > 1 && (
                  <div className="p-3 bg-[#342339]/70 border border-[#e59bc9]/20 rounded-xl space-y-1.5 text-[11px]">
                    <div className="font-bold text-[#e59bc9]">
                      Multi-Store Order ({sellerCount} separate stores)
                    </div>
                    <div className="space-y-1 text-[#d6cbd5] divide-y divide-white/5">
                      {sellerGroups.map((g) => (
                        <div key={g.sellerKey} className="flex items-center justify-between pt-1 first:pt-0">
                          <span className="truncate max-w-[140px] text-white/90 font-medium">
                            {g.sellerName}
                          </span>
                          <span className="font-mono text-white/80 shrink-0">
                            {formatPrice(g.subtotal)} {g.shippingFee > 0 ? `(+${formatPrice(g.shippingFee)})` : "(Free Ship)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-sm">
                  <span className="font-bold text-white">Estimated Total</span>
                  <span className="font-extrabold text-base text-[#e59bc9]">
                    {formatPrice(overallGrandTotal)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full py-3 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-semibold rounded-xl transition-colors text-center shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
                >
                  Proceed to Checkout
                </button>
              </div>

              {/* Guarantees */}
              <div className="pt-4 border-t border-white/10 space-y-2 text-[11px] text-[#d6cbd5]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                  <span>Verified seller warranty & buyer protection enabled.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="size-3.5 text-pink-300 shrink-0" />
                  <span>Fast delivery across Cebu and Central Visayas.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal / Drawer */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#1e1322] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white">
                  Checkout Order
                </h2>
                <p className="text-xs text-[#b9adb6] mt-0.5">
                  Confirm your fulfillment and delivery details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1.5 rounded-full text-[#b9adb6] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCheckoutSubmit} className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Delivery Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider block">
                  Fulfillment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("delivery")}
                    className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      deliveryMethod === "delivery"
                        ? "bg-[#342339] border-[#e59bc9] text-white"
                        : "bg-[#241c27] border-white/10 text-[#b9adb6] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Truck className="size-4 text-[#e59bc9]" />
                      <span className="text-xs font-bold text-white">Delivery</span>
                    </div>
                    <span className="text-[10px] text-[#b9adb6]">
                      Direct to address via courier
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("meetup")}
                    className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      deliveryMethod === "meetup"
                        ? "bg-[#342339] border-[#e59bc9] text-white"
                        : "bg-[#241c27] border-white/10 text-[#b9adb6] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-[#e59bc9]" />
                      <span className="text-xs font-bold text-white">Local Meetup</span>
                    </div>
                    <span className="text-[10px] text-[#b9adb6]">
                      Meet seller in Cebu City / IT Park
                    </span>
                  </button>
                </div>
              </div>

              {/* Delivery Info Inputs (if Delivery) */}
              {deliveryMethod === "delivery" ? (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-[#d6cbd5] block mb-1">
                      Recipient Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingName}
                      onChange={(e) => setShippingName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full px-3.5 py-2.5 bg-[#241c27] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#716872] focus:outline-none focus:border-[#e59bc9]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#d6cbd5] block mb-1">
                      Contact Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                      placeholder="+63 900 000 0000"
                      className="w-full px-3.5 py-2.5 bg-[#241c27] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#716872] focus:outline-none focus:border-[#e59bc9]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#d6cbd5] block mb-1">
                      Delivery Address *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="Street address, Barangay, City, Province"
                      className="w-full px-3.5 py-2.5 bg-[#241c27] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#716872] focus:outline-none focus:border-[#e59bc9] resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#342339]/60 border border-white/10 rounded-xl text-xs text-[#d6cbd5] space-y-1">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Store className="size-3.5 text-[#e59bc9]" />
                    <span>Meetup Policy</span>
                  </div>
                  <p className="text-[11px] text-[#b9adb6]">
                    You and the seller will coordinate meetup timing and exact location upon order confirmation.
                  </p>
                </div>
              )}

              {/* Optional Buyer Notes */}
              <div>
                <label className="text-xs font-semibold text-[#d6cbd5] block mb-1">
                  Buyer Notes (Optional)
                </label>
                <input
                  type="text"
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="Special instructions or meetup preference"
                  className="w-full px-3.5 py-2.5 bg-[#241c27] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#716872] focus:outline-none focus:border-[#e59bc9]"
                />
              </div>

              {/* Total & Action */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs text-[#d6cbd5]">
                  <span>Total Amount Due:</span>
                  <span className="text-base font-extrabold text-[#e59bc9]">
                    {formatPrice(overallGrandTotal)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Processing Order...</span>
                    </>
                  ) : (
                    <span>Place Order ({formatPrice(overallGrandTotal)})</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

