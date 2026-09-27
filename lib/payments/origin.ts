export interface RequestLike {
  headers: Headers;
  url: string;
  nextUrl?: URL;
}

/**
 * CircuitCart — Safe Origin Validation for Payment Endpoints
 *
 * Validates that an incoming state-changing payment request originates from
 * our own application.
 *
 * Supports:
 * 1. Direct local requests: http://localhost:3000 (or any local port)
 * 2. Reverse proxy / Cloudflare Tunnel: https://circuitcart.artecloud.site
 *    via x-forwarded-host and x-forwarded-proto
 * 3. Host header with protocol inference
 * 4. Explicit deployment origins via CHECKOUT_TRUSTED_ORIGIN, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL
 *
 * Security guarantees:
 * - Rejects any request with Sec-Fetch-Site === "cross-site"
 * - Rejects requests without a valid Origin header (state-changing browser POSTs always include Origin)
 * - Compares normalized scheme://host[:port] origins
 * - Prevents cross-origin CSRF/state mutation attacks
 */
export function isValidOrigin(request: RequestLike): boolean {
  const headers = request.headers;

  // 1. Explicit cross-site fetch must always be blocked
  if (headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }

  const originHeader = headers.get("origin");
  if (!originHeader) {
    return false;
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(originHeader).origin.toLowerCase();
  } catch {
    return false;
  }

  const allowedOrigins = new Set<string>();

  // A. Internal request URL origin (e.g. http://localhost:3000)
  try {
    allowedOrigins.add(new URL(request.url).origin.toLowerCase());
  } catch {}

  // NextRequest.nextUrl if present
  if ("nextUrl" in request && request.nextUrl?.origin) {
    try {
      allowedOrigins.add(new URL(request.nextUrl.origin).origin.toLowerCase());
    } catch {}
  }

  // B. Reverse proxy / Cloudflare Tunnel headers:
  const forwardedHostHeader = headers.get("x-forwarded-host");
  const forwardedProtoHeader = headers.get("x-forwarded-proto");

  if (forwardedHostHeader) {
    // First host in comma-separated list is the client-facing host
    const clientHost = forwardedHostHeader.split(",")[0].trim();
    if (clientHost) {
      if (forwardedProtoHeader) {
        const proto = forwardedProtoHeader.split(",")[0].trim().toLowerCase();
        try {
          allowedOrigins.add(new URL(`${proto}://${clientHost}`).origin.toLowerCase());
        } catch {}
      }
      try {
        allowedOrigins.add(new URL(`https://${clientHost}`).origin.toLowerCase());
      } catch {}
      try {
        allowedOrigins.add(new URL(`http://${clientHost}`).origin.toLowerCase());
      } catch {}
    }
  }

  // C. Host header (often preserved or forwarded by proxies)
  const hostHeader = headers.get("host")?.trim();
  if (hostHeader) {
    if (forwardedProtoHeader) {
      const proto = forwardedProtoHeader.split(",")[0].trim().toLowerCase();
      try {
        allowedOrigins.add(new URL(`${proto}://${hostHeader}`).origin.toLowerCase());
      } catch {}
    }
    try {
      allowedOrigins.add(new URL(`https://${hostHeader}`).origin.toLowerCase());
      allowedOrigins.add(new URL(`http://${hostHeader}`).origin.toLowerCase());
    } catch {}
  }

  // D. Configured deployment environment variables
  const envOrigins = [
    process.env.CHECKOUT_TRUSTED_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  for (const envVal of envOrigins) {
    if (envVal?.trim()) {
      try {
        const val = envVal.trim();
        const withProto = /^https?:\/\//i.test(val) ? val : `https://${val}`;
        allowedOrigins.add(new URL(withProto).origin.toLowerCase());
      } catch {}
    }
  }

  return allowedOrigins.has(requestOrigin);
}
