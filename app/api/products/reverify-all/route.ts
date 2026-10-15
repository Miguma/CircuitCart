import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAiVerificationProvider } from "@/lib/ai/provider";
import { calculateProductContentHash } from "@/lib/ai/content-hash";
import { getProductImageUrl } from "@/lib/supabase/storage";

/**
 * Provider outcomes that mean "the AI never actually judged this listing".
 * These must never be written as decisions during batch re-verification, otherwise an
 * API outage would unpublish every legitimate legacy listing. The row keeps its current
 * state (e.g. legacy_migration_grace) and is picked up again on the next run.
 */
const TRANSIENT_PROVIDER_FLAGS = new Set([
  "API_ERROR",
  "EMPTY_RESPONSE",
  "NETWORK_TIMEOUT",
  "SERVICE_UNAVAILABLE",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getServiceRoleClient(): SupabaseClient<any, any, any> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/products/reverify-all
 * Safely re-runs AI verification over existing products in batches.
 *
 * Authorization (either):
 *   - Header `x-admin-secret` (or legacy alias `x-admin-key`) equal to the
 *     ADMIN_REVERIFY_SECRET environment variable (min. 32 chars). The service-role key
 *     is intentionally NOT accepted as a header secret.
 *   - A signed-in user whose public.profiles.role is 'admin' (user_metadata is
 *     user-editable and is not trusted).
 *
 * Body: { dryRun?: boolean, limit?: 1-50, status?: string, verifiedByModel?: string }
 * Never deletes product records. dryRun performs no database writes.
 */
export async function POST(request: NextRequest) {
  try {
    const serviceRole = getServiceRoleClient();
    const providedSecret =
      request.headers.get("x-admin-secret") || request.headers.get("x-admin-key");
    const configuredSecret = process.env.ADMIN_REVERIFY_SECRET;

    let isAuthorized = false;

    if (providedSecret && configuredSecret && configuredSecret.length >= 32) {
      isAuthorized = secretsMatch(providedSecret, configuredSecret);
    }

    if (!isAuthorized) {
      const userClient = await createServerClient();
      const {
        data: { user },
      } = await userClient.auth.getUser();

      if (user) {
        const { data: profile } = await (serviceRole || userClient)
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        isAuthorized = profile?.role === "admin";
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden. Administrative authorization required." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
    const filterStatus = body.status; // e.g. 'pending', 'uncertain', 'rejected', or undefined (all)
    const filterModel = body.model || body.verifiedByModel; // e.g. 'legacy_migration_grace'
    const dryRun = Boolean(body.dryRun);

    // Decisions can only be written through apply_product_ai_decision, which is granted
    // to service_role only. Fail loudly instead of silently skipping every write.
    if (!serviceRole) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." },
        { status: 503 }
      );
    }
    const db = serviceRole;

    let query = db
      .from("products")
      .select(`
        id,
        seller_id,
        title,
        category,
        condition,
        price,
        stock,
        specs,
        description,
        status,
        verification_status,
        verified_by_model,
        product_images (
          id,
          storage_path,
          sort_order
        )
      `)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (filterStatus) {
      query = query.eq("verification_status", filterStatus);
    }
    if (filterModel) {
      query = query.eq("verified_by_model", filterModel);
    }

    const { data: products, error: queryErr } = await query;

    if (queryErr || !products) {
      return NextResponse.json(
        { error: `Failed to query products: ${queryErr?.message}` },
        { status: 500 }
      );
    }

    const provider = getAiVerificationProvider();
    const results: Array<{
      id: string;
      title: string;
      previousStatus: string;
      decision: string;
      reason: string;
      confidence: number;
      applied: boolean;
      skippedReason?: string;
    }> = [];

    let approvedCount = 0;
    let rejectedCount = 0;
    let uncertainCount = 0;
    let appliedCount = 0;
    let skippedTransientCount = 0;
    let failedCount = 0;

    for (const prod of products) {
      type ProductImg = { id: string; storage_path: string; sort_order: number };
      const rawImages: ProductImg[] = (prod.product_images as ProductImg[]) || [];
      const sortedImages = [...rawImages].sort((a, b) => a.sort_order - b.sort_order);
      const storagePaths = sortedImages.map((img) => img.storage_path);

      const contentHash = calculateProductContentHash({
        title: prod.title,
        category: prod.category,
        specs: prod.specs,
        description: prod.description,
        images: storagePaths,
      });

      const imageUrls = storagePaths.map((p) => getProductImageUrl(p));

      const verification = await provider.verify(
        {
          productId: prod.id,
          sellerId: prod.seller_id,
          title: prod.title,
          category: prod.category,
          condition: prod.condition,
          price: Number(prod.price),
          specs: prod.specs,
          description: prod.description,
          imageUrls,
        },
        contentHash
      );

      if (verification.decision === "TECH_APPROVED") approvedCount++;
      else if (verification.decision === "NON_TECH_REJECTED") rejectedCount++;
      else uncertainCount++;

      const isTransient =
        verification.decision === "UNCERTAIN" &&
        (verification.flaggedReasons || []).some((f) => TRANSIENT_PROVIDER_FLAGS.has(f));

      let applied = false;
      let skippedReason: string | undefined;

      if (dryRun) {
        skippedReason = "dry_run";
      } else if (isTransient) {
        skippedTransientCount++;
        skippedReason = "ai_unavailable_retry_later";
      } else {
        const { error: rpcErr } = await db.rpc("apply_product_ai_decision", {
          p_product_id: prod.id,
          p_decision: verification.decision,
          p_confidence: verification.confidence,
          p_reason: verification.reason,
          p_suggested_category: verification.suggestedCategory || null,
          p_flagged_reasons: verification.flaggedReasons || [],
          p_content_hash: contentHash,
          p_model_used: verification.modelUsed,
          p_expected_hash: contentHash,
        });
        if (rpcErr) {
          failedCount++;
          skippedReason = `rpc_failed: ${rpcErr.message}`;
          console.error(`[Re-verify All] RPC failed for ${prod.id}:`, rpcErr.message);
        } else {
          applied = true;
          appliedCount++;
        }
      }

      results.push({
        id: prod.id,
        title: prod.title,
        previousStatus: prod.verification_status || "unknown",
        decision: verification.decision,
        reason: verification.reason,
        confidence: verification.confidence,
        applied,
        skippedReason,
      });
    }

    // Outstanding legacy grace listings (must reach 0 after rollout)
    const { count: remainingGrace } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("verified_by_model", "legacy_migration_grace");

    return NextResponse.json({
      success: failedCount === 0,
      dryRun,
      provider: provider.name,
      totalProcessed: products.length,
      counts: {
        approved: approvedCount,
        rejected: rejectedCount,
        uncertain: uncertainCount,
        applied: appliedCount,
        skippedTransient: skippedTransientCount,
        failed: failedCount,
      },
      remainingLegacyGrace: remainingGrace ?? null,
      results,
    });
  } catch (err) {
    console.error("[Re-verify All] Failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error." },
      { status: 500 }
    );
  }
}
