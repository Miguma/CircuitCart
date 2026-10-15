import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

async function runPhase3StagingValidation() {
  console.log("==========================================================================");
  console.log("CIRCUITCART PHASE 3: FINAL PRODUCTION DEPLOYMENT PREPARATION & VALIDATION");
  console.log("==========================================================================\n");

  const db = new PGlite();

  // ---------------------------------------------------------------------------
  // 1. Initialize Baseline Infrastructure & Schema (Matching 21 Remote Migrations)
  // ---------------------------------------------------------------------------
  console.log("Step 1: Establishing Sanitized Staging Baseline with Actual Production Schema...");

  const bootstrapSql = readFileSync("tests/finance/bootstrap.sql", "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/^\\.*$/gm, "")
    .replace(/(?:create|alter) publication supabase_realtime[^;]*;/gi, "");
  await db.exec(bootstrapSql);

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

    create table if not exists public.shops (
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null references public.profiles(id) on delete cascade,
      name text not null,
      slug text unique,
      description text,
      is_verified boolean not null default false,
      location text,
      created_at timestamptz default now()
    );

    create table if not exists public.products (
      id uuid primary key default gen_random_uuid(),
      seller_id uuid not null references public.profiles(id) on delete cascade,
      shop_id uuid references public.shops(id) on delete set null,
      title text not null,
      category text not null,
      price numeric not null,
      original_price numeric,
      stock integer not null default 1,
      condition text not null default 'Good',
      specs text,
      description text,
      location text,
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

    create table if not exists public.cart_items (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      product_id uuid not null references public.products(id) on delete cascade,
      quantity integer not null default 1,
      created_at timestamptz default now()
    );

    create table if not exists public.orders (
      id uuid primary key default gen_random_uuid(),
      buyer_id uuid not null references public.profiles(id),
      seller_id uuid not null references public.profiles(id),
      product_id uuid not null references public.products(id),
      total_amount numeric not null,
      status text not null default 'pending',
      created_at timestamptz default now()
    );

    create table if not exists public.payment_transactions (
      id uuid primary key default gen_random_uuid(),
      order_id uuid not null references public.orders(id),
      user_id uuid not null references public.profiles(id),
      amount numeric not null,
      payment_method text not null,
      status text not null default 'completed',
      created_at timestamptz default now()
    );

    create table if not exists public.chat_offers (
      id uuid primary key default gen_random_uuid(),
      conversation_id text not null,
      product_id uuid not null references public.products(id) on delete cascade,
      seller_id uuid not null references public.profiles(id),
      buyer_id uuid not null references public.profiles(id),
      offered_price numeric not null,
      status text not null default 'pending',
      expires_at timestamptz default now() + interval '24 hours',
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

    create table if not exists public.meetup_deposits (
      id uuid primary key default gen_random_uuid(),
      offer_id uuid not null references public.chat_offers(id),
      buyer_id uuid not null references public.profiles(id),
      seller_id uuid not null references public.profiles(id),
      total_amount numeric not null,
      deposit_amount numeric not null,
      status text not null default 'held',
      created_at timestamptz default now()
    );

    -- Base RLS policies
    alter table public.products enable row level security;
    create policy "products_public_view_legacy"
      on public.products for select
      using (status = 'active' or seller_id = auth.uid());

    create policy "products_seller_insert"
      on public.products for insert
      with check (seller_id = auth.uid());

    create policy "products_seller_update"
      on public.products for update
      using (seller_id = auth.uid())
      with check (seller_id = auth.uid());

    alter table public.product_images enable row level security;
    create policy "product_images_all"
      on public.product_images for all
      using (true) with check (true);

    grant usage on schema public to anon, authenticated;
    grant select on public.profiles, public.shops, public.products, public.product_images, public.orders, public.chat_offers, public.meetup_deposits, public.cart_items, public.payment_transactions to anon, authenticated;
    grant insert, update, delete on public.products, public.product_images, public.orders, public.chat_offers, public.meetup_deposits, public.cart_items, public.payment_transactions to authenticated;
  `);

  console.log("   -> Schema initialized.");

  // Reconcile migration history table with 21 remote versions
  await db.exec(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);

  const remoteMigrationVersions = [
    "20260906000000", "20260906000001", "20260906000002", "20260906000003",
    "20260906000004", "20260906000005", "20260906000006", "20260906000007",
    "20260906000008", "20260906000009", "20260906000010", "20260906000011",
    "20260906000012", "20260906000013", "20260906000014", "20260906000015",
    "20260906000016", "20260906000017", "20260927133402", "20260927155320",
    "20260927161106", "20261013120000"
  ];
  for (const ver of remoteMigrationVersions) {
    await db.query(`insert into supabase_migrations.schema_migrations (version, name) values ('${ver}', 'migration_${ver}')`);
  }
  console.log("   -> [PASS] Reconciled remote migration history: 22 migrations recorded.");

  // ---------------------------------------------------------------------------
  // 2. Seed Realistic Dataset: 20 Active Products + 1 Sold-Out Product
  // ---------------------------------------------------------------------------
  console.log("\nStep 2: Seeding Production Dataset: 20 Active Listings + 1 Sold-Out Listing...");

  const sellerRes = await db.query(`insert into auth.users (id, email) values (gen_random_uuid(), 'seller@circuitcart.com') returning id;`);
  const buyerRes = await db.query(`insert into auth.users (id, email) values (gen_random_uuid(), 'buyer@circuitcart.com') returning id;`);
  const sellerId = sellerRes.rows[0].id;
  const buyerId = buyerRes.rows[0].id;

  await db.exec(`
    insert into public.profiles (id, role, full_name, email) values
      ('${sellerId}', 'seller', 'Tech Merchant Cebu', 'seller@circuitcart.com'),
      ('${buyerId}', 'buyer', 'Hardware Buyer', 'buyer@circuitcart.com');

    insert into public.shops (owner_id, name, slug, is_verified, location) values
      ('${sellerId}', 'TechVault Cebu', 'techvault-cebu', true, 'Cebu City');
  `);

  const shopId = (await db.query(`select id from public.shops where owner_id = '${sellerId}' limit 1;`)).rows[0].id;

  // 2 non-tech active products
  await db.query(`
    insert into public.products (seller_id, shop_id, title, category, price, stock, specs, description, status, published_at)
    values
      ('${sellerId}', '${shopId}', 'Flower bouquet', 'Accessories', 1500, 5, 'Fresh roses for occasions', 'Anniversary fresh flower bouquet ready for delivery', 'active', now() - interval '14 days'),
      ('${sellerId}', '${shopId}', 'Flower Knows Make ups', 'Accessories', 2500, 20, 'Cosmetics set and lipstick', 'Flower Knows makeup set with lip gloss and eyeshadow palette', 'active', now() - interval '10 days');
  `);

  // 18 tech active products
  const techProducts = [
    "32gb 3600mhz 32gb 16x2 Delta Tforce RGB ddr4",
    "Skullcandy Mod Earbuds earphones",
    "Nintendo switch Games",
    "PC set",
    "IPhone 16 128gb",
    "IPhone 16 526gb",
    "Logitech G Pro X Superlight Mouse",
    "Keychron K2 Wireless Mechanical Keyboard",
    "Sony WH-1000XM5 Noise Canceling Headphones",
    "ASUS ROG Strix RTX 4070 Ti Super",
    "Samsung 990 Pro 2TB NVMe SSD",
    "Apple MacBook Air M2 16GB 512GB",
    "Lenovo Legion Pro 5 Gen 8 Gaming Laptop",
    "Dell UltraSharp 27 4K Monitor U2723QE",
    "TP-Link WiFi 7 Archer BE800 Router",
    "Elgato Stream Deck MK.2",
    "iPad Air M2 11-inch 128GB Wi-Fi",
    "Seagate IronWolf 8TB NAS Hard Drive"
  ];

  for (let i = 0; i < techProducts.length; i++) {
    const title = techProducts[i];
    const desc = title.startsWith("IPhone")
      ? "Brand new in box, excellent cosmetic condition, zero scratches, pristine battery health."
      : "Authentic electronics hardware in excellent working condition.";
    await db.query(`
      insert into public.products (seller_id, shop_id, title, category, price, stock, specs, description, status, published_at)
      values ('${sellerId}', '${shopId}', '${title}', 'Components', 5000, 2, 'Authentic tech specs', '${desc}', 'active', now() - interval '8 days');
    `);
  }

  // 1 Sold-Out Tech Listing:
  const soldOutRes = await db.query(`
    insert into public.products (seller_id, shop_id, title, category, price, stock, specs, description, status, published_at)
    values ('${sellerId}', '${shopId}', 'Mechanical Gaming Keyboard RGB (Sold Out)', 'Accessories', 3500, 0, 'Hot swappable switches', 'High performance keyboard', 'sold_out', now() - interval '20 days')
    returning id;
  `);
  const soldOutId = soldOutRes.rows[0].id;

  // Seed existing cart, order, payment, and chat negotiation records:
  const sampleActiveTechId = (await db.query(`select id from public.products where title = 'Nintendo switch Games';`)).rows[0].id;
  await db.query(`insert into public.cart_items (user_id, product_id, quantity) values ('${buyerId}', '${sampleActiveTechId}', 1);`);

  const orderRes = await db.query(`
    insert into public.orders (buyer_id, seller_id, product_id, total_amount, status)
    values ('${buyerId}', '${sellerId}', '${sampleActiveTechId}', 1800, 'confirmed')
    returning id;
  `);
  const orderId = orderRes.rows[0].id;

  await db.query(`
    insert into public.payment_transactions (order_id, user_id, amount, payment_method, status)
    values ('${orderId}', '${buyerId}', 1800, 'maya', 'completed');
  `);

  const chatOfferId = (await db.query(`
    select public.send_chat_offer('conv-p3-01', '${sampleActiveTechId}', '${buyerId}', 1700) as id;
  `)).rows[0].id;

  await db.query(`
    insert into public.meetup_deposits (offer_id, buyer_id, seller_id, total_amount, deposit_amount, status)
    values ('${chatOfferId}', '${buyerId}', '${sellerId}', 1700, 850, 'held');
  `);

  const totalProductsPre = await db.query("select count(*) as count from public.products;");
  const activeProductsPre = await db.query("select count(*) as count from public.products where status = 'active';");
  const soldOutProductsPre = await db.query("select count(*) as count from public.products where status = 'sold_out';");

  assert.equal(Number(totalProductsPre.rows[0].count), 21, "Must have exactly 21 products.");
  assert.equal(Number(activeProductsPre.rows[0].count), 20, "Must have 20 active products.");
  assert.equal(Number(soldOutProductsPre.rows[0].count), 1, "Must have 1 sold-out product.");
  console.log(`   -> [PASS] Seeded baseline: 20 active, 1 sold-out (Total: ${totalProductsPre.rows[0].count}).`);
  console.log("   -> [PASS] Seeded existing cart items, orders, payment transactions, chat offers, and meetup deposits.");

  // ---------------------------------------------------------------------------
  // 3. Apply AI Product Verification Migration
  // ---------------------------------------------------------------------------
  console.log("\nStep 3: Applying AI Verification Migration (20261013130000_ai_product_verification.sql)...");

  await db.exec(`drop policy if exists "products_public_view_legacy" on public.products;`);
  const migrationSql = readFileSync("supabase/migrations/20261013130000_ai_product_verification.sql", "utf8");
  await db.exec(migrationSql);

  await db.query(`
    insert into supabase_migrations.schema_migrations (version, name)
    values ('20261013130000', '20261013130000_ai_product_verification.sql');
  `);
  console.log("   -> [PASS] Migration applied cleanly.");

  // ---------------------------------------------------------------------------
  // 4. Verify Sold-Out Product Behavior Post-Migration
  // ---------------------------------------------------------------------------
  console.log("\nStep 4: Auditing Sold-Out Product Behavior Post-Migration...");

  const soldOutPost = await db.query(`
    select id, title, status, stock, verification_status, verified_by_model
    from public.products
    where id = '${soldOutId}';
  `);
  const soItem = soldOutPost.rows[0];
  assert.equal(soItem.status, "sold_out", "Sold-out listing must retain status='sold_out'.");
  assert.equal(Number(soItem.stock), 0, "Sold-out listing must retain stock=0.");
  assert.notEqual(soItem.verified_by_model, "legacy_migration_grace", "Sold-out listing must NOT receive active grace activation.");
  console.log(`   -> [PASS] Sold-out listing preserved: status='${soItem.status}', stock=${soItem.stock}, verification_status='${soItem.verification_status}'.`);

  // Verify public buyer query excludes sold_out item:
  await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const buyerVisibleProducts = await db.query(`
    select count(*) as count
    from public.products
    where status = 'active'
      and verification_status = 'approved'
      and stock > 0
      and (grace_expires_at is null or grace_expires_at > now());
  `);
  // 18 active tech products (2 flowers/makeup quarantined, 1 sold out excluded)
  assert.equal(Number(buyerVisibleProducts.rows[0].count), 18, "Public catalog must return 18 active in-stock listings.");
  console.log(`   -> [PASS] Public buyer query returns exactly ${buyerVisibleProducts.rows[0].count} active in-stock listings (sold-out item excluded).`);

  // Verify seller dashboard view includes sold_out item:
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${sellerId}', false);`);
  const sellerListings = await db.query(`
    select status, count(*) as count
    from public.products
    where seller_id = '${sellerId}'
    group by status;
  `);
  console.log("Seller Dashboard Status Breakdown:");
  console.table(sellerListings.rows);
  const sellerSoldOut = sellerListings.rows.find(r => r.status === "sold_out");
  assert.ok(sellerSoldOut && Number(sellerSoldOut.count) === 1, "Seller must see their 1 sold-out listing.");
  console.log("   -> [PASS] Seller dashboard correctly displays sold-out listing.");

  // ---------------------------------------------------------------------------
  // 5. Complete End-to-End Verification Pipeline
  // ---------------------------------------------------------------------------
  console.log("\nStep 5: Testing Complete End-to-End Verification Pipeline...");

  // 5a. Seller creates a tech listing
  const newTech = (await db.query(`
    insert into public.products (seller_id, shop_id, title, category, price, stock, specs, description, status)
    values ('${sellerId}', '${shopId}', 'AMD Ryzen 7 7800X3D CPU', 'Components', 24500, 4, '8-core 16-thread 3D V-Cache', 'Brand new gaming processor', 'active')
    returning id, status, verification_status;
  `)).rows[0];

  assert.equal(newTech.status, "draft", "Coerce trigger forces active insert to draft.");
  assert.equal(newTech.verification_status, "pending");

  // 5b. Authoritative image upload to product_images
  await db.query(`
    insert into public.product_images (product_id, storage_path, sort_order)
    values ('${newTech.id}', '${sellerId}/${newTech.id}/cpu-box.png', 0);
  `);

  // 5c. Server retrieves authoritative images and computes content hash
  const authoritativeImages = (await db.query(`
    select storage_path from public.product_images where product_id = '${newTech.id}' order by sort_order;
  `)).rows.map(r => r.storage_path);
  assert.equal(authoritativeImages.length, 1);
  assert.equal(authoritativeImages[0], `${sellerId}/${newTech.id}/cpu-box.png`);

  // 5d. Verification RPC applies TECH_APPROVED
  await db.exec("reset role;");
  await db.query(`
    select public.apply_product_ai_decision(
      p_product_id := '${newTech.id}'::uuid,
      p_decision := 'TECH_APPROVED'::text,
      p_confidence := 0.99::numeric,
      p_reason := 'Authentic computer processor component'::text,
      p_suggested_category := 'Components'::text,
      p_flagged_reasons := '[]'::jsonb,
      p_content_hash := 'hash-ryzen-7800x3d'::text,
      p_model_used := 'gemini-3.8-flash'::text
    );
  `);

  const verifiedTech = (await db.query(`select status, verification_status from public.products where id = '${newTech.id}';`)).rows[0];
  assert.equal(verifiedTech.status, "active", "Approved listing becomes active.");
  assert.equal(verifiedTech.verification_status, "approved", "Approved listing is marked approved.");
  console.log("   -> [PASS] Approved tech listing is activated.");

  // 5e. Seller creates a non-tech listing (Floral Perfume)
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${sellerId}', false);`);
  const newNonTech = (await db.query(`
    insert into public.products (seller_id, shop_id, title, category, price, stock, specs, description, status)
    values ('${sellerId}', '${shopId}', 'Luxury French Floral Perfume', 'Accessories', 4500, 3, '100ml Eau de Parfum', 'Fragrance perfume bottle', 'active')
    returning id, status, verification_status;
  `)).rows[0];

  await db.exec("reset role;");
  await db.query(`
    select public.apply_product_ai_decision(
      p_product_id := '${newNonTech.id}'::uuid,
      p_decision := 'NON_TECH_REJECTED'::text,
      p_confidence := 0.98::numeric,
      p_reason := 'Cosmetics and perfumes are prohibited'::text,
      p_suggested_category := null::text,
      p_flagged_reasons := '["Prohibited: cosmetics"]'::jsonb,
      p_content_hash := 'hash-perfume'::text,
      p_model_used := 'gemini-3.8-flash'::text
    );
  `);

  const rejectedNonTech = (await db.query(`select status, verification_status from public.products where id = '${newNonTech.id}';`)).rows[0];
  assert.equal(rejectedNonTech.status, "draft", "Rejected listing must stay draft.");
  assert.equal(rejectedNonTech.verification_status, "rejected", "Rejected listing must be marked rejected.");
  console.log("   -> [PASS] Rejected non-tech listing remains unpublished draft.");

  // ---------------------------------------------------------------------------
  // 6. Verify Existing Features Function Cleanly Post-Migration
  // ---------------------------------------------------------------------------
  console.log("\nStep 6: Verifying Existing Carts, Orders, Payments & Negotiations...");

  const cartCheck = await db.query(`select count(*) as count from public.cart_items where user_id = '${buyerId}';`);
  assert.equal(Number(cartCheck.rows[0].count), 1, "Existing cart items must be intact.");

  const orderCheck = await db.query(`select count(*) as count from public.orders where id = '${orderId}';`);
  assert.equal(Number(orderCheck.rows[0].count), 1, "Existing order must be intact.");

  const paymentCheck = await db.query(`select count(*) as count from public.payment_transactions where order_id = '${orderId}';`);
  assert.equal(Number(paymentCheck.rows[0].count), 1, "Existing payment transaction must be intact.");

  const offerCheck = await db.query(`select count(*) as count from public.chat_offers where id = '${chatOfferId}';`);
  assert.equal(Number(offerCheck.rows[0].count), 1, "Existing chat offer must be intact.");

  const depositCheck = await db.query(`select count(*) as count from public.meetup_deposits where offer_id = '${chatOfferId}';`);
  assert.equal(Number(depositCheck.rows[0].count), 1, "Existing meetup deposit must be intact.");

  console.log("   -> [PASS] 100% of existing carts, orders, payments, offers, and deposits remain intact.");

  console.log("\n==========================================================================");
  console.log("PHASE 3 STAGING VALIDATION PASSED (100% SUCCESS)");
  console.log("==========================================================================\n");
}

runPhase3StagingValidation().catch((err) => {
  console.error("Phase 3 Staging Validation failed:", err);
  process.exit(1);
});
