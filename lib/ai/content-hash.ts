import { createHash } from "node:crypto";

/**
 * Trims exactly the characters PostgreSQL's btrim(x, E' \t\n\r\f\v') removes.
 * String.prototype.trim() also strips NBSP/BOM/etc., which would make the API hash
 * diverge from public.calculate_product_verification_hash().
 */
export function sqlTrim(value: string | null | undefined): string {
  return (value || "").replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Calculates a deterministic SHA-256 content hash of the product's material fields.
 * Matches PostgreSQL's public.calculate_product_content_hash(title, category, specs, description).
 */
export function computeProductTextHash(
  title: string,
  category: string,
  specs?: string | null,
  description?: string | null
): string {
  const normalized = [
    sqlTrim(title),
    sqlTrim(category),
    sqlTrim(specs),
    sqlTrim(description),
  ].join("|");

  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Comprehensive content hash including product text fields and sorted image paths.
 * Must stay byte-identical to PostgreSQL public.calculate_product_verification_hash(product_id),
 * which apply_product_ai_decision uses for its p_expected_hash race-condition guard.
 */
export function computeProductVerificationHash(
  title: string,
  category: string,
  specs?: string | null,
  description?: string | null,
  imageUrls: string[] = []
): string {
  const textPayload = [
    sqlTrim(title),
    sqlTrim(category),
    sqlTrim(specs),
    sqlTrim(description),
  ].join("|");

  const imagesPayload = [...imageUrls].sort().join(",");
  const fullPayload = `${textPayload}::images::${imagesPayload}`;

  return createHash("sha256").update(fullPayload, "utf8").digest("hex");
}

export function calculateProductContentHash(input: {
  title: string;
  category: string;
  specs?: string | null;
  description?: string | null;
  images?: string[];
}): string {
  return computeProductVerificationHash(
    input.title,
    input.category,
    input.specs,
    input.description,
    input.images || []
  );
}

export function calculateImageHash(buffer: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}
