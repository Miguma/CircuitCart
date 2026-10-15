export type VerificationDecision = "TECH_APPROVED" | "NON_TECH_REJECTED" | "UNCERTAIN";

export interface ProductVerificationInput {
  productId: string;
  sellerId: string;
  title: string;
  category: string;
  condition: string;
  price: number;
  specs?: string | null;
  description?: string | null;
  location?: string | null;
  imageUrls: string[];
}

export interface VerificationResult {
  decision: VerificationDecision;
  confidence: number;
  reason: string;
  suggestedCategory?: string | null;
  flaggedReasons: string[];
  modelUsed: string;
  contentHash: string;
  analyzedAt: string;
  rawResponse?: unknown;
}

export interface AiVerificationProvider {
  readonly name: string;
  verify(input: ProductVerificationInput, contentHash: string): Promise<VerificationResult>;
}
