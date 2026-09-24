"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { Product, CategoryFilter } from "./marketplace-data";
import { createClient } from "@/lib/supabase/client";
import {
  getCartItems,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  clearCart as clearSupabaseCart,
} from "@/lib/supabase/cart";
import {
  getFavorites,
  toggleFavorite as toggleSupabaseFavorite,
} from "@/lib/supabase/favorites";
import { getUnreadNotificationCount } from "@/lib/supabase/notifications";
import { toast } from "sonner";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface DemoProfile {
  name: string;
  username: string;
  email: string;
  location: string;
  bio: string;
  accountType: string;
  joinedDate: string;
}

interface MarketplaceContextType {
  // Search & Categories
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: CategoryFilter;
  setSelectedCategory: (cat: CategoryFilter) => void;
  quickViewProduct: Product | null;
  setQuickViewProduct: (prod: Product | null) => void;

  // Favorites
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;

  // Cart
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  refreshCart: () => Promise<void>;
  resetLocalCart: () => void;
  totalCartCount: number;
  cartSubtotal: number;

  // Notifications
  unreadNotificationsCount: number;
  setUnreadNotificationsCount: React.Dispatch<React.SetStateAction<number>>;
  refreshUnreadNotificationsCount: () => Promise<void>;

  // Profile
  demoProfile: DemoProfile;
  updateProfile: (data: Partial<DemoProfile>) => void;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(
  undefined
);

const INITIAL_PROFILE: DemoProfile = {
  name: "Demo User",
  username: "@demouser",
  email: "demo@circuitcart.test",
  location: "Cebu City, Central Visayas",
  bio: "Interested in reliable new and pre-owned technology across Cebu.",
  accountType: "Buyer",
  joinedDate: "August 2026",
};

export function MarketplaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>("All");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Favorites (Supabase persistent)
  const [favorites, setFavorites] = useState<string[]>([]);

  // Cart (Supabase persistent)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Notifications unread count (Supabase persistent)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Demo Profile
  const [demoProfile, setDemoProfile] = useState<DemoProfile>(INITIAL_PROFILE);

  const refreshUnreadNotificationsCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount();
      setUnreadNotificationsCount(count);
    } catch (err) {
      console.warn("Failed to refresh unread notification count:", err);
    }
  }, []);

  // Load user data on mount and auth state change
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (isMounted) {
            setCartItems([]);
            setFavorites([]);
            setUnreadNotificationsCount(0);
          }
          return;
        }

        const [items, favs, notifCount] = await Promise.all([
          getCartItems(),
          getFavorites(),
          getUnreadNotificationCount(),
        ]);

        if (isMounted) {
          setCartItems(items || []);
          setFavorites(favs || []);
          setUnreadNotificationsCount(notifCount ?? 0);
        }
      } catch (err) {
        console.warn("Could not load user data from Supabase:", err);
      }
    }

    loadUserData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserData();
      } else {
        if (isMounted) {
          setCartItems([]);
          setFavorites([]);
          setUnreadNotificationsCount(0);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Lightweight lifecycle refresh (window focus & tab visibility)
  useEffect(() => {
    let lastFetchTime = 0;
    const DEBOUNCE_MS = 3000;

    const handleRefresh = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      const now = Date.now();
      if (now - lastFetchTime < DEBOUNCE_MS) {
        return;
      }
      lastFetchTime = now;
      try {
        const count = await getUnreadNotificationCount();
        setUnreadNotificationsCount(count);
      } catch (err) {
        console.warn("Could not refresh unread notification count on lifecycle event:", err);
      }
    };

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
    };
  }, []);

  // Favorites handlers
  const toggleFavorite = useCallback(
    async (productId: string) => {
      const prevFavorites = favorites;
      const isCurrentlyFavorited = prevFavorites.includes(productId);

      // Optimistic update
      setFavorites((prev) =>
        isCurrentlyFavorited
          ? prev.filter((id) => id !== productId)
          : [...prev, productId]
      );

      try {
        await toggleSupabaseFavorite(productId);
      } catch (err: unknown) {
        // Rollback
        setFavorites(prevFavorites);
        const msg =
          err instanceof Error ? err.message : "Failed to update favorites.";
        toast.error(msg);
      }
    },
    [favorites]
  );

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites]
  );

  // Cart handlers
  const addToCart = useCallback(
    async (product: Product, quantity = 1) => {
      const prevCart = cartItems;

      // Optimistic update
      setCartItems((prev) => {
        const stockLimit = Math.max(1, product.stock ?? 1);
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          const nextQty = Math.min(existing.quantity + quantity, stockLimit);
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: nextQty }
              : item
          );
        }
        return [
          ...prev,
          { product, quantity: Math.min(quantity, stockLimit) },
        ];
      });

      try {
        await addCartItem(product.id, quantity);
      } catch (err: unknown) {
        // Rollback
        setCartItems(prevCart);
        const msg =
          err instanceof Error ? err.message : "Failed to add item to cart.";
        toast.error(msg);
      }
    },
    [cartItems]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      const prevCart = cartItems;

      // Optimistic update
      setCartItems((prev) =>
        prev.filter((item) => item.product.id !== productId)
      );

      try {
        await removeCartItem(productId);
      } catch (err: unknown) {
        // Rollback
        setCartItems(prevCart);
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to remove item from cart.";
        toast.error(msg);
      }
    },
    [cartItems]
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      if (quantity <= 0) {
        await removeFromCart(productId);
        return;
      }

      const prevCart = cartItems;

      // Optimistic update
      setCartItems((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );

      try {
        await updateCartItemQuantity(productId, quantity);
      } catch (err: unknown) {
        // Rollback
        setCartItems(prevCart);
        const msg =
          err instanceof Error ? err.message : "Failed to update quantity.";
        toast.error(msg);
      }
    },
    [cartItems, removeFromCart]
  );

  const clearCart = useCallback(async () => {
    const prevCart = cartItems;

    // Optimistic update
    setCartItems([]);

    try {
      await clearSupabaseCart();
    } catch (err: unknown) {
      // Rollback
      setCartItems(prevCart);
      const msg =
        err instanceof Error ? err.message : "Failed to clear cart.";
      toast.error(msg);
    }
  }, [cartItems]);

  const refreshCart = useCallback(async () => {
    try {
      const items = await getCartItems();
      setCartItems(items || []);
    } catch (err) {
      console.warn("Could not refresh cart from Supabase:", err);
      setCartItems([]);
    }
  }, []);

  const resetLocalCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce(
      (acc, item) => acc + item.product.price * item.quantity,
      0
    );
  }, [cartItems]);

  // Profile handler
  const updateProfile = useCallback((data: Partial<DemoProfile>) => {
    setDemoProfile((prev) => ({ ...prev, ...data }));
  }, []);

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      selectedCategory,
      setSelectedCategory,
      quickViewProduct,
      setQuickViewProduct,
      favorites,
      toggleFavorite,
      isFavorite,
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshCart,
      resetLocalCart,
      totalCartCount,
      cartSubtotal,
      unreadNotificationsCount,
      setUnreadNotificationsCount,
      refreshUnreadNotificationsCount,
      demoProfile,
      updateProfile,
    }),
    [
      searchQuery,
      selectedCategory,
      quickViewProduct,
      favorites,
      toggleFavorite,
      isFavorite,
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshCart,
      resetLocalCart,
      totalCartCount,
      cartSubtotal,
      unreadNotificationsCount,
      refreshUnreadNotificationsCount,
      demoProfile,
      updateProfile,
    ]
  );

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error("useMarketplace must be used within a MarketplaceProvider");
  }
  return context;
}

export function useOptionalMarketplace() {
  return useContext(MarketplaceContext);
}
