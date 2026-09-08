import { createClient } from "./client";
import type {
  DbSellerVerificationRequest,
  SellerVerificationWithProfile,
  SubmitSellerVerificationInput,
} from "./types";

export interface VerificationResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

/**
 * Validate verification document image
 */
export function validateVerificationFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File "${file.name}" exceeds 5MB maximum limit.` };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `File "${file.name}" has unsupported type (${file.type}). Allowed formats: JPEG, PNG, WebP.`,
    };
  }

  return { valid: true };
}

/**
 * Upload a sensitive verification document to private seller-verification bucket
 */
export async function uploadVerificationDocument(
  file: File,
  docType: "id-front" | "id-back" | "selfie"
): Promise<{ path: string | null; error?: string }> {
  try {
    const validation = validateVerificationFile(file);
    if (!validation.valid) {
      return { path: null, error: validation.error };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { path: null, error: "Authentication required to upload verification documents." };
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const storagePath = `${user.id}/${docType}-${Date.now()}-${randomSuffix}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("seller-verification")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return { path: null, error: uploadError.message || "Failed to upload document." };
    }

    return { path: storagePath };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to upload document.";
    return { path: null, error: errorMsg };
  }
}

/**
 * Get the latest verification request for the current authenticated user
 */
export async function getMyVerificationRequest(): Promise<DbSellerVerificationRequest | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from("seller_verification_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error loading seller verification request:", error);
      return null;
    }

    return (data as DbSellerVerificationRequest) || null;
  } catch {
    return null;
  }
}

/**
 * Submit seller verification through secure RPC
 */
export async function submitSellerVerification(
  input: SubmitSellerVerificationInput
): Promise<VerificationResponse<DbSellerVerificationRequest>> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.rpc("submit_seller_verification", {
      p_seller_type: input.seller_type,
      p_full_name: input.full_name,
      p_date_of_birth: input.date_of_birth,
      p_city_address: input.city_address,
      p_business_name: input.business_name || null,
      p_id_type: input.id_type,
      p_id_front_path: input.id_front_path,
      p_id_back_path: input.id_back_path || null,
      p_selfie_path: input.selfie_path,
      p_contact_email: input.contact_email,
      p_contact_phone: input.contact_phone,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to submit seller verification request.",
      };
    }

    return {
      success: true,
      data: data as DbSellerVerificationRequest,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Generate temporary signed preview URL for private verification documents (1 hour expiry)
 */
export async function getVerificationDocumentSignedUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  try {
    if (!path) return null;
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("seller-verification")
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Admin: Get all pending seller verification requests
 */
export async function getPendingVerificationRequests(): Promise<SellerVerificationWithProfile[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("seller_verification_requests")
      .select("*, profiles!seller_verification_requests_user_id_fkey(*)")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching verification requests for admin:", error);
      return [];
    }

    return (data as SellerVerificationWithProfile[]) || [];
  } catch {
    return [];
  }
}

/**
 * Admin: Review a seller verification request
 */
export async function reviewSellerVerification(
  requestId: string,
  decision: "approved" | "rejected",
  reason?: string
): Promise<VerificationResponse<DbSellerVerificationRequest>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("review_seller_verification", {
      p_request_id: requestId,
      p_decision: decision,
      p_reason: reason || null,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to review seller verification request.",
      };
    }

    return {
      success: true,
      data: data as DbSellerVerificationRequest,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}
