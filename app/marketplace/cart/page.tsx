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
  Banknote,
  CreditCard,
  Info,
  CheckCircle2,
  Package,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";
import {
  checkoutCart,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel,
} from "@/lib/supabase/orders";
import { DbDeliveryMethod, DbPaymentMethod } from "@/lib/supabase/types";
import { toast } from "sonner";

function CartItemSkeleton() {
  return (
    <div className="bg-[#241c27] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md animate-pulse">
      {/* Product Thumbnail placeholder */}
      <div className="size-20 sm:size-24 rounded-xl bg-[#342339]/60 shrink-0" />

      {/* Details placeholder */}
      <div className="flex-1 min-w-0 space-y-2 w-full sm:w-auto">
        {/* Category & Condition tags */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 bg-[#342339] rounded-md" />
          <div className="h-3 w-20 bg-white/5 rounded" />
        </div>

        {/* Product title */}
        <div className="h-4 w-3/4 sm:w-2/3 bg-white/10 rounded" />

        {/* Seller info */}
        <div className="h-3 w-1/2 sm:w-1/3 bg-white/5 rounded" />

        {/* Price */}
        <div className="h-4 w-24 bg-white/10 rounded pt-0.5" />
      </div>

      {/* Quantity & Action area */}
      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
        <div className="h-9 w-24 bg-[#342339] border border-white/10 rounded-xl" />
        <div className="size-8 bg-white/5 rounded-xl" />
      </div>
    </div>
  );
}

function CartSummarySkeleton() {
  return (
    <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 space-y-5 shadow-xl animate-pulse">
      <div className="h-5 w-32 bg-white/10 rounded pb-3 border-b border-white/10" />

      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-28 bg-white/5 rounded" />
          <div className="h-3.5 w-16 bg-white/10 rounded" />
        </div>

        <div className="flex items-center justify-between">
          <div className="h-3.5 w-36 bg-white/5 rounded" />
          <div className="h-3.5 w-14 bg-white/10 rounded" />
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <div className="h-4 w-24 bg-white/10 rounded" />
          <div className="h-5 w-20 bg-[#e59bc9]/30 rounded" />
        </div>
      </div>

      {/* Checkout button placeholder */}
      <div className="pt-2">
        <div className="h-11 w-full bg-[#65486f]/40 rounded-xl" />
      </div>

      {/* Guarantees placeholder */}
      <div className="pt-4 border-t border-white/10 space-y-2">
        <div className="h-3 w-3/4 bg-white/5 rounded" />
        <div className="h-3 w-2/3 bg-white/5 rounded" />
      </div>
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const { userId, isLoading: isAccountLoading } = useMarketplaceAccount();
  const {
    cartItems,
    isCartLoading,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart,
    resetLocalCart,
    totalCartCount,
    cartSubtotal,
  } = useMarketplace();

  React.useEffect(() => {
    if (!isAccountLoading && !userId) {
      router.replace("/login?redirectTo=/marketplace/cart");
    }
  }, [isAccountLoading, userId, router]);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DbDeliveryMethod>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<DbPaymentMethod>("cash_on_delivery");
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [buyerNote, setBuyerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    orderIds: string[];
    sellerCount: number;
    deliveryMethod: DbDeliveryMethod;
    paymentMethod: DbPaymentMethod;
    grandTotal: number;
    shippingName?: string;
    shippingAddress?: string;
  } | null>(null);

  const handleDeliveryMethodChange = (newMethod: DbDeliveryMethod) => {
    setDeliveryMethod(newMethod);
    if (newMethod === "delivery" && paymentMethod === "cash_on_meetup") {
      setPaymentMethod("cash_on_delivery");
    } else if (newMethod === "meetup" && paymentMethod === "cash_on_delivery") {
      setPaymentMethod("cash_on_meetup");
    }
  };

  const paymentOptions = React.useMemo(() => {
    if (deliveryMethod === "delivery") {
      return [
        {
          id: "cash_on_delivery" as DbPaymentMethod,
          title: "Cash on Delivery (COD)",
          subtitle: "Pay in cash directly to courier upon delivery",
          icon: <Banknote className="size-4 text-[#e59bc9]" />,
        },
        {
          id: "manual_gcash" as DbPaymentMethod,
          title: "GCash (Manual Transfer)",
          subtitle: "Direct e-wallet transfer; verify receipt via chat",
          icon: <Smartphone className="size-4 text-[#e59bc9]" />,
        },
        {
          id: "manual_maya" as DbPaymentMethod,
          title: "Maya (Manual Transfer)",
          subtitle: "Direct e-wallet transfer; verify receipt via chat",
          icon: <CreditCard className="size-4 text-[#e59bc9]" />,
        },
      ];
    }
    return [
      {
        id: "cash_on_meetup" as DbPaymentMethod,
        title: "Cash on Meetup",
        subtitle: "Pay in cash in-person upon meeting the seller",
        icon: <Banknote className="size-4 text-[#e59bc9]" />,
      },
      {
        id: "manual_gcash" as DbPaymentMethod,
        title: "GCash (Manual Transfer)",
        subtitle: "Direct e-wallet transfer; verify receipt via chat",
        icon: <Smartphone className="size-4 text-[#e59bc9]" />,
      },
      {
        id: "manual_maya" as DbPaymentMethod,
        title: "Maya (Manual Transfer)",
        subtitle: "Direct e-wallet transfer; verify receipt via chat",
        icon: <CreditCard className="size-4 text-[#e59bc9]" />,
      },
    ];
  }, [deliveryMethod]);

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
        paymentMethod,
        shippingName,
        shippingPhone,
        shippingAddress,
        buyerNote,
      });

      const confirmationData = {
        orderIds,
        sellerCount,
        deliveryMethod,
        paymentMethod,
        grandTotal: overallGrandTotal,
        shippingName: shippingName.trim() || undefined,
        shippingAddress: shippingAddress.trim() || undefined,
      };

      // Synchronize client cart state without sending an unnecessary second DELETE request
      resetLocalCart();
      await refreshCart();

      toast.success(
        orderIds.length > 1
          ? `Successfully placed ${orderIds.length} orders across ${sellerCount} shops!`
          : "Order placed successfully!"
      );

      setIsSubmitting(false);
      setIsCheckoutOpen(false);
      setConfirmation(confirmationData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again.";
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  if (!isAccountLoading && !userId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
        <p className="text-sm text-[#b9adb6]">Redirecting to login...</p>
      </div>
    );
  }

  const isPageLoading = isAccountLoading || isCartLoading;

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
            {isPageLoading ? (
              <span className="w-14 h-5 rounded-full bg-white/10 animate-pulse inline-block" />
            ) : totalCartCount > 0 ? (
              <span className="px-2.5 py-0.5 text-xs font-bold bg-[#65486f] text-white rounded-full">
                {totalCartCount} items
              </span>
            ) : null}
          </div>
        </div>

        {!isPageLoading && cartItems.length > 0 && (
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

      {/* Cart Items vs Skeleton vs Empty State */}
      {isPageLoading ? (
        <div
          className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          aria-busy="true"
          aria-label="Loading shopping cart"
        >
          {/* Left Column: Cart Items Skeleton (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <CartItemSkeleton />
            <CartItemSkeleton />
            <CartItemSkeleton />
          </div>

          {/* Right Column: Order Summary Skeleton (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <CartSummarySkeleton />
          </div>
        </div>
      ) : cartItems.length === 0 ? (
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
                    onClick={() => handleDeliveryMethodChange("delivery")}
                    className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
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
                    onClick={() => handleDeliveryMethodChange("meetup")}
                    className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
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

              {/* Payment Method Selector */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-white uppercase tracking-wider block">
                  Payment Method
                </label>
                <div
                  role="radiogroup"
                  aria-label="Payment method selection"
                  className="space-y-2"
                >
                  {paymentOptions.map((opt) => {
                    const isSelected = paymentMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setPaymentMethod(opt.id)}
                        className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#342339] border-[#e59bc9] ring-1 ring-[#e59bc9]/30"
                            : "bg-[#241c27] border-white/10 hover:border-white/20 hover:bg-[#2a202e]"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          <div
                            className={`size-4 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? "border-[#e59bc9] bg-[#e59bc9]"
                                : "border-white/30 bg-transparent"
                            }`}
                          >
                            {isSelected && (
                              <div className="size-1.5 rounded-full bg-[#1e1322]" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {opt.icon}
                            <span className="text-xs font-bold text-white">
                              {opt.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#b9adb6] mt-0.5">
                            {opt.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Manual E-Wallet Notice */}
                {(paymentMethod === "manual_gcash" || paymentMethod === "manual_maya") && (
                  <div className="mt-2.5 p-3 bg-[#342339]/60 border border-[#e59bc9]/30 rounded-xl text-xs space-y-1 animate-in fade-in duration-150">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <Info className="size-3.5 text-[#e59bc9] shrink-0" />
                      <span>Manual Payment Verification Required</span>
                    </div>
                    <p className="text-[11px] text-[#d6cbd5] leading-relaxed">
                      Manual payment verification will be required. You and the seller will coordinate payment confirmation and receipt verification via CircuitCart chat. Your order will be placed with payment status <strong>pending</strong>.
                    </p>
                  </div>
                )}
              </div>

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

      {/* Post-Checkout Order Confirmation Modal */}
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#1e1322] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 sm:p-7 border-b border-white/10 text-center space-y-3 bg-[#241728]/50">
              <div className="size-14 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="size-7 stroke-[2]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Order Placed Successfully
                </h2>
                <p className="text-xs text-[#b9adb6] mt-1 max-w-sm mx-auto">
                  {confirmation.orderIds.length > 1
                    ? `Your checkout created ${confirmation.orderIds.length} orders across ${confirmation.sellerCount} verified shops.`
                    : "Your order has been submitted to the seller for fulfillment."}
                </p>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-6 sm:p-7 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Summary Card */}
              <div className="p-4 bg-[#241c27] border border-white/10 rounded-2xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#b9adb6]">Orders Created:</span>
                  <span className="font-bold text-white">
                    {confirmation.orderIds.length}{" "}
                    {confirmation.orderIds.length === 1 ? "Order" : "Orders"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#b9adb6]">Fulfillment Method:</span>
                  <span className="font-semibold text-white capitalize flex items-center gap-1.5">
                    {confirmation.deliveryMethod === "delivery" ? (
                      <>
                        <Truck className="size-3.5 text-[#e59bc9]" />
                        <span>Delivery (Direct Courier)</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="size-3.5 text-[#e59bc9]" />
                        <span>Local Meetup (Cebu)</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#b9adb6]">Payment Method:</span>
                  <span className="font-semibold text-white">
                    {formatPaymentMethodLabel(confirmation.paymentMethod)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#b9adb6]">Payment Status:</span>
                  <span
                    className={`font-semibold ${
                      confirmation.paymentMethod === "manual_gcash" ||
                      confirmation.paymentMethod === "manual_maya"
                        ? "text-amber-400"
                        : "text-amber-300"
                    }`}
                  >
                    {formatPaymentStatusLabel("pending", confirmation.paymentMethod)}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between font-bold">
                  <span className="text-white">Total Amount Due:</span>
                  <span className="text-base text-[#e59bc9]">
                    {formatPrice(confirmation.grandTotal)}
                  </span>
                </div>
              </div>

              {/* Contextual Payment Explanation Box */}
              <div className="p-3.5 bg-[#342339]/60 border border-white/10 rounded-2xl text-xs space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Info className="size-4 text-[#e59bc9] shrink-0" />
                  <span>Next Steps & Payment Guidance</span>
                </div>
                <p className="text-[11px] text-[#d6cbd5] leading-relaxed">
                  {confirmation.paymentMethod === "cash_on_delivery" && (
                    <>
                      Payment will be collected in cash when your order is delivered to your address. Please prepare exact payment for the courier.
                    </>
                  )}
                  {confirmation.paymentMethod === "cash_on_meetup" && (
                    <>
                      Payment will be completed in cash in-person when you meet the seller. You can test and inspect the item before finalizing payment.
                    </>
                  )}
                  {(confirmation.paymentMethod === "manual_gcash" ||
                    confirmation.paymentMethod === "manual_maya") && (
                    <>
                      Please coordinate payment transfer and receipt verification directly with the seller via CircuitCart chat. Your order will be fulfilled once the seller verifies your transaction receipt.
                    </>
                  )}
                </p>
                <p className="text-[10px] text-[#8f7d8c] pt-1">
                  * Successful order placement does not mean payment is complete. Order status and payment status are tracked independently.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmation(null);
                    router.push("/marketplace/orders");
                  }}
                  className="w-full py-3 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Package className="size-4" />
                  <span>View My Orders</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmation(null);
                    router.push("/marketplace");
                  }}
                  className="w-full py-2.5 bg-white/[0.05] hover:bg-white/10 text-[#d6cbd5] hover:text-white border border-white/10 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue Shopping</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

