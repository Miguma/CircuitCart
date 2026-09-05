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

  // 1. Protected buyer routes
  const isBuyerProtected =
    pathname.startsWith("/marketplace/profile") ||
    pathname.startsWith("/marketplace/orders") ||
    pathname.startsWith("/marketplace/settings");

  // 2. Protected seller routes
  const isSellerRoute = pathname.startsWith("/seller");

  // If user is not authenticated and attempts to visit protected route
  if (!user && (isBuyerProtected || isSellerRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // If user is authenticated and attempts to visit seller routes,
  // verify role STRICTLY from public.profiles table (do NOT trust user_metadata)
  if (user && isSellerRoute) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role;

    // DEFAULT DENY: Allow ONLY 'seller' or 'admin'
    // If profile does not exist, query fails, role is null, role is buyer, or role is unknown -> redirect to /marketplace
    if (error || !profile || !role || (role !== "seller" && role !== "admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/marketplace";
      url.searchParams.set("error", "seller_access_required");
      return NextResponse.redirect(url);
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
