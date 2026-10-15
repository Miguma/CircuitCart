/**
 * In-memory sliding-window rate limiter for seller AI verification requests.
 * Prevents automated denial-of-service or flooding of the AI verification API.
 */
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Default: max 15 requests per 60 seconds per seller ID
const DEFAULT_MAX_REQUESTS = 15;
const DEFAULT_WINDOW_MS = 60 * 1000;

export function checkVerificationRateLimit(
  sellerId: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = rateLimitMap.get(sellerId) || { timestamps: [] };

  // Filter timestamps within current window
  const recent = record.timestamps.filter((ts) => now - ts < windowMs);

  if (recent.length >= maxRequests) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  recent.push(now);
  rateLimitMap.set(sellerId, { timestamps: recent });

  // Periodically clean up stale entries if map grows large
  if (rateLimitMap.size > 2000) {
    for (const [key, val] of rateLimitMap.entries()) {
      const active = val.timestamps.filter((ts) => now - ts < windowMs);
      if (active.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, { timestamps: active });
      }
    }
  }

  return {
    allowed: true,
    remaining: maxRequests - recent.length,
    retryAfterSeconds: 0,
  };
}

export function resetVerificationRateLimits(): void {
  rateLimitMap.clear();
}

/**
 * Distributed rate limiter backed by the database for multi-instance production environments.
 * Inspects recent verification attempts recorded in Supabase product_verifications across all servers.
 */
export async function checkDistributedRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sellerId: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowSeconds = 60
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  try {
    // 1. Primary Strategy: Atomic database slot reservation (prevents concurrent burst bypass)
    if (typeof supabase?.rpc === "function") {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "check_and_record_verification_rate_limit",
        {
          p_seller_id: sellerId,
          p_max_requests: maxRequests,
          p_window_seconds: windowSeconds,
        }
      );

      if (!rpcError && rpcData && typeof rpcData.allowed === "boolean") {
        return {
          allowed: rpcData.allowed,
          remaining: rpcData.remaining ?? 0,
          retryAfterSeconds: rpcData.retry_after_seconds ?? 0,
        };
      }
    }

    // 2. Secondary Strategy / Fallback: Query audit records
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const { data, error } = await supabase
      .from("product_verifications")
      .select("created_at")
      .eq("seller_id", sellerId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true });

    if (error || !data) {
      // If DB read fails, allow local tier to handle throttling
      return { allowed: true, remaining: maxRequests, retryAfterSeconds: 0 };
    }

    if (data.length >= maxRequests) {
      const oldest = new Date(data[0].created_at).getTime();
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + windowSeconds * 1000 - Date.now()) / 1000)
      );
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - data.length),
      retryAfterSeconds: 0,
    };
  } catch (err) {
    console.warn("[Rate Limit] Distributed rate check fallback:", err);
    return { allowed: true, remaining: maxRequests, retryAfterSeconds: 0 };
  }
}
