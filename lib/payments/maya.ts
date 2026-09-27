/**
 * CircuitCart — Maya Sandbox Checkout Client & Utilities
 * Base API: https://pg-sandbox.paymaya.com
 * Sandbox only — no real money is ever processed.
 */

export const MAYA_SANDBOX_BASE_URL = "https://pg-sandbox.paymaya.com";

export interface MayaAmountDetails {
  subtotal?: number;
  shippingFee?: number;
  discount?: number;
  tax?: number;
}

export interface MayaTotalAmount {
  value: number;
  currency: "PHP";
  details?: MayaAmountDetails;
}

export interface MayaBuyerContact {
  phone?: string;
  email?: string;
}

export interface MayaBuyerAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  countryCode?: string;
}

export interface MayaBuyer {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  contact?: MayaBuyerContact;
  shippingAddress?: MayaBuyerAddress;
  billingAddress?: MayaBuyerAddress;
}

export interface MayaItemAmount {
  value: number;
  details?: {
    discount?: number;
    tax?: number;
  };
}

export interface MayaLineItem {
  name: string;
  quantity: number;
  code?: string;
  description?: string;
  amount?: MayaItemAmount;
  totalAmount?: MayaItemAmount;
}

export interface MayaRedirectUrls {
  success: string;
  failure: string;
  cancel: string;
}

export interface CreateMayaCheckoutPayload {
  totalAmount: MayaTotalAmount;
  buyer?: MayaBuyer;
  items?: MayaLineItem[];
  redirectUrl: MayaRedirectUrls;
  requestReferenceNumber: string;
  metadata?: Record<string, unknown>;
}

export interface MayaCheckoutResponse {
  checkoutId: string;
  redirectUrl: string;
}

export interface MayaCheckoutDetails {
  id: string;
  status: "COMPLETED" | "FAILED" | "EXPIRED" | "CANCELLED" | "PENDING" | "VOIDED";
  paymentStatus: "PAYMENT_SUCCESS" | "PAYMENT_FAILED" | "PAYMENT_EXPIRED" | "PAYMENT_CANCELLED" | "PENDING";
  amount: number;
  currency: string;
  requestReferenceNumber: string;
  receiptNumber?: string;
  paymentScheme?: string;
  fundSource?: {
    type?: string;
    description?: string;
    details?: {
      last4?: string;
      brand?: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Returns Base64 Basic Auth header for Maya API
 */
export function getMayaBasicAuth(key: string): string {
  const cleanKey = key.trim();
  return `Basic ${Buffer.from(`${cleanKey}:`).toString("base64")}`;
}

/**
 * Creates a Maya Sandbox Checkout Session
 * Uses MAYA_PUBLIC_KEY
 */
export async function createMayaSandboxCheckout(
  payload: CreateMayaCheckoutPayload
): Promise<MayaCheckoutResponse> {
  const publicKey = process.env.MAYA_PUBLIC_KEY;
  if (!publicKey || publicKey === "YOUR_MAYA_SANDBOX_PUBLIC_KEY") {
    throw new Error(
      "MAYA_PUBLIC_KEY is not configured in .env.local. Please provide your Maya Sandbox Public Key."
    );
  }

  const response = await fetch(`${MAYA_SANDBOX_BASE_URL}/checkout/v1/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getMayaBasicAuth(publicKey),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Maya Checkout Error (${response.status}): ${errorDetail || response.statusText}`);
  }

  const data = await response.json();
  if (!data.checkoutId || !data.redirectUrl) {
    throw new Error("Invalid response from Maya Sandbox Checkout API: missing redirectUrl.");
  }

  return {
    checkoutId: data.checkoutId,
    redirectUrl: data.redirectUrl,
  };
}

/**
 * Retrieves the real-time status of a Maya Checkout
 * Uses MAYA_SECRET_KEY
 */
export async function getMayaSandboxCheckoutDetails(
  checkoutId: string
): Promise<MayaCheckoutDetails> {
  const secretKey = process.env.MAYA_SECRET_KEY;
  if (!secretKey || secretKey === "YOUR_MAYA_SANDBOX_SECRET_KEY") {
    throw new Error(
      "MAYA_SECRET_KEY is not configured in .env.local. Please provide your Maya Sandbox Secret Key."
    );
  }

  const response = await fetch(`${MAYA_SANDBOX_BASE_URL}/checkout/v1/checkouts/${checkoutId}`, {
    method: "GET",
    headers: {
      Authorization: getMayaBasicAuth(secretKey),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Maya API Error (${response.status}): ${errorDetail || response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id || checkoutId,
    status: data.status,
    paymentStatus: data.paymentStatus || (data.status === "COMPLETED" ? "PAYMENT_SUCCESS" : data.status),
    amount: typeof data.totalAmount === "object" ? Number(data.totalAmount.value) : Number(data.amount || 0),
    currency: typeof data.totalAmount === "object" ? data.totalAmount.currency : data.currency || "PHP",
    requestReferenceNumber: data.requestReferenceNumber,
    receiptNumber: data.receiptNumber || data.transactionReferenceNumber,
    paymentScheme: data.paymentScheme,
    fundSource: data.fundSource,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
