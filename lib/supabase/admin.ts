import { createClient } from "./client";
import type {
  DbProfile,
  DbShop,
  DbOrder,
  ProductWithRelations,
  SellerVerificationWithProfile,
} from "./types";

/**
 * Check if the user profile has administrator privileges
 * Derived strictly from database public.profiles.role
 */
export function isAdmin(profile: DbProfile | null): boolean {
  return profile?.role === "admin";
}

/**
 * Superadmin permission check
 * Extensible for future role hierarchy without modifying database constraints today
 */
export function isSuperAdmin(profile: DbProfile | null): boolean {
  return profile?.role === "admin";
}

export interface AdminDashboardStats {
  totalUsers: number | null;
  totalSellers: number | null;
  totalProducts: number | null;
  totalShops: number | null;
  pendingVerifications: number | null;
  totalOrders: number | null;
}

/**
 * Fetch high-level statistics for the admin dashboard
 * Only returns real counts; returns null for metrics that cannot be safely retrieved
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createClient();

  try {
    const [
      { count: usersCount },
      { count: sellersCount },
      { count: productsCount },
      { count: shopsCount },
      { count: verificationsCount },
      { count: ordersCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "seller"),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("shops").select("*", { count: "exact", head: true }),
      supabase.from("seller_verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("*", { count: "exact", head: true }),
    ]);

    return {
      totalUsers: usersCount ?? null,
      totalSellers: sellersCount ?? null,
      totalProducts: productsCount ?? null,
      totalShops: shopsCount ?? null,
      pendingVerifications: verificationsCount ?? null,
      totalOrders: ordersCount ?? null,
    };
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    return {
      totalUsers: null,
      totalSellers: null,
      totalProducts: null,
      totalShops: null,
      pendingVerifications: null,
      totalOrders: null,
    };
  }
}

/**
 * Fetch all user profiles for the Admin Users workspace
 */
export async function getAdminUsers(): Promise<DbProfile[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin users:", error);
      return [];
    }

    return (data as DbProfile[]) || [];
  } catch (err) {
    console.error("Error in getAdminUsers:", err);
    return [];
  }
}

export interface SellerWithShop extends DbProfile {
  shops?: DbShop[];
  productCount?: number;
}

/**
 * Fetch all registered sellers and their shop data
 */
export async function getAdminSellers(): Promise<SellerWithShop[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*, shops(*)")
      .eq("role", "seller")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin sellers:", error);
      return [];
    }

    return (data as SellerWithShop[]) || [];
  } catch (err) {
    console.error("Error in getAdminSellers:", err);
    return [];
  }
}

/**
 * Fetch all products for the Admin Products workspace
 */
export async function getAdminProducts(): Promise<ProductWithRelations[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(*), shops(*), profiles(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin products:", error);
      return [];
    }

    return (data as ProductWithRelations[]) || [];
  } catch (err) {
    console.error("Error in getAdminProducts:", err);
    return [];
  }
}

export interface ShopWithOwner extends DbShop {
  profiles?: DbProfile | null;
}

/**
 * Fetch all shops for the Admin Shops workspace
 */
export async function getAdminShops(): Promise<ShopWithOwner[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shops")
      .select("*, profiles(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin shops:", error);
      return [];
    }

    return (data as ShopWithOwner[]) || [];
  } catch (err) {
    console.error("Error in getAdminShops:", err);
    return [];
  }
}

/**
 * Fetch all orders for the Admin Orders workspace
 */
export async function getAdminOrders(): Promise<DbOrder[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin orders:", error);
      return [];
    }

    return (data as DbOrder[]) || [];
  } catch (err) {
    console.error("Error in getAdminOrders:", err);
    return [];
  }
}

/**
 * Fetch a single seller verification request by ID for detail page
 */
export async function getAdminVerificationById(
  id: string
): Promise<SellerVerificationWithProfile | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("seller_verification_requests")
      .select("*, profiles!seller_verification_requests_user_id_fkey(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching verification request by ID:", error);
      return null;
    }

    return (data as SellerVerificationWithProfile) || null;
  } catch (err) {
    console.error("Error in getAdminVerificationById:", err);
    return null;
  }
}
