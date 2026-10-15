#!/usr/bin/env node
/**
 * Re-verifies every legacy grace-approved listing (verified_by_model = 'legacy_migration_grace')
 * by calling POST /api/products/reverify-all in batches until none remain.
 *
 * Usage (PowerShell):
 *   $env:CIRCUITCART_BASE_URL = "https://your-domain"
 *   $env:ADMIN_REVERIFY_SECRET = "<same value as the deployed server>"
 *   node scripts/reverify-legacy-grace.mjs --dry-run     # read-only preview of one batch
 *   node scripts/reverify-legacy-grace.mjs               # apply decisions
 *
 * Safety:
 *   - The secret is read from the environment and never printed.
 *   - Stops when a batch makes no progress (e.g. Gemini unavailable): transient AI
 *     failures are skipped server-side, so grace listings stay online until retried.
 *   - Exits non-zero if any grace listings remain or any RPC write failed.
 */

const baseUrl = (process.env.CIRCUITCART_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.ADMIN_REVERIFY_SECRET;
const dryRun = process.argv.includes("--dry-run");
const batchSize = Number(process.env.REVERIFY_BATCH_SIZE || 25);
const maxBatches = Number(process.env.REVERIFY_MAX_BATCHES || 200);

if (!secret) {
  console.error("ADMIN_REVERIFY_SECRET is not set in this shell. Aborting.");
  process.exit(2);
}

async function runBatch() {
  const res = await fetch(`${baseUrl}/api/products/reverify-all`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-secret": secret },
    body: JSON.stringify({ dryRun, limit: batchSize, verifiedByModel: "legacy_migration_grace" }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${json.error || "unknown error"}`);
  }
  return json;
}

let totalApplied = 0;
let totalFailed = 0;
let previousRemaining = Infinity;
let lastRemaining = null;

for (let i = 1; i <= maxBatches; i++) {
  const r = await runBatch();
  totalApplied += r.counts.applied;
  totalFailed += r.counts.failed;
  lastRemaining = r.remainingLegacyGrace;
  console.log(
    `batch ${i}: processed=${r.totalProcessed} applied=${r.counts.applied} ` +
      `approved=${r.counts.approved} rejected=${r.counts.rejected} uncertain=${r.counts.uncertain} ` +
      `skippedTransient=${r.counts.skippedTransient} failed=${r.counts.failed} ` +
      `remainingLegacyGrace=${r.remainingLegacyGrace} provider=${r.provider}`
  );
  for (const item of r.results) {
    if (item.decision !== "TECH_APPROVED" || !item.applied) {
      console.log(`  - ${item.decision.padEnd(17)} applied=${item.applied} ${item.title}${item.skippedReason ? ` (${item.skippedReason})` : ""}`);
    }
  }

  if (dryRun) {
    console.log("Dry run: no database writes were made. Re-run without --dry-run to apply.");
    process.exit(0);
  }
  if (r.remainingLegacyGrace === 0 || r.totalProcessed === 0) break;
  if (r.counts.applied === 0 || r.remainingLegacyGrace >= previousRemaining) {
    console.error("No progress in this batch (AI unavailable or RPC failures). Stopping; re-run later.");
    break;
  }
  previousRemaining = r.remainingLegacyGrace;
}

const remaining = lastRemaining ?? "unknown";
console.log(`Done. applied=${totalApplied} failed=${totalFailed} remainingLegacyGrace=${remaining}`);
process.exit(remaining === 0 && totalFailed === 0 ? 0 : 1);
