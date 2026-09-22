import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // 1. Inspect incoming Supabase provider errors first
  const providerError = searchParams.get("error");
  const providerErrorCode = searchParams.get("error_code");
  const providerErrorDescription = searchParams.get("error_description");

  if (providerError || providerErrorCode || providerErrorDescription) {
    console.error("[auth/callback] Provider error received:", {
      error: providerError,
      errorCode: providerErrorCode,
      description: providerErrorDescription,
    });

    if (
      providerErrorCode === "otp_expired" ||
      providerErrorDescription?.toLowerCase().includes("expired")
    ) {
      return NextResponse.redirect(`${origin}/login?error=confirmation_expired`);
    }

    if (
      providerError === "access_denied" ||
      providerErrorCode === "access_denied" ||
      providerErrorCode === "invalid_request" ||
      providerErrorDescription?.toLowerCase().includes("invalid") ||
      providerErrorDescription?.toLowerCase().includes("already")
    ) {
      return NextResponse.redirect(`${origin}/login?error=confirmation_invalid`);
    }

    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");

  // 2. Handle token_hash verification (explicitly accepting type="email")
  if (token_hash) {
    // Explicitly validate type parameter - only accept "email" for email confirmation
    if (rawType !== "email") {
      console.warn("[auth/callback] Rejected unsupported OTP type:", {
        type: rawType,
      });
      return NextResponse.redirect(`${origin}/login?error=confirmation_invalid`);
    }

    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash,
      });

      if (!error) {
        // Clear cookie session on the server so the user lands cleanly on /login?confirmed=1
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?confirmed=1`);
      }

      console.error("[auth/callback] OTP verification failed:", {
        name: error.name,
        status: error.status,
        code: error.code,
        message: error.message,
      });

      const msg = (error.message || "").toLowerCase();
      if (msg.includes("expired")) {
        return NextResponse.redirect(`${origin}/login?error=confirmation_expired`);
      }

      if (
        msg.includes("invalid") ||
        msg.includes("already") ||
        msg.includes("token has expired or is invalid")
      ) {
        return NextResponse.redirect(`${origin}/login?error=confirmation_invalid`);
      }

      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    } catch (err) {
      console.error("[auth/callback] Unexpected exception during OTP verify:", {
        message: err instanceof Error ? err.message : "Unknown error",
      });
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  }

  // 3. Handle PKCE code exchange fallback
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        // Clear cookie session on the server so the user lands cleanly on /login?confirmed=1
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?confirmed=1`);
      }

      console.error("[auth/callback] Code exchange failed:", {
        name: error.name,
        status: error.status,
        code: error.code,
        message: error.message,
      });

      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("already been used") ||
        msg.includes("both auth code and code verifier should be non-empty") ||
        msg.includes("code verifier") ||
        msg.includes("invalid flow state") ||
        msg.includes("invalid")
      ) {
        return NextResponse.redirect(`${origin}/login?error=confirmation_invalid`);
      }

      if (msg.includes("expired")) {
        return NextResponse.redirect(`${origin}/login?error=confirmation_expired`);
      }

      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    } catch (err) {
      console.error("[auth/callback] Unexpected exception during code exchange:", {
        message: err instanceof Error ? err.message : "Unknown error",
      });
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  }

  // 4. Missing parameters (neither token_hash, nor code, nor provider error)
  console.warn("[auth/callback] Missing required callback parameters.");
  return NextResponse.redirect(`${origin}/login?error=confirmation_invalid`);
}
