import {
  AiVerificationProvider,
  ProductVerificationInput,
  VerificationResult,
  VerificationDecision,
} from "./types";
import {
  PRODUCT_VERIFICATION_SYSTEM_PROMPT,
  buildProductVerificationUserPrompt,
} from "./prompt";

// -----------------------------------------------------------------------------
// 1. Hosted Multimodal AI Provider (Google Gemini)
// -----------------------------------------------------------------------------
export class GeminiVerificationProvider implements AiVerificationProvider {
  readonly name = "gemini-multimodal";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-3.8-flash") {
    this.apiKey = apiKey;
    this.model = process.env.GEMINI_MODEL || model;
  }

  async verify(
    input: ProductVerificationInput,
    contentHash: string
  ): Promise<VerificationResult> {
    // 1. Prepare image parts (up to 5 images)
    const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];

    for (const url of input.imageUrls.slice(0, 5)) {
      try {
        if (url.startsWith("data:")) {
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            imageParts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
            continue;
          }
        }

        // Fetch remote image if valid HTTP URL
        if (url.startsWith("http://") || url.startsWith("https://")) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);

          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const contentType = res.headers.get("content-type") || "image/jpeg";
            imageParts.push({
              inlineData: {
                mimeType: contentType.split(";")[0],
                data: base64,
              },
            });
          }
        }
      } catch (err) {
        console.warn(`[AI Verification] Could not fetch image for inspection: ${url}`, err);
      }
    }

    // 2. Build contents payload
    const textPrompt = buildProductVerificationUserPrompt({
      title: input.title,
      category: input.category,
      condition: input.condition,
      price: input.price,
      specs: input.specs,
      description: input.description,
      imageCount: imageParts.length,
    });

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: textPrompt },
      ...imageParts,
    ];

    const body = {
      systemInstruction: {
        parts: [{ text: PRODUCT_VERIFICATION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };

    const candidateModels = [this.model];
    for (const fallback of ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.8-flash"]) {
      if (!candidateModels.includes(fallback)) {
        candidateModels.push(fallback);
      }
    }

    let lastErrorStatus: number | null = null;
    let lastErrorText = "";

    for (const modelToTry of candidateModels) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelToTry
        )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (!response.ok) {
            lastErrorStatus = response.status;
            lastErrorText = await response.text();
            console.warn(
              `[AI Verification] Model ${modelToTry} attempt ${attempt} returned HTTP ${response.status}:`,
              lastErrorText.slice(0, 160)
            );
            if (response.status === 503) {
              // Bounded exponential backoff for transient spikes
              await new Promise((r) => setTimeout(r, 1000 * attempt));
              continue;
            }
            if (response.status === 429) {
              // Quota/rate limit on this model; break out of retry loop to try next model candidate
              break;
            }
            // Non-transient error, break out to try next candidate
            break;
          }

          const json = await response.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!rawText) {
            return {
              decision: "UNCERTAIN",
              confidence: 0,
              reason: "Empty response from AI analysis model.",
              flaggedReasons: ["EMPTY_RESPONSE"],
              modelUsed: modelToTry,
              contentHash,
              analyzedAt: new Date().toISOString(),
              rawResponse: json,
            };
          }

          const parsed = JSON.parse(rawText);
          const decision: VerificationDecision =
            parsed.decision === "TECH_APPROVED"
              ? "TECH_APPROVED"
              : parsed.decision === "NON_TECH_REJECTED"
              ? "NON_TECH_REJECTED"
              : "UNCERTAIN";

          return {
            decision,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
            reason:
              typeof parsed.reason === "string" && parsed.reason.trim()
                ? parsed.reason.trim()
                : decision === "TECH_APPROVED"
                ? "Verified technology product listing."
                : "Product does not meet technology-only marketplace requirements.",
            suggestedCategory: parsed.suggested_category || null,
            flaggedReasons: Array.isArray(parsed.flagged_reasons) ? parsed.flagged_reasons : [],
            modelUsed: modelToTry,
            contentHash,
            analyzedAt: new Date().toISOString(),
            rawResponse: parsed,
          };
        } catch (err) {
          clearTimeout(timer);
          console.error(`[AI Verification] Attempt ${attempt} on ${modelToTry} failed:`, err);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }
    }

    return {
      decision: "UNCERTAIN",
      confidence: 0,
      reason: `AI service returned error ${lastErrorStatus || "TIMEOUT"}. Please retry verification.`,
      flaggedReasons: ["API_ERROR"],
      modelUsed: this.model,
      contentHash,
      analyzedAt: new Date().toISOString(),
      rawResponse: { status: lastErrorStatus, body: lastErrorText },
    };
  }
}

// -----------------------------------------------------------------------------
// 2. Local Heuristic Provider (Deterministic Offline & Testing Provider)
// -----------------------------------------------------------------------------
const TECH_POSITIVE_TOKENS = new Set([
  "laptop", "notebook", "ultrabook", "macbook", "thinkpad", "desktop", "pc",
  "computer", "gpu", "graphics", "card", "geforce", "rtx", "gtx", "radeon",
  "cpu", "processor", "intel", "amd", "ryzen", "core", "motherboard", "ram",
  "ddr4", "ddr5", "ssd", "nvme", "hdd", "psu", "power", "supply", "chassis",
  "cooler", "smartphone", "iphone", "galaxy", "android", "tablet", "ipad",
  "smartwatch", "monitor", "display", "keyboard", "mouse", "headset", "headphones",
  "earbuds", "audio", "mic", "microphone", "speaker", "camera", "drone", "action",
  "gopro", "router", "wifi", "ethernet", "switch", "modem", "cable", "adapter",
  "charger", "powerbank", "usb", "hdmi", "bluetooth", "console", "playstation",
  "ps5", "ps4", "xbox", "nintendo", "switch", "steam", "deck", "controller",
  "gamepad", "peripheral", "webcam", "vr", "oculus", "quest", "raspberry",
  "arduino", "circuit", "server", "nas",
]);

const NON_TECH_PROHIBITED_TOKENS = new Set([
  "flower", "flowers", "bouquet", "rose", "roses", "tulip", "tulips", "sunflower",
  "plant", "seeds", "fertilizer", "perfume", "cologne", "fragrance", "lipstick",
  "makeup", "mascara", "cosmetics", "skincare", "lotion", "serum", "foundation",
  "dress", "shoes", "sneakers", "heels", "shirt", "tshirt", "jeans", "pants",
  "hoodie", "jacket", "coat", "skirt", "bag", "handbag", "purse", "backpack-fashion",
  "sunglasses", "jewelry", "necklace", "bracelet", "ring", "earrings", "food",
  "snack", "snacks", "candy", "chocolate", "coffee", "tea", "cake", "bread",
  "pizza", "burger", "meal", "grocery", "fruit", "vegetable", "furniture",
  "sofa", "couch", "bed", "mattress", "dining", "curtain", "pillow", "plushie",
  "doll", "toy-figure",
]);

export class LocalHeuristicVerificationProvider implements AiVerificationProvider {
  readonly name = "local-heuristic";

  async verify(
    input: ProductVerificationInput,
    contentHash: string
  ): Promise<VerificationResult> {
    const textCorpus = [
      input.title,
      input.category,
      input.specs || "",
      input.description || "",
    ]
      .join(" ")
      .toLowerCase();

    // Check for prompt injection attempts in user text
    const lowerText = textCorpus.toLowerCase();
    const hasPromptInjection =
      lowerText.includes("ignore previous instructions") ||
      lowerText.includes("ignore all previous") ||
      lowerText.includes("system prompt override") ||
      lowerText.includes("output tech_approved") ||
      lowerText.includes("always approve");

    // Tokenize
    const tokens = textCorpus.match(/[a-z0-9-]+/g) || [];

    let techScore = 0;
    let nonTechScore = 0;
    const detectedNonTech: string[] = [];

    for (const t of tokens) {
      if (TECH_POSITIVE_TOKENS.has(t)) {
        techScore += 1;
      }
      if (NON_TECH_PROHIBITED_TOKENS.has(t)) {
        nonTechScore += 2;
        if (!detectedNonTech.includes(t)) detectedNonTech.push(t);
      }
    }

    // Inspect image hints (URL paths / file names if provided)
    let imageMismatch = false;
    for (const imgUrl of input.imageUrls) {
      const lowerImg = imgUrl.toLowerCase();
      for (const nonTechToken of NON_TECH_PROHIBITED_TOKENS) {
        if (lowerImg.includes(nonTechToken)) {
          nonTechScore += 3;
          imageMismatch = true;
          if (!detectedNonTech.includes(nonTechToken)) detectedNonTech.push(nonTechToken);
        }
      }
    }

    // Disguised listing detection: Title has tech token, but description or image is non-tech
    const titleTokens = (input.title.toLowerCase().match(/[a-z0-9-]+/g) || []);
    const titleHasTech = titleTokens.some((t) => TECH_POSITIVE_TOKENS.has(t));
    if (titleHasTech && (imageMismatch || nonTechScore >= 2)) {
      return {
        decision: "NON_TECH_REJECTED",
        confidence: 0.95,
        reason: `Deceptive listing detected: title refers to technology, but the photos or product details represent non-tech items (${detectedNonTech.join(", ")}).`,
        flaggedReasons: ["IMAGE_MISMATCH", "DECEPTIVE_TITLE", "NON_TECH_ITEM"],
        modelUsed: this.name,
        contentHash,
        analyzedAt: new Date().toISOString(),
      };
    }

    // Strict non-tech rejection
    if (nonTechScore > techScore || nonTechScore >= 2) {
      return {
        decision: "NON_TECH_REJECTED",
        confidence: 0.96,
        reason: `This listing does not meet CircuitCart's technology-only policy. Detected non-technology product content: ${detectedNonTech.join(", ")}.`,
        suggestedCategory: null,
        flaggedReasons: ["NON_TECH_ITEM"],
        modelUsed: this.name,
        contentHash,
        analyzedAt: new Date().toISOString(),
      };
    }

    // Prompt injection check: if someone attempted prompt injection without clear legitimate tech, reject
    if (hasPromptInjection && techScore < 2) {
      return {
        decision: "NON_TECH_REJECTED",
        confidence: 0.99,
        reason: "Listing rejected due to non-compliant description and prohibited system command attempts.",
        flaggedReasons: ["PROMPT_INJECTION_DETECTED"],
        modelUsed: this.name,
        contentHash,
        analyzedAt: new Date().toISOString(),
      };
    }

    // Legitimate tech approval
    if (techScore >= 1 && nonTechScore === 0) {
      let suggested = "Accessories";
      if (textCorpus.includes("laptop") || textCorpus.includes("notebook") || textCorpus.includes("macbook")) {
        suggested = "Laptops";
      } else if (textCorpus.includes("gpu") || textCorpus.includes("cpu") || textCorpus.includes("ram") || textCorpus.includes("motherboard")) {
        suggested = "Components";
      } else if (textCorpus.includes("phone") || textCorpus.includes("iphone") || textCorpus.includes("galaxy") || textCorpus.includes("tablet")) {
        suggested = "Mobile";
      } else if (textCorpus.includes("gaming") || textCorpus.includes("playstation") || textCorpus.includes("xbox") || textCorpus.includes("ps5")) {
        suggested = "Gaming";
      } else if (textCorpus.includes("audio") || textCorpus.includes("headphone") || textCorpus.includes("earbuds") || textCorpus.includes("speaker")) {
        suggested = "Audio";
      }

      return {
        decision: "TECH_APPROVED",
        confidence: Math.min(0.99, 0.85 + techScore * 0.03),
        reason: "Listing verified as legitimate technology consumer hardware / electronics.",
        suggestedCategory: suggested,
        flaggedReasons: [],
        modelUsed: this.name,
        contentHash,
        analyzedAt: new Date().toISOString(),
      };
    }

    // Insufficient detail / uncertain
    return {
      decision: "UNCERTAIN",
      confidence: 0.5,
      reason: "Could not decisively confirm this listing as technology hardware. Please provide clearer specifications or photos.",
      suggestedCategory: null,
      flaggedReasons: ["INSUFFICIENT_EVIDENCE"],
      modelUsed: this.name,
      contentHash,
      analyzedAt: new Date().toISOString(),
    };
  }
}

// -----------------------------------------------------------------------------
// 3. Fallback Unavailable Provider (Production Guard)
// -----------------------------------------------------------------------------
export class UnavailableVerificationProvider implements AiVerificationProvider {
  readonly name = "unavailable-service";
  private reason: string;

  constructor(
    reason = "AI verification service is currently unavailable. Listing preserved as draft. Please retry shortly."
  ) {
    this.reason = reason;
  }

  async verify(
    _input: ProductVerificationInput,
    contentHash: string
  ): Promise<VerificationResult> {
    return {
      decision: "UNCERTAIN",
      confidence: 0,
      reason: this.reason,
      suggestedCategory: null,
      flaggedReasons: ["SERVICE_UNAVAILABLE"],
      modelUsed: this.name,
      contentHash,
      analyzedAt: new Date().toISOString(),
      rawResponse: { error: this.reason },
    };
  }
}

// -----------------------------------------------------------------------------
// 4. Provider Factory
// -----------------------------------------------------------------------------
export function getAiVerificationProvider(): AiVerificationProvider {
  const isProduction = process.env.NODE_ENV === "production";
  const explicitProvider = process.env.AI_VERIFICATION_PROVIDER?.toLowerCase().trim();

  // The heuristic provider is strictly prohibited in production and allowed ONLY
  // when explicitly opted in during local testing or offline development
  if (
    !isProduction &&
    (explicitProvider === "heuristic" || explicitProvider === "mock" || explicitProvider === "local")
  ) {
    return new LocalHeuristicVerificationProvider();
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (geminiApiKey) {
    return new GeminiVerificationProvider(geminiApiKey);
  }

  // In production or default environments without a configured key, NEVER auto-approve.
  // Preserve the product as unpublished ('draft' / 'uncertain') and allow retry.
  return new UnavailableVerificationProvider(
    "AI verification service is currently unavailable. Product preserved as draft. Please retry once service is connected."
  );
}
