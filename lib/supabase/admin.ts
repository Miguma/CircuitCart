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
 * Future placeholder for superadmin role check.
 * Currently, CircuitCart does not use a distinct superadmin role; 'admin' is the highest role.
 * Always returns false to avoid granting unverified elevated privileges.
 */
export function isSuperAdmin(_profile: DbProfile | null): boolean {
  return false;
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
 * Inspects each individual query's error object explicitly.
 * Returns null (not 0) for metrics that fail to load or encounter database/RLS errors.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createClient();

  try {
    const [
      usersRes,
      sellersRes,
      productsRes,
      shopsRes,
      verificationsRes,
      ordersRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "seller"),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("shops").select("*", { count: "exact", head: true }),
      supabase.from("seller_verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("*", { count: "exact", head: true }),
    ]);

    if (usersRes.error) console.error("Admin stats: Failed to fetch users count:", usersRes.error.message);
    if (sellersRes.error) console.error("Admin stats: Failed to fetch sellers count:", sellersRes.error.message);
    if (productsRes.error) console.error("Admin stats: Failed to fetch products count:", productsRes.error.message);
    if (shopsRes.error) console.error("Admin stats: Failed to fetch shops count:", shopsRes.error.message);
    if (verificationsRes.error) console.error("Admin stats: Failed to fetch verifications count:", verificationsRes.error.message);
    if (ordersRes.error) console.error("Admin stats: Failed to fetch orders count:", ordersRes.error.message);

    return {
      totalUsers: usersRes.error ? null : (usersRes.count ?? null),
      totalSellers: sellersRes.error ? null : (sellersRes.count ?? null),
      totalProducts: productsRes.error ? null : (productsRes.count ?? null),
      totalShops: shopsRes.error ? null : (shopsRes.count ?? null),
      pendingVerifications: verificationsRes.error ? null : (verificationsRes.count ?? null),
      totalOrders: ordersRes.error ? null : (ordersRes.count ?? null),
    };
  } catch (err) {
    console.error("Error in getAdminDashboardStats:", err);
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
 * Propagates errors instead of silently swallowing database/RLS failures
 */
export async function getAdminUsers(): Promise<DbProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin users:", error.message);
    throw new Error("Unable to retrieve user directory. Please verify administrative database permissions.");
  }

  return (data as DbProfile[]) || [];
}

export interface SellerWithShop extends DbProfile {
  shops?: DbShop[];
  productCount?: number;
}

/**
 * Fetch all registered sellers and their shop data
 * Propagates errors instead of silently swallowing database/RLS failures
 */
export async function getAdminSellers(): Promise<SellerWithShop[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, shops(*)")
    .eq("role", "seller")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin sellers:", error.message);
    throw new Error("Unable to retrieve seller directory. Please verify administrative database permissions.");
  }

  return (data as SellerWithShop[]) || [];
}

/**
 * Fetch all products for the Admin Products workspace
 * Propagates errors instead of silently swallowing database/RLS failures
 */
export async function getAdminProducts(): Promise<ProductWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*), shops(*), profiles(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin products:", error.message);
    throw new Error("Unable to retrieve product catalog. Please verify administrative database permissions.");
  }

  return (data as ProductWithRelations[]) || [];
}

export interface ShopWithOwner extends DbShop {
  profiles?: DbProfile | null;
}

/**
 * Fetch all shops for the Admin Shops workspace
 * Propagates errors instead of silently swallowing database/RLS failures
 */
export async function getAdminShops(): Promise<ShopWithOwner[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*, profiles(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin shops:", error.message);
    throw new Error("Unable to retrieve shops directory. Please verify administrative database permissions.");
  }

  return (data as ShopWithOwner[]) || [];
}

/**
 * Fetch all orders for the Admin Orders workspace
 * Propagates errors instead of silently swallowing database/RLS failures
 */
export async function getAdminOrders(): Promise<DbOrder[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin orders:", error.message);
    throw new Error("Unable to retrieve platform orders. Please verify administrative database permissions.");
  }

  return (data as DbOrder[]) || [];
}

/**
 * Fetch a single seller verification request by ID for detail page
 * Propagates errors instead of silently swallowing database/RLS failures
 */
export async function getAdminVerificationById(
  id: string
): Promise<SellerVerificationWithProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("seller_verification_requests")
    .select("*, profiles!seller_verification_requests_user_id_fkey(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching verification request by ID:", error.message);
    throw new Error("Unable to retrieve verification request details.");
  }

  return (data as SellerVerificationWithProfile) || null;
}
