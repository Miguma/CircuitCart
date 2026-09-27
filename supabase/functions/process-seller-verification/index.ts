// Retired endpoint. Keep this tombstone so redeploying local code cannot restore
// automated identity decisions. No credentials, document reads, scoring or writes.
// Final decisions belong to the existing authorized admin review RPC.
Deno.serve((request: Request) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({
    code: "MANUAL_REVIEW_REQUIRED",
    message: "Automated processing is retired. Verification requests require administrator review.",
  }), { status: 410, headers });
});
