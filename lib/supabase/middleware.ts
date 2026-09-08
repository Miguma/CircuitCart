import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined."
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 1. Routes requiring authentication (any valid role)
  const isAuthRequired =
    pathname.startsWith("/marketplace/profile") ||
    pathname.startsWith("/marketplace/orders") ||
    pathname.startsWith("/marketplace/settings") ||
    pathname === "/sell" ||
    pathname.startsWith("/sell/") ||
    pathname.startsWith("/seller") ||
    pathname.startsWith("/admin");

  // If user is not authenticated and attempts to visit an auth-required route
  if (!user && isAuthRequired) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Protected seller management routes (excludes /seller/verification)
  // /seller/verification is explicitly whitelisted for authenticated buyers/sellers/admins
  const isSellerManagementRoute =
    pathname.startsWith("/seller") &&
    pathname !== "/seller/verification" &&
    !pathname.startsWith("/seller/verification/");

  // 3. Protected admin routes
  const isAdminRoute = pathname.startsWith("/admin");

  // If user is authenticated and attempts to visit role-restricted routes,
  // verify role STRICTLY from public.profiles table (do NOT trust user_metadata)
  if (user && (isSellerManagementRoute || isAdminRoute)) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role;

    if (isSellerManagementRoute) {
      // DEFAULT DENY: Allow ONLY 'seller' or 'admin'
      // If profile does not exist, query fails, role is null, role is buyer, or role is unknown -> redirect to /marketplace
      if (error || !profile || !role || (role !== "seller" && role !== "admin")) {
        const url = request.nextUrl.clone();
        url.pathname = "/marketplace";
        url.searchParams.set("error", "seller_access_required");
        return NextResponse.redirect(url);
      }
    }

    if (isAdminRoute) {
      // DEFAULT DENY: Allow ONLY 'admin'
      if (error || !profile || !role || role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/marketplace";
        url.searchParams.set("error", "admin_access_required");
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect authenticated users away from /login and /register if already logged in
  if (user && (pathname === "/login" || pathname === "/register")) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo") || "/marketplace";
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    url.searchParams.delete("redirectTo");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
