/**
 * CircuitCart — Demo Card Sandbox Payment Helpers (ACADEMIC DEFENSE ONLY)
 *
 * This is NOT a real payment processor. No real money is ever charged and no
 * external gateway is contacted. Card details NEVER leave the buyer's browser:
 * only the last 4 digits are sent to the server, and the full number / CVV /
 * expiry are discarded from memory immediately after submission.
 */

export const DEMO_PROVIDER = "circuitcart_sandbox" as const;
export const DEMO_PAYMENT_METHOD = "demo_card" as const;

export function isDemoPaymentEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_PAYMENT_ENABLED === "true";
}

/** Dev-only failure simulation. Never exposed in production builds. */
export function isDemoSimulationAllowed(): boolean {
  return (
    isDemoPaymentEnabled() && process.env.NODE_ENV !== "production"
  );
}

export function stripCardDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Demo mode: accept any numeric card number (12-19 digits). No Luhn check. */
export function validateDemoCardNumber(value: string): string | null {
  const digits = stripCardDigits(value);
  if (digits.length === 0) return "Card number is required.";
  if (!/^\d+$/.test(digits)) return "Card number must contain only digits.";
  if (digits.length < 12 || digits.length > 19) {
    return "Enter the full card number printed on the card.";
  }
  return null;
}

export function formatDemoCardNumber(value: string): string {
  return stripCardDigits(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function deriveCardLast4(value: string): string {
  return stripCardDigits(value).slice(-4);
}

export function formatDemoExpiry(value: string): string {
  const digits = stripCardDigits(value).slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Demo mode: accept any reasonable expiration value (valid month, not expired). */
export function validateDemoExpiry(value: string): string | null {
  const digits = stripCardDigits(value);
  if (digits.length !== 4 && digits.length !== 6) {
    return "Use MM/YY format.";
  }
  const month = Number(digits.slice(0, 2));
  const yearPart = digits.slice(2);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "Enter a valid month (01-12).";
  }
  const fullYear =
    yearPart.length === 4 ? Number(yearPart) : 2000 + Number(yearPart);
  if (!Number.isInteger(fullYear)) return "Use MM/YY format.";
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (fullYear < currentYear || fullYear > currentYear + 20) {
    return "Enter a reasonable expiration year.";
  }
  if (fullYear === currentYear && month < currentMonth) {
    return "This card is expired. Use a future date for the demo.";
  }
  return null;
}

/** Demo mode: accept any 3 or 4 digit CVV. */
export function validateDemoCvv(value: string): string | null {
  const digits = stripCardDigits(value);
  if (digits.length === 0) return "CVV is required.";
  if (!/^\d{3,4}$/.test(digits)) return "CVV must be 3 or 4 digits.";
  return null;
}

export function validateDemoCardholder(value: string): string | null {
  if (value.trim().length < 2) return "Enter the cardholder name.";
  return null;
}

export function maskDemoCard(last4: string): string {
  return `•••• ${last4}`;
}
