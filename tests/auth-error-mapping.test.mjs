import assert from "node:assert/strict";

// Contract mirror of lib/supabase/auth-errors.ts (plain-node test, same
// convention as tests/cc018-cart-total.test.mjs which replicates helpers).
// If the source mapping changes, update this mirror to match.
const AUTH_RATE_LIMIT_MESSAGE =
  "Too many confirmation emails were requested. Please wait a little before trying again, or use an existing account.";
const AUTH_ALREADY_REGISTERED_MESSAGE =
  "This email address is already registered. Try logging in instead.";
const AUTH_GENERIC_SIGNUP_MESSAGE =
  "We couldn't create your account right now. Please try again.";
const AUTH_GENERIC_RESEND_MESSAGE =
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
const normalize = (v) => String(v ?? "").toLowerCase();
function isAuthRateLimitError(e) {
  if (!e) return false;
  if (normalize(e.status) === "429") return true;
  const code = normalize(e.code);
  if (code && (RATE_LIMIT_CODES.has(code) || code.includes("rate_limit")))
    return true;
  return RATE_LIMIT_MESSAGE_PARTS.some((p) => normalize(e.message).includes(p));
}
function isAlreadyRegisteredError(e) {
  if (!e) return false;
  const code = normalize(e.code);
  if (
    ALREADY_REGISTERED_CODES.has(code) ||
    code.includes("already_exists") ||
    code.includes("already_registered")
  )
    return true;
  return ALREADY_REGISTERED_MESSAGE_PARTS.some((p) =>
    normalize(e.message).includes(p)
  );
}
const mapSignupError = (e) =>
  isAuthRateLimitError(e)
    ? AUTH_RATE_LIMIT_MESSAGE
    : isAlreadyRegisteredError(e)
      ? AUTH_ALREADY_REGISTERED_MESSAGE
      : AUTH_GENERIC_SIGNUP_MESSAGE;
const mapResendError = (e) =>
  isAuthRateLimitError(e)
    ? AUTH_RATE_LIMIT_MESSAGE
    : isAlreadyRegisteredError(e)
      ? AUTH_ALREADY_REGISTERED_MESSAGE
      : AUTH_GENERIC_RESEND_MESSAGE;

// --- Rate limit: status, code, and message fallback ---
assert.equal(mapSignupError({ status: 429, message: "Whatever" }), AUTH_RATE_LIMIT_MESSAGE);
assert.equal(mapSignupError({ status: "429" }), AUTH_RATE_LIMIT_MESSAGE);
assert.equal(
  mapSignupError({ code: "over_email_send_rate_limit", message: "Email rate limit exceeded" }),
  AUTH_RATE_LIMIT_MESSAGE
);
assert.equal(
  mapSignupError({ message: "email rate limit exceeded" }),
  AUTH_RATE_LIMIT_MESSAGE
);
assert.equal(mapResendError({ status: 429 }), AUTH_RATE_LIMIT_MESSAGE);
assert.equal(
  mapResendError({ message: "For security purposes, you can only request this after 60 seconds" }),
  AUTH_GENERIC_RESEND_MESSAGE,
  "vague messages must not be treated as rate limits"
);

// --- Already registered (neutral wording, no raw leak) ---
assert.equal(
  mapSignupError({ code: "user_already_exists", message: "User already registered" }),
  AUTH_ALREADY_REGISTERED_MESSAGE
);
assert.equal(
  mapSignupError({ message: "User already registered" }),
  AUTH_ALREADY_REGISTERED_MESSAGE
);
assert.equal(mapResendError({ code: "user_already_exists" }), AUTH_ALREADY_REGISTERED_MESSAGE);

// --- Unknown / missing errors fall back to generic copy (never raw) ---
assert.equal(mapSignupError({ message: "Database error saving new user" }), AUTH_GENERIC_SIGNUP_MESSAGE);
assert.equal(mapSignupError(null), AUTH_GENERIC_SIGNUP_MESSAGE);
assert.equal(mapSignupError(undefined), AUTH_GENERIC_SIGNUP_MESSAGE);
assert.equal(mapResendError({ message: "Something exploded" }), AUTH_GENERIC_RESEND_MESSAGE);

// --- Raw strings never leak through the mapper ---
for (const raw of ["email rate limit exceeded", "User already registered", "Database error saving new user"]) {
  assert.ok(!mapSignupError({ message: raw }).includes(raw), `raw must not leak: ${raw}`);
  assert.ok(!mapResendError({ message: raw }).includes(raw), `raw must not leak: ${raw}`);
}

console.log("✅ ALL AUTH ERROR MAPPING TESTS PASSED");
