import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

// Load .env.local if present
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [k, ...v] = trimmed.split("=");
      const key = k.trim();
      const val = v.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key] && val) {
        process.env[key] = val;
      }
    }
  }
}

function moduleFrom(path, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (id) => {
      if (id in dependencies) return dependencies[id];
      throw new Error(`Unexpected dependency: ${id}`);
    },
    loaded,
    loaded.exports
  );
  return loaded.exports;
}

const promptModule = moduleFrom("lib/ai/prompt.ts");
const providerModule = moduleFrom("lib/ai/provider.ts", { "./prompt": promptModule, "./types": {} });
const { GeminiVerificationProvider } = providerModule;

async function runLiveClassificationTest() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    console.log("=================================================================");
    console.log("[BLOCKED] Live Gemini classification cannot be run without an API key.");
    console.log("To verify real Gemini responses with live Google API calls:");
    console.log("  1. Obtain a free API key at https://aistudio.google.com");
    console.log("  2. Set GEMINI_API_KEY in .env.local or shell: $env:GEMINI_API_KEY='...'");
    console.log("  3. Run: node scripts/test-live-gemini.mjs");
    console.log("=================================================================");
    process.exit(0);
  }

  // Safe logging: never print the key
  console.log("=================================================================");
  console.log("CIRCUITCART LIVE GEMINI MULTIMODAL CLASSIFICATION TEST");
  console.log("Model: gemini-3.8-flash");
  console.log(`API Key: [PRESENT - length: ${apiKey.length} chars, masked]`);
  console.log("=================================================================\n");

  const modelToUse = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const provider = new GeminiVerificationProvider(apiKey, modelToUse);

  // Load real laptop image from repository assets for authentic multimodal testing
  const macbookBase64 = readFileSync("public/images/macbook-air.png").toString("base64");
  const macbookImage = `data:image/png;base64,${macbookBase64}`;
  const sampleImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const testCases = [
    {
      name: "1. Genuine Tech Listing (Apple MacBook Air M2)",
      expected: "TECH_APPROVED",
      payload: {
        title: "Apple MacBook Air 13-inch M2 Chip",
        category: "Laptops",
        condition: "Like New",
        price: 52000,
        specs: "Apple M2 8-core CPU, 8-core GPU, 8GB Unified Memory, 256GB SSD, Space Gray",
        description: "Genuine Apple MacBook Air M2 laptop in excellent working condition with original MagSafe 3 charger and box.",
        imageUrls: [macbookImage],
      },
    },
    {
      name: "2. Obvious Non-Tech Listing (Fresh Flower Bouquet)",
      expected: "NON_TECH_REJECTED",
      payload: {
        title: "Fresh Hand-Tied Red Rose Bouquet",
        category: "Other",
        condition: "Brand New",
        price: 1500,
        specs: "12 fresh long-stem Ecuador roses with eucalyptus leaves in craft wrapping paper",
        description: "Fresh flower bouquet delivered in Cebu. Perfect gift for anniversaries.",
        imageUrls: [sampleImage],
      },
    },
    {
      name: "3. Disguised Non-Tech Listing (Makeup Disguised as Hardware)",
      expected: "NON_TECH_REJECTED",
      payload: {
        title: "NVIDIA GeForce RTX 4090 Gaming Peripheral Kit",
        category: "PC Components",
        condition: "Brand New",
        price: 2500,
        specs: "Matte lipstick, waterproof mascara, 12-shade eyeshadow beauty palette",
        description: "Premium cosmetics beauty bundle disguised with computer hardware title to bypass filters.",
        imageUrls: [sampleImage],
      },
    },
    {
      name: "4. Ambiguous / Insufficient Details Listing",
      expected: "UNCERTAIN",
      payload: {
        title: "Mystery electronic box",
        category: "Electronics",
        condition: "Used",
        price: 400,
        specs: "Black plastic box with a cut wire, no model number or labels",
        description: "Found in storage shed, not sure what it does or if it powers on.",
        imageUrls: [],
      },
    },
  ];

  let passCount = 0;
  for (const tc of testCases) {
    process.stdout.write(`Testing: ${tc.name}... `);
    try {
      const res = await provider.verify(tc.payload, `hash-${Date.now()}`);
      const matches = res.decision === tc.expected;
      if (matches) {
        passCount++;
        console.log(`[PASS] Decision: ${res.decision} (Confidence: ${Math.round((res.confidence || 0) * 100)}%)`);
        console.log(`   Reason: "${res.reason}"`);
      } else {
        console.log(`[FAIL] Expected: ${tc.expected}, Got: ${res.decision}`);
        console.log(`   Reason: "${res.reason}"`);
      }
    } catch (err) {
      console.log(`[ERROR] ${err.message}`);
    }
    // Pause briefly between test cases to respect free tier rate limit
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("\n=================================================================");
  console.log(`RESULTS: ${passCount}/${testCases.length} tests passed against live Gemini API.`);
  console.log("=================================================================");
}

runLiveClassificationTest().catch((err) => {
  console.error("Live test failed with fatal error:", err);
  process.exit(1);
});
