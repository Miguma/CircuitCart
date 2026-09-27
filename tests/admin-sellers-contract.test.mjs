import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const requireModule = createRequire(import.meta.url);

function loadAdminModule(rows) {
  const source = fs.readFileSync(path.resolve("lib/supabase/admin.ts"), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const query = {
    select() { return this; },
    eq() { return this; },
    order: async () => ({ data: rows, error: null }),
  };
  const commonJsModule = { exports: {} };
  const requireMock = (id) => {
    if (id === "./client") {
      return { createClient: () => ({ from: () => query }) };
    }
    return requireModule(id);
  };

  new Function("require", "module", "exports", output)(
    requireMock,
    commonJsModule,
    commonJsModule.exports
  );
  return commonJsModule.exports;
}

const profile = {
  id: "seller-0001",
  full_name: "Alex Rivera",
  username: "alex-tech",
  avatar_url: null,
  location: null,
  bio: null,
  role: "seller",
  created_at: "2026-09-27T00:00:00.000Z",
  updated_at: "2026-09-27T00:00:00.000Z",
};
const shop = {
  id: "shop-0001",
  owner_id: profile.id,
  name: "Circuit Works",
  slug: "circuit-works",
  description: "Gaming components",
  logo_url: null,
  banner_url: null,
  location: null,
  status: "active",
  is_verified: true,
  created_at: "2026-09-27T00:00:00.000Z",
  updated_at: "2026-09-27T00:00:00.000Z",
};

const admin = loadAdminModule([
  { ...profile, shop },
  {
    ...profile,
    id: "seller-0002",
    username: "no-shop",
    full_name: null,
    shop: null,
  },
  {
    ...profile,
    id: "seller-0003",
    username: "legacy-shape",
    shop: [{ ...shop, id: "shop-0003", description: null }, shop],
  },
]);

const sellers = await admin.getAdminSellers();
assert.equal(sellers.length, 3);
assert.equal(sellers[0].shop.name, "Circuit Works");
assert.equal(sellers[1].shop, null);
assert.equal(sellers[2].shop.id, "shop-0003");
assert.equal("shops" in sellers[0], false);

assert.equal(admin.adminSellerMatchesSearch(sellers[0], "alex rivera"), true);
assert.equal(admin.adminSellerMatchesSearch(sellers[0], "ALEX-TECH"), true);
assert.equal(admin.adminSellerMatchesSearch(sellers[0], "seller-0001"), true);
assert.equal(admin.adminSellerMatchesSearch(sellers[0], "circuit works"), true);
assert.equal(admin.adminSellerMatchesSearch(sellers[0], "gaming components"), true);
assert.equal(admin.adminSellerMatchesSearch(sellers[1], "no-shop"), true);
assert.equal(admin.adminSellerMatchesSearch(sellers[1], "missing"), false);
assert.equal(admin.adminSellerMatchesSearch(sellers[2], "legacy-shape"), true);
assert.equal(admin.adminSellerMatchesSearch(sellers[2], "gaming components"), false);
assert.equal(admin.adminSellerMatchesSearch(sellers[2], ""), true);

console.log("PASS: admin seller relationship normalization and null-safe search");
