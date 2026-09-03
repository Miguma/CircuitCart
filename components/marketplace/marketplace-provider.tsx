"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Product, DUMMY_PRODUCTS, CategoryFilter } from "./marketplace-data";

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

  // Favorites (initialize with a couple of products for demo richness)
  const [favorites, setFavorites] = useState<string[]>(["prod-1", "prod-3"]);

  // Cart (initialize with 2 items)
  const [cartItems, setCartItems] = useState<CartItem[]>([
    { product: DUMMY_PRODUCTS[0], quantity: 1 },
    { product: DUMMY_PRODUCTS[2], quantity: 1 },
  ]);

  // Notifications
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Demo Profile
  const [demoProfile, setDemoProfile] = useState<DemoProfile>(INITIAL_PROFILE);

  // Favorites handlers
  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites]
  );

  // Cart handlers
  const addToCart = useCallback((product: Product, quantity = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCartItems((prev) =>
      prev.filter((item) => item.product.id !== productId)
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      setCartItems((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    },
    [removeFromCart]
  );

  const clearCart = useCallback(() => setCartItems([]), []);

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
