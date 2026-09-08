import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  requestId?: string;
}

interface VerificationRecord {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  city_address: string;
  business_name?: string | null;
  id_type: string;
  id_front_path: string;
  id_back_path?: string | null;
  selfie_path: string;
  contact_email: string;
  contact_phone: string;
  status: string;
}

interface AnalysisResult {
  score: number;
  status: "passed" | "manual_review" | "failed";
  flags: string[];
  extractedName: string | null;
  extractedDob: string | null;
  extractedIdType: string | null;
  summary: string;
}

interface OcrProviderResult {
  providerSucceeded: boolean;
  text: string;
  confidence: number;
  error?: string;
}

/**
 * Normalize text for string comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate token overlap similarity between applicant name and document text
 */
function calculateNameMatch(
  applicantName: string,
  documentText: string
): { isMatch: boolean; isStrongMatch: boolean; similarity: number } {
  const normApp = normalizeString(applicantName);
  const normDoc = normalizeString(documentText);

  if (!normApp || !normDoc) {
    return { isMatch: false, isStrongMatch: false, similarity: 0 };
  }

  // Exact substring check
  if (normDoc.includes(normApp)) {
    return { isMatch: true, isStrongMatch: true, similarity: 1.0 };
  }

  const appTokens = normApp.split(" ").filter((t) => t.length > 1);
  if (appTokens.length === 0) {
    return { isMatch: false, isStrongMatch: false, similarity: 0 };
  }

  let matchedTokens = 0;
  for (const token of appTokens) {
    if (normDoc.includes(token)) {
      matchedTokens++;
    }
  }

  const ratio = matchedTokens / appTokens.length;
  return {
    isMatch: ratio >= 0.66,
    isStrongMatch: ratio >= 0.99 || (appTokens.length >= 2 && matchedTokens === appTokens.length),
    similarity: ratio,
  };
}

/**
 * Check if document text contains keywords corresponding to the selected Philippine ID type
 */
function matchIdType(
  selectedIdType: string,
  documentText: string
): { matches: boolean; detectedType: string | null } {
  const normDoc = normalizeString(documentText);
  const normSelected = normalizeString(selectedIdType);

  const idKeywords: Record<string, string[]> = {
    "Philippine National ID (PhilID)": [
      "philippine identification system",
      "philid",
      "republika ng pilipinas",
      "national id",
      "psa",
      "pambansang pagkakakilanlan",
    ],
    "LTO Driver's License": [
      "driver's license",
      "drivers license",
      "land transportation office",
      "lto",
      "license no",
    ],
    "Philippine Passport": [
      "passport",
      "pasaporte",
      "department of foreign affairs",
      "dfa",
      "republic of the philippines",
    ],
    "Unified Multi-Purpose ID (UMID)": [
      "unified multi purpose",
      "umid",
      "social security system",
      "sss",
      "gsis",
    ],
    "Postal ID": [
      "postal id",
      "phlpost",
      "philippine postal corporation",
      "postal identity",
    ],
    "PRC ID": [
      "professional regulation commission",
      "prc",
      "professional identification card",
    ],
  };

  let detectedType: string | null = null;
  for (const [idType, keywords] of Object.entries(idKeywords)) {
    for (const kw of keywords) {
      if (normDoc.includes(kw)) {
        detectedType = idType;
        break;
      }
    }
    if (detectedType) break;
  }

  // If detected type matches selected, or selected keywords match document
  const matches =
    detectedType === selectedIdType ||
    (idKeywords[selectedIdType] &&
      idKeywords[selectedIdType].some((kw) => normDoc.includes(kw))) ||
    normDoc.includes(normSelected);

  return { matches: !!matches, detectedType: detectedType || selectedIdType };
}

/**
 * Extract dates from text in common Philippine ID formats
 */
function extractDatesFromText(text: string): string[] {
  const foundDates: string[] = [];
  // YYYY-MM-DD
  const isoPattern = /\b(19\d\d|20\d\d)[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g;
  let match;
  while ((match = isoPattern.exec(text)) !== null) {
    foundDates.push(`${match[1]}-${match[2]}-${match[3]}`);
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const slashPattern = /\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](19\d\d|20\d\d)\b/g;
  while ((match = slashPattern.exec(text)) !== null) {
    foundDates.push(`${match[3]}-${match[2]}-${match[1]}`);
  }

  return foundDates;
}

/**
 * Validate image file structure without pseudo-OCR decoding
 */
function validateImageFileIntegrity(
  imageBytes: Uint8Array
): { isValid: boolean; error?: string } {
  if (imageBytes.length < 30 * 1024) {
    return { isValid: false, error: "Image file is too small (<30KB)." };
  }

  const isJpg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8;
  const isPng =
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47;
  const isWebp =
    imageBytes.length > 12 &&
    imageBytes[8] === 0x57 &&
    imageBytes[9] === 0x45 &&
    imageBytes[10] === 0x42 &&
    imageBytes[11] === 0x50;

  if (!isJpg && !isPng && !isWebp) {
    return { isValid: false, error: "Invalid image format header (JPEG, PNG, WebP only)." };
  }

  return { isValid: true };
}

/**
 * OCR Engine Integration Point
 * Strictly queries configured OCR provider (e.g. Google Cloud Vision API).
 * NEVER decodes raw JPEG/PNG binary bytes as pseudo-text.
 */
async function performDocumentOcr(
  imageBytes: Uint8Array
): Promise<OcrProviderResult> {
  const ocrApiKey = Deno.env.get("OCR_API_KEY") || Deno.env.get("GOOGLE_VISION_API_KEY");

  // If OCR provider is not configured, return explicit provider failure state
  if (!ocrApiKey) {
    return {
      providerSucceeded: false,
      text: "",
      confidence: 0,
      error: "OCR provider not configured (missing OCR_API_KEY / GOOGLE_VISION_API_KEY).",
    };
  }

  try {
    const base64Image = btoa(
      Array.from(imageBytes)
        .map((b) => String.fromCharCode(b))
        .join("")
    );

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${ocrApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }),
      }
    );

    if (!visionRes.ok) {
      const errText = await visionRes.text().catch(() => "");
      return {
        providerSucceeded: false,
        text: "",
        confidence: 0,
        error: `OCR API request failed with status ${visionRes.status}: ${errText}`,
      };
    }

    const data = await visionRes.json();
    const fullTextAnnotation = data.responses?.[0]?.fullTextAnnotation;
    const textAnnotations = data.responses?.[0]?.textAnnotations;
    const extractedText = (fullTextAnnotation?.text || textAnnotations?.[0]?.description || "").trim();

    if (!extractedText) {
      return {
        providerSucceeded: false,
        text: "",
        confidence: 0,
        error: "OCR provider detected no readable text in document.",
      };
    }

    // Conservative confidence estimation
    let confidence = 0.85;
    const pages = fullTextAnnotation?.pages;
    if (pages && pages.length > 0 && typeof pages[0].confidence === "number") {
      confidence = Math.min(1.0, Math.max(0.1, pages[0].confidence));
    }

    return {
      providerSucceeded: true,
      text: extractedText,
      confidence,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OCR provider error";
    return {
      providerSucceeded: false,
      text: "",
      confidence: 0,
      error: msg,
    };
  }
}

/**
 * Main automated verification analysis
 */
async function analyzeVerificationRequest(
  req: VerificationRecord,
  imageBytes: Uint8Array
): Promise<AnalysisResult> {
  const flags: string[] = [];
  let score = 0;

  // 1. Image Format / Readability (+15 points max)
  const imageIntegrity = validateImageFileIntegrity(imageBytes);
  if (imageIntegrity.isValid) {
    score += 15;
  } else {
    flags.push("UNREADABLE_DOCUMENT");
  }

  // 2. Required Fields Completeness (+10 points max)
  const hasRequiredFields =
    Boolean(req.full_name?.trim()) &&
    Boolean(req.date_of_birth) &&
    Boolean(req.city_address?.trim()) &&
    Boolean(req.contact_email?.trim()) &&
    Boolean(req.contact_phone?.trim()) &&
    Boolean(req.id_type?.trim());

  if (hasRequiredFields) {
    score += 10;
  }

  // 3. Age Verification (Applicant >= 18)
  let ageVerified = false;
  if (req.date_of_birth) {
    const dob = new Date(req.date_of_birth);
    const ageDiffMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDiffMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    if (age >= 18) {
      ageVerified = true;
    } else {
      flags.push("UNDERAGE_APPLICANT");
    }
  }

  // 4. Real OCR Document Text Extraction
  const ocrResult = await performDocumentOcr(imageBytes);

  let ocrSucceeded = false;
  let nameVerified = false;
  let dobVerified = false;
  let idTypeVerified = false;

  let extractedName: string | null = null;
  let extractedDob: string | null = null;
  let extractedIdType: string | null = null;

  if (!ocrResult.providerSucceeded || !ocrResult.text.trim()) {
    flags.push("OCR_FAILED");
  } else {
    ocrSucceeded = true;
    const docText = ocrResult.text;

    // A. Real Name Match (+35 points max)
    const nameAnalysis = calculateNameMatch(req.full_name, docText);
    if (nameAnalysis.isStrongMatch) {
      score += 35;
      nameVerified = true;
      extractedName = req.full_name;
    } else if (nameAnalysis.isMatch) {
      score += 20;
      nameVerified = true;
      extractedName = req.full_name;
    } else {
      flags.push("NAME_MISMATCH");
    }

    // B. Real DOB Match (+25 points max)
    const extractedDates = extractDatesFromText(docText);
    if (extractedDates.includes(req.date_of_birth)) {
      score += 25;
      dobVerified = true;
      extractedDob = req.date_of_birth;
    } else if (extractedDates.length > 0) {
      extractedDob = extractedDates[0];
      if (extractedDob === req.date_of_birth) {
        score += 25;
        dobVerified = true;
      } else {
        flags.push("DOB_MISMATCH");
      }
    } else {
      flags.push("DOB_MISMATCH");
    }

    // C. Real ID Type Match (+15 points max)
    const idTypeAnalysis = matchIdType(req.id_type, docText);
    if (idTypeAnalysis.matches) {
      score += 15;
      idTypeVerified = true;
      extractedIdType = idTypeAnalysis.detectedType || req.id_type;
    } else {
      flags.push("ID_TYPE_MISMATCH");
    }
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Critical Flags List
  const criticalFlags = [
    "NAME_MISMATCH",
    "DOB_MISMATCH",
    "UNREADABLE_DOCUMENT",
    "ID_TYPE_MISMATCH",
    "OCR_FAILED",
    "UNDERAGE_APPLICANT",
  ];

  const hasCriticalFlag = flags.some((f) => criticalFlags.includes(f));

  // STRICT AUTO-APPROVAL INVARIANTS:
  // Must satisfy ALL explicit boolean conditions
  const canAutoApprove =
    ocrSucceeded &&
    nameVerified &&
    dobVerified &&
    idTypeVerified &&
    ageVerified &&
    score >= 90 &&
    !hasCriticalFlag;

  let status: "passed" | "manual_review" | "failed" = "manual_review";
  let summary = "";

  if (canAutoApprove) {
    status = "passed";
    summary = `Automated verification passed with score ${score}/100. Real OCR verified name, birthdate, and Philippine ID credentials.`;
  } else {
    status = "manual_review";
    if (!ocrSucceeded) {
      summary = `Automated checks queued application for manual review (OCR extraction was unavailable or unreadable). Score: ${score}/100.`;
    } else if (hasCriticalFlag) {
      summary = `Automated review flagged items for manual review: ${flags.join(", ")} (Score: ${score}/100).`;
    } else {
      summary = `Automated review completed with score ${score}/100. Application queued for manual administrator review.`;
    }
  }

  return {
    score,
    status,
    flags,
    extractedName,
    extractedDob,
    extractedIdType,
    summary,
  };
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL environment variable.");
    }

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientForAuth = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await clientForAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized caller" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json().catch(() => ({}));
    const { requestId } = body;

    if (!requestId) {
      return new Response(JSON.stringify({ error: "Missing requestId parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin client with service_role key to securely fetch private verification record
    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      { auth: { persistSession: false } }
    );

    // Fetch caller profile to check admin role
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isCallerAdmin = callerProfile?.role === "admin";

    // Fetch verification request
    const { data: vReq, error: reqError } = await adminClient
      .from("seller_verification_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (reqError || !vReq) {
      return new Response(JSON.stringify({ error: "Verification request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership or admin
    if (vReq.user_id !== user.id && !isCallerAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Not owner of verification request" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refuse to process non-pending requests
    if (vReq.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: `Request has already been processed (status: ${vReq.status})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark as processing
    await adminClient
      .from("seller_verification_requests")
      .update({
        automated_review_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    // Download front ID photo from private seller-verification bucket
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("seller-verification")
      .download(vReq.id_front_path);

    if (downloadError || !fileData) {
      console.error("Failed to download document for verification:", downloadError);
      // Mark as failed automated check, but keep request pending for manual review
      await adminClient
        .from("seller_verification_requests")
        .update({
          automated_review_status: "manual_review",
          automated_flags: ["UNREADABLE_DOCUMENT", "OCR_FAILED"],
          automated_score: 0,
          automated_review_summary: "Could not retrieve document for automated review. Queued for manual admin review.",
          automated_reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return new Response(
        JSON.stringify({
          success: false,
          status: "manual_review",
          message: "Could not download verification document. Queued for manual review.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const imageBytes = new Uint8Array(arrayBuffer);

    // Run automated analysis
    const result = await analyzeVerificationRequest(vReq, imageBytes);

    // Record automated review results
    await adminClient
      .from("seller_verification_requests")
      .update({
        automated_review_status: result.status,
        automated_score: result.score,
        automated_flags: result.flags,
        extracted_full_name: result.extractedName,
        extracted_date_of_birth: result.extractedDob,
        extracted_id_type: result.extractedIdType,
        automated_review_summary: result.summary,
        automated_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    // If passed, invoke secure backend auto-approval RPC
    let autoApproved = false;
    if (result.status === "passed") {
      const { error: approveError } = await adminClient.rpc(
        "auto_approve_seller_verification",
        { p_request_id: requestId }
      );

      if (!approveError) {
        autoApproved = true;
      } else {
        console.error("Auto approval RPC failed:", approveError);
        // Fall back to manual review
        await adminClient
          .from("seller_verification_requests")
          .update({
            automated_review_status: "manual_review",
            automated_review_summary: `Verification scored ${result.score}/100 but auto-approval encountered an exception. Queued for manual review.`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: autoApproved ? "passed" : result.status,
        score: result.score,
        flags: result.flags,
        summary: result.summary,
        autoApproved,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Automated seller verification error:", err);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
