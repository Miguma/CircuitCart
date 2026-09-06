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
import { toast } from "sonner";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  date: string;
  read: boolean;
  type: "price" | "welcome" | "seller";
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
  notifications: NotificationItem[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  unreadNotificationsCount: number;

  // Profile
  demoProfile: DemoProfile;
  updateProfile: (data: Partial<DemoProfile>) => void;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(
  undefined
);

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "A saved product has a new price.",
    description:
      "Asus ROG Strix G16 Gaming Laptop is now available at ₱42,500.",
    date: "10m ago",
    read: false,
    type: "price",
  },
  {
    id: "notif-2",
    title: "Welcome to CircuitCart.",
    description:
      "Discover trusted tech deals and verified listings across Cebu and Visayas.",
    date: "2h ago",
    read: false,
    type: "welcome",
  },
  {
    id: "notif-3",
    title: "Seller verification is available when you are ready to sell.",
    description:
      "Complete identity checks to unlock listing electronics directly on the marketplace.",
    date: "1d ago",
    read: true,
    type: "seller",
  },
];

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

  // Notifications
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Demo Profile
  const [demoProfile, setDemoProfile] = useState<DemoProfile>(INITIAL_PROFILE);

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
          }
          return;
        }

        const [items, favs] = await Promise.all([
          getCartItems(),
          getFavorites(),
        ]);

        if (isMounted) {
          setCartItems(items || []);
          setFavorites(favs || []);
        }
      } catch (err) {
        console.warn("Could not load user cart/favorites from Supabase:", err);
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
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
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

  // Notifications handlers
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  }, []);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((notif) => !notif.read).length;
  }, [notifications]);

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
      notifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      unreadNotificationsCount,
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
      notifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      unreadNotificationsCount,
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
