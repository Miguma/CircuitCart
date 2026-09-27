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
  Clock,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";
import {
  checkoutCart,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel,
} from "@/lib/supabase/orders";
import { DbDeliveryMethod, DbPaymentMethod } from "@/lib/supabase/types";
import { cancelOnlineCheckout, readOnlineCheckout } from "@/lib/checkout/online-client";
import type { OnlineCheckout } from "@/lib/checkout/online-contract";
import { OnlinePaymentStage } from "@/components/marketplace/online-payment-stage";
import {
  deriveCardLast4,
  formatDemoCardNumber,
  formatDemoExpiry,
  isDemoPaymentEnabled,
  validateDemoCardholder,
  validateDemoCardNumber,
  validateDemoCvv,
  validateDemoExpiry,
  maskDemoCard,
} from "@/lib/payments/demo";
import { toast } from "sonner";

const onlinePreviewEnabled = process.env.NEXT_PUBLIC_ONLINE_CHECKOUT_FOUNDATION_ENABLED === "true";
const demoPaymentEnabled = isDemoPaymentEnabled();
// Failure simulation toggle renders strictly in development (never production).
const demoSimulationAllowed =
  demoPaymentEnabled && process.env.NODE_ENV === "development";

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
  const submitLock = React.useRef(false);
  const attemptId = React.useRef<string | null>(null);
  const [onlineCheckout, setOnlineCheckout] = useState<OnlineCheckout | null>(null);
  const [recoveryState, setRecoveryState] = useState<"idle" | "loading" | "error">("idle");
  const recoveryLock = React.useRef(false);
  const attemptStorageKey = `circuitcart:online-checkout:${userId}`;

  const recoverCheckout = React.useCallback(async () => {
    if (!userId || recoveryLock.current) return;
    recoveryLock.current = true;
    setRecoveryState("loading");
    try {
      // Active checkout first: this also recovers across tabs or lost local storage.
      const active = await readOnlineCheckout();
      const recovered = active || (attemptId.current ? await readOnlineCheckout(attemptId.current) : null);
      setOnlineCheckout(recovered);
      if (recovered && ["created", "pending", "authorized"].includes(recovered.paymentStatus)) {
        attemptId.current = recovered.attemptId;
      } else {
        attemptId.current = null;
        try { localStorage.removeItem(attemptStorageKey); } catch { /* Server recovery remains available. */ }
      }
      await refreshCart({ preserveOnError: true });
      setRecoveryState("idle");
    } catch {
      setRecoveryState("error");
    } finally {
      recoveryLock.current = false;
    }
  }, [userId, attemptStorageKey, refreshCart]);

  React.useEffect(() => {
    if (!userId) return;
    try { attemptId.current = localStorage.getItem(attemptStorageKey); } catch { attemptId.current = null; }
    if (onlinePreviewEnabled || attemptId.current) void recoverCheckout();
  }, [userId, attemptStorageKey, recoverCheckout]);

  React.useEffect(() => {
    if (onlineCheckout?.paymentStatus !== "created") return;
    const timeout = window.setTimeout(() => void recoverCheckout(), Math.max(0, Date.parse(onlineCheckout.expiresAt) - Date.now()) + 250);
    return () => window.clearTimeout(timeout);
  }, [onlineCheckout?.paymentStatus, onlineCheckout?.expiresAt, recoverCheckout]);

  const handleCancelOnlineCheckout = async () => {
    if (!onlineCheckout || recoveryLock.current || submitLock.current) return;
    if (!confirm("Cancel this entire unpaid checkout, including all seller orders, and release its reserved stock?")) return;
    recoveryLock.current = true;
    setRecoveryState("loading");
    try {
      const cancelled = await cancelOnlineCheckout(onlineCheckout.attemptId);
      setOnlineCheckout(cancelled);
      attemptId.current = null;
      try { localStorage.removeItem(attemptStorageKey); } catch { /* Authenticated recovery remains available. */ }
      await refreshCart({ preserveOnError: true });
      setRecoveryState("idle");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel checkout.");
      setRecoveryState("error");
    } finally { recoveryLock.current = false; }
  };
  const [confirmation, setConfirmation] = useState<{
    orderIds: string[];
    sellerCount: number;
    deliveryMethod: DbDeliveryMethod;
    paymentMethod: DbPaymentMethod;
    grandTotal: number;
    shippingName?: string;
    shippingAddress?: string;
    demo?: {
      reference: string;
      cardLast4: string;
      paymentTransactionId: string;
    };
  } | null>(null);

  // Demo Card form state. Raw PAN/CVV/expiry live only here and are discarded
  // from memory immediately after the last4 is derived on submit.
  const [demoCardName, setDemoCardName] = useState("");
  const [demoCardNumber, setDemoCardNumber] = useState("");
  const [demoCardExpiry, setDemoCardExpiry] = useState("");
  const [demoCardCvv, setDemoCardCvv] = useState("");
  const [demoFormError, setDemoFormError] = useState<string | null>(null);
  const [demoSimulateFailure, setDemoSimulateFailure] = useState(false);

  const clearDemoCardInputs = React.useCallback(() => {
    setDemoCardName("");
    setDemoCardNumber("");
    setDemoCardExpiry("");
    setDemoCardCvv("");
  }, []);

  const handleDeliveryMethodChange = (newMethod: DbDeliveryMethod) => {
    setDeliveryMethod(newMethod);
    if (newMethod === "delivery" && paymentMethod === "cash_on_meetup") {
      setPaymentMethod("cash_on_delivery");
    } else if (newMethod === "meetup" && paymentMethod === "cash_on_delivery") {
      setPaymentMethod("cash_on_meetup");
    }
  };

  // Defense build: buyers choose only between Demo Card (sandbox) and cash.
  // Maya/manual-transfer methods keep full backend + history support but are
  // hidden from this selection. Restore them here if needed later.
  const paymentOptions = React.useMemo(() => {
    // Demo Card is a separate offline sandbox method (academic defense only).
    const demoOption = {
      id: "demo_card" as DbPaymentMethod,
      title: "Demo Card",
      subtitle: "Sandbox payment — no real money will be charged",
      icon: <CreditCard className="size-4 text-[#e59bc9]" />,
    };

    const cashOption =
      deliveryMethod === "delivery"
        ? {
            id: "cash_on_delivery" as DbPaymentMethod,
            title: "Cash on Delivery (COD)",
            subtitle: "Pay in cash directly to courier upon delivery",
            icon: <Banknote className="size-4 text-[#e59bc9]" />,
          }
        : {
            id: "cash_on_meetup" as DbPaymentMethod,
            title: "Cash on Meetup",
            subtitle: "Pay in cash in-person upon meeting the seller",
            icon: <Banknote className="size-4 text-[#e59bc9]" />,
          };

    return demoPaymentEnabled ? [demoOption, cashOption] : [cashOption];
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
        (sum, it) => sum + Number(it.product.price) * Number(it.quantity),
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

  // Pre-checkout display total derived strictly from current validated cart items
  const checkoutDisplayTotal = React.useMemo(() => {
    if (!cartItems || cartItems.length === 0) return 0;
    return sellerGroups.reduce(
      (acc, g) => acc + Number(g.subtotal || 0) + Number(g.shippingFee || 0),
      0
    );
  }, [cartItems, sellerGroups]);

  const overallGrandTotal = checkoutDisplayTotal;

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
    if (submitLock.current || recoveryState !== "idle") return;
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

    submitLock.current = true;
    setIsSubmitting(true);
    try {
      // Guard: never submit a checkout with an invalid, zero, or negative total
      if (checkoutDisplayTotal <= 0 || cartItems.length === 0) {
        toast.error("Cart total must be greater than zero to proceed with checkout.");
        return;
      }

      if (paymentMethod === "maya_online") {
        const res = await fetch("/api/payments/maya/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deliveryMethod,
            shippingName: shippingName.trim() || undefined,
            shippingPhone: shippingPhone.trim() || undefined,
            shippingAddress: shippingAddress.trim() || undefined,
            buyerNote: buyerNote.trim() || undefined,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.redirectUrl) {
          // If checkout failed before redirect, close modal so user is not stuck on a stale modal
          setIsCheckoutOpen(false);
          await refreshCart({ preserveOnError: true }).catch(() => {});
          if (data.recoveryRequired === true) {
            setRecoveryState("error");
          }
          throw new Error(data.error || "Failed to initialize Maya Sandbox checkout.");
        }

        // Clean local cart snapshot and redirect to Maya Sandbox hosted checkout
        resetLocalCart();
        setIsCheckoutOpen(false);
        toast.info("Connecting to Maya Sandbox Checkout...");
        window.location.href = data.redirectUrl;
        return;
      }
      if (paymentMethod === "demo_card") {
        if (!demoPaymentEnabled) {
          throw new Error("Demo payment is not available.");
        }
        // Validate locally, derive only the last4, then immediately discard
        // the raw card inputs — full PAN/CVV/expiry are never sent or stored.
        const cardError =
          validateDemoCardholder(demoCardName) ||
          validateDemoCardNumber(demoCardNumber) ||
          validateDemoExpiry(demoCardExpiry) ||
          validateDemoCvv(demoCardCvv);
        const cardLast4 = deriveCardLast4(demoCardNumber);
        setDemoFormError(cardError);
        clearDemoCardInputs();
        if (cardError || cardLast4.length !== 4) {
          throw new Error(cardError || "Check your demo card details.");
        }

        const demoRes = await fetch("/api/payments/demo/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attemptId: crypto.randomUUID(),
            deliveryMethod,
            shippingName: shippingName.trim() || undefined,
            shippingPhone: shippingPhone.trim() || undefined,
            shippingAddress: shippingAddress.trim() || undefined,
            buyerNote: buyerNote.trim() || undefined,
            cardLast4,
            ...(demoSimulationAllowed && demoSimulateFailure
              ? { simulateFailure: true }
              : {}),
          }),
        });

        const demoData = await demoRes.json().catch(() => ({}));

        if (!demoRes.ok || demoData.success !== true || demoData.paymentStatus !== "paid") {
          // Failure may require reconciliation; do not assume rollback succeeded.
          // Reload cart state, then close the modal so the buyer returns to
          // a healthy cart view instead of a stale "Unable to calculate total".
          await refreshCart({ preserveOnError: true }).catch(() => {});
          const failureMsg =
            demoData.error || "Payment could not be verified. Check your orders before retrying.";
          setDemoFormError(null);
          setIsCheckoutOpen(false);
          throw new Error(failureMsg);
        }

        const demoConfirmationData = {
          orderIds: (demoData.orderIds as string[]) || [],
          sellerCount,
          deliveryMethod,
          paymentMethod,
          grandTotal: Number(demoData.amount) || overallGrandTotal,
          shippingName: shippingName.trim() || undefined,
          shippingAddress: shippingAddress.trim() || undefined,
          demo: {
            reference: String(demoData.reference || ""),
            cardLast4: String(demoData.cardLast4 || cardLast4),
            paymentTransactionId: String(demoData.paymentTransactionId || ""),
          },
        };

        resetLocalCart();
        await refreshCart();

        toast.success("Payment successful — demo transaction, no real money was charged.");
        setDemoFormError(null);
        setDemoSimulateFailure(false);
        setIsSubmitting(false);
        setIsCheckoutOpen(false);
        setConfirmation(demoConfirmationData);
        return;
      }
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

      if (paymentMethod === "manual_gcash" || paymentMethod === "manual_maya") {
        toast.info("Order created — payment verification required.");
      } else {
        toast.success(
          orderIds.length > 1
            ? `Successfully placed ${orderIds.length} orders across ${sellerCount} shops!`
            : "Order placed successfully!"
        );
      }

      setIsSubmitting(false);
      setIsCheckoutOpen(false);
      setConfirmation(confirmationData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again.";
      toast.error(msg);
    } finally {
      submitLock.current = false;
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
      {recoveryState !== "idle" && (
        <div role="status" className="rounded-2xl border border-amber-400/30 bg-[#241c27] p-4 text-sm text-amber-200">
          {recoveryState === "loading" ? "Checking your previous online checkout…" : "Payment status could not be verified. Check it before placing another order."}
          {recoveryState === "error" && <button type="button" onClick={() => void recoverCheckout()} className="ml-3 underline font-bold">Recover payment status</button>}
        </div>
      )}
      {onlineCheckout && <OnlinePaymentStage checkout={onlineCheckout} onCancel={() => void handleCancelOnlineCheckout()} onRefresh={() => void recoverCheckout()} busy={recoveryState !== "idle" || isSubmitting} />}
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
                        onClick={() => {
                          setPaymentMethod(opt.id);
                          setDemoFormError(null);
                        }}
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

                {/* Demo Card Sandbox Notice + Card Form */}
                {demoPaymentEnabled && paymentMethod === "demo_card" && (
                  <div className="mt-2.5 space-y-3 animate-in fade-in duration-150">
                    <div className="p-3 bg-[#342339]/60 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                      <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                        <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                        <span>Demo Card Checkout</span>
                        <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-extrabold tracking-wider text-emerald-300">
                          DEMO
                        </span>
                      </div>
                      <p className="text-[11px] text-[#d6cbd5] leading-relaxed">
                        Sandbox only — no real money will be charged. Any test
                        details work, e.g. 4242 4242 4242 4242, 12/30, 123.
                      </p>
                    </div>

                    <div className="p-4 bg-[#241c27] border border-white/10 rounded-2xl space-y-3">
                      <div>
                        <label htmlFor="demo-card-name" className="text-xs font-semibold text-[#d6cbd5] block mb-1">
                          Cardholder name
                        </label>
                        <input
                          id="demo-card-name"
                          type="text"
                          value={demoCardName}
                          onChange={(e) => setDemoCardName(e.target.value)}
                          placeholder="Juan Dela Cruz"
                          autoComplete="cc-name"
                          className="w-full px-3.5 py-2.5 bg-[#1e1322] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#716872] focus:outline-none focus:border-[#e59bc9]"
                        />
                      </div>
                      <div>
                        <label htmlFor="demo-card-number" className="text-xs font-semibold text-[#d6cbd5] block mb-1">
                          Card number
                        </label>
                        <input
                          id="demo-card-number"
                          type="text"
                          inputMode="numeric"
                          value={demoCardNumber}
                          onChange={(e) => setDemoCardNumber(formatDemoCardNumber(e.target.value))}
                          placeholder="4242 4242 4242 4242"
                          autoComplete="cc-number"
                          className="w-full px-3.5 py-2.5 bg-[#1e1322] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#716872] focus:outline-none focus:border-[#e59bc9]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="demo-card-expiry" className="text-xs font-semibold text-[#d6cbd5] block mb-1">
                            Expiration
                          </label>
                          <input
                            id="demo-card-expiry"
                            type="text"
                            inputMode="numeric"
                            value={demoCardExpiry}
                            onChange={(e) => setDemoCardExpiry(formatDemoExpiry(e.target.value))}
                            placeholder="MM/YY"
                            autoComplete="cc-exp"
                            className="w-full px-3.5 py-2.5 bg-[#1e1322] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#716872] focus:outline-none focus:border-[#e59bc9]"
                          />
                        </div>
                        <div>
                          <label htmlFor="demo-card-cvv" className="text-xs font-semibold text-[#d6cbd5] block mb-1">
                            CVV
                          </label>
                          <input
                            id="demo-card-cvv"
                            type="password"
                            inputMode="numeric"
                            value={demoCardCvv}
                            onChange={(e) => setDemoCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="123"
                            autoComplete="cc-csc"
                            className="w-full px-3.5 py-2.5 bg-[#1e1322] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#716872] focus:outline-none focus:border-[#e59bc9]"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-[#8f7d8c] leading-relaxed">
                        Full card details never leave this device and are never
                        stored — only the last 4 digits are kept for the receipt.
                      </p>
                      {demoFormError && (
                        <p role="alert" className="text-[11px] font-semibold text-rose-300">
                          {demoFormError}
                        </p>
                      )}
                      {demoSimulationAllowed && (
                        <label className="flex items-center gap-2 text-[11px] text-[#b9adb6] cursor-pointer select-none pt-1">
                          <input
                            type="checkbox"
                            checked={demoSimulateFailure}
                            onChange={(e) => setDemoSimulateFailure(e.target.checked)}
                            className="size-3.5 accent-[#e59bc9]"
                          />
                          Simulate failed payment (dev only — stock and cart are restored)
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
                    {checkoutDisplayTotal > 0 ? formatPrice(checkoutDisplayTotal) : "Unable to calculate total"}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || checkoutDisplayTotal <= 0 || cartItems.length === 0}
                  className="w-full py-3 bg-[#65486f] hover:bg-[#7a5985] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>{paymentMethod === "maya_online" ? "Connecting to Maya..." : paymentMethod === "demo_card" ? "Processing demo payment..." : "Processing Order..."}</span>
                    </>
                  ) : checkoutDisplayTotal <= 0 || cartItems.length === 0 ? (
                    <span>Unable to calculate total</span>
                  ) : (
                    <span>
                      {paymentMethod === "maya_online"
                        ? `Pay ${formatPrice(checkoutDisplayTotal)} with Maya`
                        : paymentMethod === "demo_card"
                        ? `Pay ${formatPrice(checkoutDisplayTotal)} with Demo Card`
                        : `Place Order (${formatPrice(checkoutDisplayTotal)})`}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post-Checkout Order Confirmation Modal */}
      {confirmation && (() => {
        const isManualPayment =
          confirmation.paymentMethod === "manual_gcash" ||
          confirmation.paymentMethod === "manual_maya";
        const isDemoPayment = confirmation.paymentMethod === "demo_card";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-[#1e1322] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-6 sm:p-7 border-b border-white/10 text-center space-y-3 bg-[#241728]/50">
                {isDemoPayment && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-extrabold tracking-wider text-emerald-300">
                    DEMO
                  </span>
                )}
                {isManualPayment ? (
                  <div className="size-14 rounded-full bg-amber-950/60 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                    <Clock className="size-7 stroke-[2]" />
                  </div>
                ) : (
                  <div className="size-14 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 className="size-7 stroke-[2]" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {isManualPayment
                      ? "Order Created — Payment Required"
                      : isDemoPayment
                      ? "Payment successful"
                      : "Order Placed Successfully"}
                  </h2>
                  <p className="text-xs text-[#b9adb6] mt-1 max-w-sm mx-auto">
                    {isManualPayment
                      ? confirmation.paymentMethod === "manual_gcash"
                        ? "Your order has been created, but your GCash payment has not been verified yet."
                        : "Your order has been created, but your Maya payment has not been verified yet."
                      : isDemoPayment
                      ? "Demo transaction — no real money was charged."
                      : confirmation.deliveryMethod === "meetup"
                      ? "Your order has been placed. Payment will be handed over to the seller in cash during meetup."
                      : confirmation.orderIds.length > 1
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
                        isDemoPayment
                          ? "text-emerald-300"
                          : isManualPayment
                          ? "text-amber-400"
                          : "text-amber-300"
                      }`}
                    >
                      {isDemoPayment
                        ? formatPaymentStatusLabel("paid", confirmation.paymentMethod)
                        : formatPaymentStatusLabel("pending", confirmation.paymentMethod)}
                    </span>
                  </div>

                  {isDemoPayment && confirmation.demo && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[#b9adb6]">Reference:</span>
                        <span className="font-bold text-white">
                          {confirmation.demo.reference}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#b9adb6]">Card:</span>
                        <span className="font-semibold text-white">
                          {maskDemoCard(confirmation.demo.cardLast4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#b9adb6] shrink-0">Order ID:</span>
                        <span className="font-semibold text-white text-right break-all">
                          {confirmation.orderIds.join(", ")}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between font-bold">
                    <span className="text-white">Total Amount Due:</span>
                    <span className="text-base text-[#e59bc9]">
                      {formatPrice(confirmation.grandTotal)}
                    </span>
                  </div>
                </div>

                {/* Contextual Payment Explanation Box */}
                {isManualPayment ? (
                  <div className="p-4 bg-[#342339]/60 border border-amber-500/20 rounded-2xl text-xs space-y-2">
                    <div className="font-semibold text-amber-200 flex items-center gap-1.5">
                      <Info className="size-4 text-amber-400 shrink-0" />
                      <span>Next Steps for Manual E-Wallet Payment</span>
                    </div>
                    <ol className="text-[11px] text-[#d6cbd5] space-y-1 list-decimal list-inside leading-relaxed">
                      <li>Contact the seller through CircuitCart chat to confirm payment details.</li>
                      <li>
                        Send exact payment via{" "}
                        <strong>{confirmation.paymentMethod === "manual_gcash" ? "GCash" : "Maya"}</strong>.
                      </li>
                      <li>Send your transaction reference or receipt in chat for seller verification.</li>
                      <li>The seller will verify payment and proceed with fulfillment.</li>
                    </ol>
                    <p className="text-[10px] text-amber-300/70 pt-1.5 border-t border-white/[0.06]">
                      * Order created ≠ payment confirmed. CircuitCart does not hold or automatically verify manual e-wallet transfers.
                    </p>
                  </div>
                ) : isDemoPayment ? (
                  <div className="p-4 bg-[#342339]/60 border border-emerald-500/20 rounded-2xl text-xs space-y-2">
                    <div className="font-semibold text-emerald-200 flex items-center gap-1.5">
                      <Info className="size-4 text-emerald-400 shrink-0" />
                      <span>Sandbox Receipt — No Real Payment</span>
                    </div>
                    <p className="text-[11px] text-[#d6cbd5] leading-relaxed">
                      This order was paid with the Demo Card sandbox provider.
                      No real money was charged and no external gateway was
                      contacted. Only the last 4 card digits were kept for this
                      receipt.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-[#342339]/60 border border-white/10 rounded-2xl text-xs space-y-1.5">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <Info className="size-4 text-[#e59bc9] shrink-0" />
                      <span>
                        {confirmation.paymentMethod === "cash_on_meetup"
                          ? "Cash on Meetup Guidance"
                          : "Cash on Delivery Guidance"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#d6cbd5] leading-relaxed">
                      {confirmation.paymentMethod === "cash_on_delivery"
                        ? "Payment will be collected in cash when your order is delivered to your address. Please prepare exact payment for the courier."
                        : "Payment will be completed in cash in-person when you meet the seller. You can test and inspect the item before finalizing payment."}
                    </p>
                    <p className="text-[10px] text-[#8f7d8c] pt-1">
                      * Successful order placement does not mean payment is complete. Order status and payment status are tracked independently.
                    </p>
                  </div>
                )}

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
                    <span>
                      {isManualPayment
                        ? "View My Orders & Coordinate Payment"
                        : "View My Orders"}
                    </span>
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
        );
      })()}
    </div>
  );
}
