import { createClient } from "./client";

export const PRODUCT_IMAGES_BUCKET = "product-images";
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

/**
 * Validates an image file before upload
 */
export function validateProductImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file format "${file.name}". Only JPG, PNG, and WebP images are allowed.`,
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is 5 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Uploads a product image to Supabase Storage inside the authenticated seller's folder
 */
export async function uploadProductImage(
  userId: string,
  productId: string,
  file: File
): Promise<{ storagePath: string; publicUrl: string }> {
  const validation = validateProductImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const supabase = createClient();
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "webp";
  const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
  const storagePath = `${userId}/${productId}/${uniqueName}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * Deletes a product image from Supabase Storage
 */
export async function deleteProductImage(storagePath: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error("Failed to delete storage object:", error);
  }
}

/**
 * Gets the public URL for a storage path
 */
export function getProductImageUrl(storagePath: string): string {
  if (!storagePath) return "";
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://") || storagePath.startsWith("/")) {
    return storagePath;
  }
  const supabase = createClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}
