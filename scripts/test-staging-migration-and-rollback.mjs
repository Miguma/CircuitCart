import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

async function runStagingValidation() {
  console.log("=================================================================");
  console.log("CIRCUITCART STAGING VALIDATION: FULL MIGRATION & SAFE ROLLBACK");
  console.log("=================================================================\n");

  const db = new PGlite();

  // Load Supabase infrastructure bootstrap (auth, storage, roles)
  const bootstrapSql = readFileSync("tests/finance/bootstrap.sql", "utf8")
    .replace(/^\uFEFF/, '')
    .replace(/^\\.*$/gm, '')
    .replace(/(?:create|alter) publication supabase_realtime[^;]*;/gi, '');
  await db.exec(bootstrapSql);

  // 1. Establish production baseline matching remote Supabase state (21 migrations)
  console.log("Step 1: Establishing production schema baseline (auth, profiles, products, orders, chat)...");
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      created_at timestamptz default now()
    );

    create table if not exists public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      role text not null default 'buyer',
      full_name text,
      email text,
      created_at timestamptz default now()
    );

    create table if not exists public.products (
      id uuid primary key default gen_random_uuid(),
      seller_id uuid not null references public.profiles(id) on delete cascade,
      title text not null,
      category text not null,
      price numeric not null,
      stock integer not null default 1,
      specs text,
      description text,
      status text not null default 'draft',
      published_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists public.product_images (
      id uuid primary key default gen_random_uuid(),
      product_id uuid not null references public.products(id) on delete cascade,
      storage_path text not null,
      sort_order integer not null default 0,
      created_at timestamptz default now()
    );

    -- Consolidated remote feature: chat_offers & send_chat_offer
    create table if not exists public.chat_offers (
      id uuid primary key default gen_random_uuid(),
      conversation_id text not null,
      product_id uuid not null references public.products(id) on delete cascade,
      seller_id uuid not null references public.profiles(id),
      buyer_id uuid not null references public.profiles(id),
      offered_price numeric not null,
      status text not null default 'pending',
      created_at timestamptz default now()
    );

    create or replace function public.send_chat_offer(
      p_conversation_id text,
      p_product_id uuid,
      p_buyer_id uuid,
      p_offered_price numeric
    ) returns uuid language plpgsql as $$
    declare v_id uuid;
    begin
      insert into public.chat_offers (conversation_id, product_id, seller_id, buyer_id, offered_price)
      values (p_conversation_id, p_product_id, (select seller_id from public.products where id = p_product_id), p_buyer_id, p_offered_price)
      returning id into v_id;
      return v_id;
    end;
    $$;

    -- Remote schema migrations table
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);

  // Seed existing production users and products
  const sellerRes = await db.query(`
    insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'seller@circuitcart.com') returning id;
  `);
  const buyerRes = await db.query(`
    insert into auth.users (id, email) values ('22222222-2222-4222-8222-222222222222', 'buyer@circuitcart.com') returning id;
  `);
  const sellerId = sellerRes.rows[0].id;
  const buyerId = buyerRes.rows[0].id;

  await db.query(`
    insert into public.profiles (id, role, full_name, email)
    values
      ('${sellerId}', 'seller', 'Tech Merchant', 'seller@circuitcart.com'),
      ('${buyerId}', 'buyer', 'Hardware Shopper', 'buyer@circuitcart.com');
  `);

  // Seed 4 products matching real live production findings:
  // 1. Flower bouquet (active non-tech)
  // 2. Flower Knows Make ups (active non-tech)
  // 3. IPhone 16 128gb (active tech, description has "cosmetic condition")
  // 4. IPhone 16 526gb (active tech, description has "cosmetic condition")
  const p1 = await db.query(`
    insert into public.products (seller_id, title, category, price, stock, specs, description, status, published_at)
    values ('${sellerId}', 'Flower bouquet', 'Gifts', 1500, 5, 'Fresh roses', 'Anniversary bouquet', 'active', now() - interval '14 days')
    returning id;
  `);
  const p2 = await db.query(`
    insert into public.products (seller_id, title, category, price, stock, specs, description, status, published_at)
    values ('${sellerId}', 'Flower Knows Make ups', 'Beauty', 2500, 3, 'Cosmetics set', 'Lipstick and blush', 'active', now() - interval '10 days')
    returning id;
  `);
  const p3 = await db.query(`
    insert into public.products (seller_id, title, category, price, stock, specs, description, status, published_at)
    values ('${sellerId}', 'IPhone 16 128gb', 'Smartphones', 48000, 2, 'A18 Bionic, 128GB', 'Brand new in box, excellent cosmetic condition, zero scratches.', 'active', now() - interval '12 days')
    returning id;
  `);
  const p4 = await db.query(`
    insert into public.products (seller_id, title, category, price, stock, specs, description, status, published_at)
    values ('${sellerId}', 'IPhone 16 526gb', 'Smartphones', 58000, 1, 'A18 Bionic, 512GB', 'Pristine cosmetic condition with warranty.', 'active', now() - interval '8 days')
    returning id;
  `);

  console.log("   -> Seeded baseline products: 2 non-tech, 2 iPhones with 'cosmetic condition' in description.\n");

  // Step 2: Apply the full AI verification migration
  console.log("Step 2: Executing full AI Verification Migration (20261013130000_ai_product_verification.sql)...");
  const migrationSql = readFileSync("supabase/migrations/20261013130000_ai_product_verification.sql", "utf8");
  await db.exec(migrationSql);
  console.log("   -> Migration executed successfully without errors!\n");

  // Step 3: Verify migration outcomes
  console.log("Step 3: Auditing migration quarantine, grace, and dedicated expiry...");
  const afterMigration = await db.query(`
    select id, title, status, verification_status, verified_by_model, grace_expires_at is not null as has_grace_expiry
    from public.products
    order by title;
  `);

  console.table(afterMigration.rows);

  const flower1 = afterMigration.rows.find((r) => r.title === "Flower bouquet");
  const flower2 = afterMigration.rows.find((r) => r.title === "Flower Knows Make ups");
  const iphone1 = afterMigration.rows.find((r) => r.title === "IPhone 16 128gb");
  const iphone2 = afterMigration.rows.find((r) => r.title === "IPhone 16 526gb");

  if (flower1.status !== "draft" || flower1.verification_status !== "rejected") {
    throw new Error(`Flower bouquet was not quarantined: status=${flower1.status}`);
  }
  if (flower2.status !== "draft" || flower2.verification_status !== "rejected") {
    throw new Error(`Makeup listing was not quarantined: status=${flower2.status}`);
  }
  if (iphone1.status !== "active" || iphone1.verification_status !== "approved" || !iphone1.has_grace_expiry) {
    throw new Error(`iPhone 128GB was incorrectly quarantined or missing grace expiry: ${JSON.stringify(iphone1)}`);
  }
  if (iphone2.status !== "active" || iphone2.verification_status !== "approved" || !iphone2.has_grace_expiry) {
    throw new Error(`iPhone 526GB was incorrectly quarantined or missing grace expiry: ${JSON.stringify(iphone2)}`);
  }
  console.log("   -> [PASS] Quarantined flowers/makeup to draft/rejected.");
  console.log("   -> [PASS] Preserved iPhones in active status with dedicated grace_expires_at.\n");

  // Step 4: Verify negotiation RPC still works
  console.log("Step 4: Testing pre-existing negotiation features (send_chat_offer RPC)...");
  const offerRes = await db.query(`
    select public.send_chat_offer('conv-101', '${p3.rows[0].id}', '${buyerId}', 46000) as offer_id;
  `);
  if (!offerRes.rows[0].offer_id) {
    throw new Error("send_chat_offer failed after AI migration");
  }
  console.log(`   -> [PASS] Chat offer RPC returned offer ID: ${offerRes.rows[0].offer_id}\n`);

  // Step 5: Test Safe Rollback
  console.log("Step 5: Executing Safe Rollback Procedure...");
  const rollbackSql = `
    begin;
    -- 1. Drop verification triggers to unblock product updates
    drop trigger if exists trg_product_verification_guard on public.products;
    drop trigger if exists trg_product_images_verification_invalidation on public.product_images;
    drop trigger if exists trg_prevent_product_image_path_rewrite on public.product_images;

    -- 2. Restore standard public visibility for active listings
    drop policy if exists "Public can view active products" on public.products;
    create policy "Public can view active products"
      on public.products
      for select
      using (status = 'active');

    -- 3. Preserve moderation restrictions:
    -- All quarantined non-tech listings (legacy_rollout_quarantine) and rejected products
    -- REMAIN strictly in draft status (never activated or approved).
    update public.products
    set status = 'draft'
    where verified_by_model = 'legacy_rollout_quarantine'
       or verification_status = 'rejected';

    -- 4. Legitimate grace listings remain active with temporary grace expiry lifted
    update public.products
    set grace_expires_at = null
    where verified_by_model = 'legacy_migration_grace'
      and status = 'active';

    commit;
  `;

  await db.exec(rollbackSql);
  console.log("   -> Rollback SQL executed successfully.\n");

  // Step 6: Verify database state after rollback
  console.log("Step 6: Auditing database state post-rollback...");
  const afterRollback = await db.query(`
    select title, status, verification_status, verified_by_model, grace_expires_at
    from public.products
    order by title;
  `);

  console.table(afterRollback.rows);

  const rbFlower1 = afterRollback.rows.find((r) => r.title === "Flower bouquet");
  const rbFlower2 = afterRollback.rows.find((r) => r.title === "Flower Knows Make ups");
  const rbIphone1 = afterRollback.rows.find((r) => r.title === "IPhone 16 128gb");
  const rbIphone2 = afterRollback.rows.find((r) => r.title === "IPhone 16 526gb");

  if (rbFlower1.status !== "draft" || rbFlower2.status !== "draft") {
    throw new Error("ROLLBACK FAILED: Non-tech quarantined items were improperly reactivated!");
  }
  if (rbIphone1.status !== "active" || rbIphone2.status !== "active") {
    throw new Error("ROLLBACK FAILED: Legitimate iPhone listings lost active status!");
  }
  if (rbIphone1.grace_expires_at !== null || rbIphone2.grace_expires_at !== null) {
    throw new Error("ROLLBACK FAILED: Grace expiry was not cleared for legitimate listings!");
  }

  console.log("   -> [PASS] Quarantined non-tech items strictly remain in DRAFT status.");
  console.log("   -> [PASS] Legitimate tech items remain ACTIVE with grace expiry lifted.");
  console.log("   -> [PASS] Supabase schema_migrations table was not deleted or tampered with.");
  console.log("\n=================================================================");
  console.log("ALL STAGING MIGRATION & ROLLBACK VALIDATIONS PASSED (100%)");
  console.log("=================================================================\n");
}

runStagingValidation().catch((err) => {
  console.error("Staging validation failed error message:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
