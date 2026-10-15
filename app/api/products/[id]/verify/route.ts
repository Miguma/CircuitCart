import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAiVerificationProvider } from "@/lib/ai/provider";
import { calculateProductContentHash } from "@/lib/ai/content-hash";
import { checkVerificationRateLimit, checkDistributedRateLimit } from "@/lib/ai/rate-limit";
import { getProductImageUrl } from "@/lib/supabase/storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getServiceRoleClient(): SupabaseClient<any, any, any> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/products/[id]/verify
 * Automatically verifies a product listing using the hosted AI multimodal engine
 * or local heuristic fallback, then records an authoritative decision in Supabase.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Missing product ID." }, { status: 400 });
    }

    // 1. Authenticate user
    const userClient = await createServerClient();
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to verify products." },
        { status: 401 }
      );
    }

    // 2. Check seller verification rate limit
    const rateLimit = checkVerificationRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Verification rate limit exceeded. Please wait a moment before trying again.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    // 3. Fetch product with images using service-role if available, or authenticated client
    const serviceRole = getServiceRoleClient();
    const db = serviceRole || userClient;

    // Rate limiting (Tier 2: Multi-instance distributed check against product_verifications)
    const distributedRateLimit = await checkDistributedRateLimit(db, user.id);
    if (!distributedRateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Verification rate limit exceeded across instances. Please wait before retrying.",
          retryAfterSeconds: distributedRateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(distributedRateLimit.retryAfterSeconds) },
        }
      );
    }

    interface VerificationProduct {
      id: string;
      seller_id: string;
      title: string;
      category: string;
      condition: string | null;
      price: number;
      stock: number;
      specs: string | null;
      description: string | null;
      location: string | null;
      status: string;
      verification_status?: string | null;
      verification_reason?: string | null;
      product_images?: Array<{
        id: string;
        storage_path: string;
        sort_order: number;
      }> | null;
    }

    const { data: productData, error: fetchErr } = await db
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
        location,
        status,
        verification_status,
        verification_reason,
        product_images (
          id,
          storage_path,
          sort_order
        )
      `)
      .eq("id", productId)
      .maybeSingle();

    let product: VerificationProduct | null = productData as VerificationProduct | null;
    let isPreMigration = false;

    if (
      fetchErr &&
      (fetchErr.code === "42703" ||
        fetchErr.message?.toLowerCase().includes("verification_status") ||
        fetchErr.message?.toLowerCase().includes("does not exist"))
    ) {
      isPreMigration = true;
      const fallbackQuery = await db
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
          location,
          status,
          product_images (
            id,
            storage_path,
            sort_order
          )
        `)
        .eq("id", productId)
        .maybeSingle();

      if (fallbackQuery.error || !fallbackQuery.data) {
        return NextResponse.json({ error: "Product not found." }, { status: 404 });
      }
      product = fallbackQuery.data as unknown as VerificationProduct;
    } else if (fetchErr || !product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    // 4. Validate ownership (seller or admin). Admin role comes from public.profiles;
    //    user_metadata is user-editable and is not trusted.
    const isOwner = product.seller_id === user.id;
    let isAdmin = false;
    if (!isOwner) {
      const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
    }

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to verify this product." },
        { status: 403 }
      );
    }

    // 5. Prepare images and content hash
    type ProductImg = { id: string; storage_path: string; sort_order: number };
    const rawImages: ProductImg[] = (product.product_images as ProductImg[]) || [];
    const sortedImages = [...rawImages].sort((a, b) => a.sort_order - b.sort_order);
    const storagePaths = sortedImages.map((img) => img.storage_path);

    // Compute canonical content hash for race condition guard
    const contentHash = calculateProductContentHash({
      title: product.title,
      category: product.category,
      specs: product.specs,
      description: product.description,
      images: storagePaths,
    });

    // Prepare public URLs for AI engine inspection
    const imageUrls = storagePaths.map((p) => getProductImageUrl(p));

    // Inspect ONLY authoritative images uploaded to Supabase Storage.
    // Unverified seller-supplied image previews from client request bodies are NOT trusted.
    const inspectionImages = imageUrls;

    // 6. Invoke AI verification provider
    const provider = getAiVerificationProvider();
    const result = await provider.verify(
      {
        productId: product.id,
        sellerId: product.seller_id,
        title: product.title,
        category: product.category,
        condition: product.condition || "used",
        price: Number(product.price),
        specs: product.specs,
        description: product.description,
        imageUrls: inspectionImages,
      },
      contentHash
    );

    // 7. Authoritatively apply decision via PostgreSQL RPC (or pre-migration compatibility mode)
    if (isPreMigration) {
      // Before the AI verification migration is applied, verification must not directly activate listings.
      // Only the authoritative apply_product_ai_decision RPC may activate listings post-migration.
      const isApproved = result.decision === "TECH_APPROVED";
      const isRejected = result.decision === "NON_TECH_REJECTED";

      return NextResponse.json({
        success: true,
        decision: result.decision,
        status: isApproved ? "approved" : isRejected ? "rejected" : "uncertain",
        productStatus: "draft",
        confidence: result.confidence ?? 1.0,
        reason: result.reason,
        suggestedCategory: result.suggestedCategory || null,
        flaggedReasons: result.flaggedReasons || [],
        modelUsed: result.modelUsed,
        contentHash,
      });
    }

    const { data: rpcResult, error: rpcErr } = await db.rpc(
      "apply_product_ai_decision",
      {
        p_product_id: productId,
        p_decision: result.decision,
        p_confidence: result.confidence,
        p_reason: result.reason,
        p_suggested_category: result.suggestedCategory || null,
        p_flagged_reasons: result.flaggedReasons || [],
        p_content_hash: contentHash,
        p_model_used: result.modelUsed,
        p_raw_response: result.rawResponse ? JSON.parse(JSON.stringify(result.rawResponse)) : null,
        p_expected_hash: contentHash,
      }
    );

    if (rpcErr) {
      console.error("[Product Verification] RPC failed:", rpcErr);
      return NextResponse.json(
        {
          error: `Failed to save verification decision: ${rpcErr.message}`,
        },
        { status: 500 }
      );
    }

    // 8. Return structured result
    const isApproved = result.decision === "TECH_APPROVED";
    const isRejected = result.decision === "NON_TECH_REJECTED";

    return NextResponse.json({
      success: true,
      decision: result.decision,
      status: isApproved ? "approved" : isRejected ? "rejected" : "uncertain",
      productStatus: isApproved ? "active" : "draft",
      confidence: result.confidence,
      reason: result.reason,
      suggestedCategory: result.suggestedCategory,
      flaggedReasons: result.flaggedReasons,
      modelUsed: result.modelUsed,
      contentHash,
      rpcResult,
    });
  } catch (err) {
    console.error("[Product Verification] Unexpected error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during product verification.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/products/[id]/verify
 * Returns current verification status and audit records for the product.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Missing product ID." }, { status: 400 });
    }

    const userClient = await createServerClient();
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const serviceRole = getServiceRoleClient();
    const db = serviceRole || userClient;

    const { data: product, error: fetchErr } = await db
      .from("products")
      .select(`
        id,
        seller_id,
        title,
        status,
        verification_status,
        verification_reason,
        verified_at,
        verified_by_model
      `)
      .eq("id", productId)
      .maybeSingle();

    if (fetchErr || !product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    // Check ownership (admin role from public.profiles, not user-editable metadata)
    const isOwner = product.seller_id === user.id;
    let isAdmin = false;
    if (!isOwner) {
      const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
    }

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
      );
    }

    // Fetch audits
    const { data: audits } = await db
      .from("product_verifications")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      product,
      audits: audits || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error." },
      { status: 500 }
    );
  }
}
