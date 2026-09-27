/**
 * CircuitCart — user-friendly Supabase Auth error mapping.
 *
 * Raw Supabase error strings must never reach users. These pure helpers map
 * known signup / resend-confirmation failures to safe, user-friendly copy.
 * This module is intentionally dependency-free so its contract can be
 * mirrored by plain-node tests (see tests/auth-error-mapping.test.mjs).
 */

export interface SupabaseAuthErrorLike {
  message?: string | null;
  code?: string | number | null;
  status?: string | number | null;
}

export const AUTH_RATE_LIMIT_MESSAGE =
  "Too many confirmation emails were requested. Please wait a little before trying again, or use an existing account.";

export const AUTH_ALREADY_REGISTERED_MESSAGE =
  "This email address is already registered. Try logging in instead.";

export const AUTH_GENERIC_SIGNUP_MESSAGE =
  "We couldn't create your account right now. Please try again.";

export const AUTH_GENERIC_RESEND_MESSAGE =
  "We couldn't resend the confirmation email right now. Please try again.";

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "email_rate_limit_exceeded",
  "too_many_requests",
  "rate_limit_exceeded",
  "over_request_rate_limit",
]);

const RATE_LIMIT_MESSAGE_PARTS = [
  "rate limit",
  "rate_limit",
  "ratelimit",
  "too many requests",
  "too many emails",
  "over_email_send",
  "email rate limit",
  "confirmation email rate",
];

const ALREADY_REGISTERED_CODES = new Set([
  "user_already_exists",
  "email_exists",
  "user_exists",
  "already_exists",
  "already_registered",
]);

const ALREADY_REGISTERED_MESSAGE_PARTS = [
  "already registered",
  "already exists",
  "already in use",
  "already been registered",
  "user already",
  "email already",
  "account already exists",
];

function normalize(value: string | number | null | undefined): string {
  return String(value ?? "").toLowerCase();
}

/**
 * Detects email rate limiting via numeric/status code first, then known
 * Supabase error codes, then message-substring fallback.
 */
export function isAuthRateLimitError(
  error: SupabaseAuthErrorLike | null | undefined
): boolean {
  if (!error) return false;
  const status = normalize(error.status);
  if (status === "429") return true;
  const code = normalize(error.code);
  if (!code) {
    // fall through to message check
  } else if (RATE_LIMIT_CODES.has(code) || code.includes("rate_limit")) {
    return true;
  }
  const message = normalize(error.message);
  return RATE_LIMIT_MESSAGE_PARTS.some((part) => message.includes(part));
}

/**
 * Detects an already-registered email without leaking account details.
 * Callers must use the neutral already-registered message, never raw text.
 */
export function isAlreadyRegisteredError(
  error: SupabaseAuthErrorLike | null | undefined
): boolean {
  if (!error) return false;
  const code = normalize(error.code);
  if (
    ALREADY_REGISTERED_CODES.has(code) ||
    code.includes("already_exists") ||
    code.includes("already_registered")
  ) {
    return true;
  }
  const message = normalize(error.message);
  return ALREADY_REGISTERED_MESSAGE_PARTS.some((part) =>
    message.includes(part)
  );
}

/** Maps signup failures to safe user-facing copy (never raw strings). */
export function mapSignupError(
  error: SupabaseAuthErrorLike | null | undefined
): string {
  if (isAuthRateLimitError(error)) return AUTH_RATE_LIMIT_MESSAGE;
  if (isAlreadyRegisteredError(error)) return AUTH_ALREADY_REGISTERED_MESSAGE;
  return AUTH_GENERIC_SIGNUP_MESSAGE;
}

/** Maps resend-confirmation failures to safe user-facing copy. */
export function mapResendError(
  error: SupabaseAuthErrorLike | null | undefined
): string {
  if (isAuthRateLimitError(error)) return AUTH_RATE_LIMIT_MESSAGE;
  if (isAlreadyRegisteredError(error)) return AUTH_ALREADY_REGISTERED_MESSAGE;
  return AUTH_GENERIC_RESEND_MESSAGE;
}
