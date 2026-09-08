import { createClient } from "./client";
import type { DbShop } from "./types";

/**
 * Retrieves a shop by the owner's profile UUID
 */
export async function getShopByOwnerId(ownerId: string): Promise<DbShop | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (error || !data) return null;
    return data as DbShop;
  } catch {
    return null;
  }
}

/**
 * Retrieves a shop by its public slug
 */
export async function getShopBySlug(slug: string): Promise<DbShop | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("slug", slug.trim().toLowerCase())
      .maybeSingle();

    if (error || !data) return null;
    return data as DbShop;
  } catch {
    return null;
  }
}

/**
 * Ensures a seller has a shop record, creating one if not yet present
 */
export async function ensureSellerShop(ownerId: string, sellerName: string): Promise<DbShop> {
  const existing = await getShopByOwnerId(ownerId);
  if (existing) return existing;

  const supabase = createClient();
  const cleanName = sellerName.trim() || "Tech Store";
  const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "seller-shop";
  const uniqueSlug = `${baseSlug}-${ownerId.slice(0, 4)}`;

  const { data, error } = await supabase
    .from("shops")
    .insert({
      owner_id: ownerId,
      name: cleanName,
      slug: uniqueSlug,
      status: "active",
      is_verified: false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to initialize seller shop: ${error?.message || "Unknown error"}`);
  }

  return data as DbShop;
}

/**
 * Updates an existing shop owned by the current seller
 */
export async function updateShop(
  shopId: string,
  updates: {
    name?: string;
    slug?: string;
    description?: string;
    location?: string;
    status?: "active" | "vacation";
    banner_url?: string;
    logo_url?: string;
  }
): Promise<DbShop> {
  const supabase = createClient();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) updatePayload.name = updates.name.trim();
  if (updates.slug !== undefined) updatePayload.slug = updates.slug.trim().toLowerCase();
  if (updates.description !== undefined) updatePayload.description = updates.description.trim() || null;
  if (updates.location !== undefined) updatePayload.location = updates.location.trim() || null;
  if (updates.status !== undefined) updatePayload.status = updates.status;
  if (updates.banner_url !== undefined) updatePayload.banner_url = updates.banner_url;
  if (updates.logo_url !== undefined) updatePayload.logo_url = updates.logo_url;

  const { data, error } = await supabase
    .from("shops")
    .update(updatePayload)
    .eq("id", shopId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update shop: ${error?.message || "Database update error"}`);
  }

  return data as DbShop;
}

