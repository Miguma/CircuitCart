import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabase } from "./database.mjs";

const buyerA = "11111111-1111-4111-8111-111111111111";
const buyerB = "11111111-1111-4111-8111-222222222222";
const seller = "22222222-2222-4222-8222-222222222222";
const shop = "33333333-3333-4333-8333-333333333333";
const product10k = "44444444-4444-4444-8444-100000000000";
const convA = "55555555-5555-4555-8555-111111111111";
const convB = "55555555-5555-4555-8555-222222222222";
const attemptMeetupA = "66666666-6666-4666-8666-111111111111";
const attemptCODA = "66666666-6666-4666-8666-222222222222";
const attemptMeetupB = "66666666-6666-4666-8666-333333333333";

describe("negotiated price cart and checkout synchronization", () => {
  let db;
  let offerId;

  before(async () => {
    db = await createTestDatabase();
    await db.exec(`
      insert into auth.users(id,email,raw_user_meta_data) values
        ('${buyerA}','buyerA@example.com','{"full_name":"Buyer A"}'),
        ('${buyerB}','buyerB@example.com','{"full_name":"Buyer B"}'),
        ('${seller}','seller@example.com','{"full_name":"Seller"}');
      update public.profiles set role='seller' where id='${seller}';
      insert into public.shops(id,owner_id,name,slug,status,is_verified)
        values('${shop}','${seller}','Tech Store','tech-store','active',true);
      insert into public.products(id,seller_id,shop_id,title,category,condition,price,stock,status)
        values('${product10k}','${seller}','${shop}','High-End Laptop','Laptops','Like New',10000,5,'active');
      insert into public.conversations(id,buyer_id,seller_id,shop_id,product_id)
        values
          ('${convA}','${buyerA}','${seller}','${shop}','${product10k}'),
          ('${convB}','${buyerB}','${seller}','${shop}','${product10k}');
    `);
  });

  after(async () => {
    await db?.close();
  });

  it("1. seller creates ₱8,000 private offer on ₱10,000 product and buyer accepts", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${seller}',false)`);
    const sent = await db.query(
      `select public.send_chat_offer('${convA}','${product10k}',1,8000,24) id`
    );
    offerId = sent.rows[0].id;

    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);
    await db.query(`select public.respond_chat_offer('${offerId}','accept')`);

    // Verify cart_items row was populated with offer_id and quantity 1
    const cart = await db.query(`
      select c.product_id, c.quantity, c.offer_id, o.unit_price, o.status, p.price as catalog_price
      from public.cart_items c
      join public.products p on p.id = c.product_id
      join public.chat_offers o on o.id = c.offer_id
      where c.user_id = '${buyerA}'
    `);

    assert.equal(cart.rows.length, 1);
    assert.equal(Number(cart.rows[0].catalog_price), 10000, "Catalog price must remain ₱10,000");
    assert.equal(Number(cart.rows[0].unit_price), 8000, "Offer price must be ₱8,000");
    assert.equal(cart.rows[0].quantity, 1);
    assert.equal(cart.rows[0].offer_id, offerId);
    assert.equal(cart.rows[0].status, "accepted");
  });

  it("2. normal add to cart or re-add does not lose the accepted offer", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);
    // Attempt re-adding the product to cart with quantity = 2 without passing offer_id
    await db.exec(`
      insert into public.cart_items(user_id, product_id, quantity)
      values ('${buyerA}', '${product10k}', 2)
      on conflict (user_id, product_id)
      do update set quantity = excluded.quantity;
    `);

    const cart = await db.query(`
      select c.quantity, c.offer_id
      from public.cart_items c
      where c.user_id = '${buyerA}' and c.product_id = '${product10k}'
    `);

    assert.equal(cart.rows.length, 1);
    // sync trigger automatically keeps offer_id and locks quantity to offer quantity
    assert.equal(cart.rows[0].offer_id, offerId, "Must preserve accepted offer_id");
    assert.equal(cart.rows[0].quantity, 1, "Must lock quantity to negotiated offer quantity");
  });

  it("3. meetup checkout with accepted offer charges exactly ₱4,000 deposit on ₱8,000 total", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);
    const created = await db.query(
      `select public.create_demo_checkout('${attemptMeetupA}','meetup',null,null,null,null,'4242') result`
    );
    const txId = created.rows[0].result.paymentTransactionId;
    const ordId = created.rows[0].result.orderIds[0];

    const state = await db.query(`
      select t.amount as deposit_paid, o.subtotal, o.total, o.deposit_amount, o.balance_due,
             i.unit_price, i.offer_id, f.status as offer_status
      from public.payment_transactions t
      join public.orders o on o.payment_transaction_id = t.id
      join public.order_items i on i.order_id = o.id
      join public.chat_offers f on f.id = i.offer_id
      where t.id = '${txId}' and o.id = '${ordId}'
    `);

    const row = state.rows[0];
    assert.equal(Number(row.subtotal), 8000, "Subtotal should be ₱8,000");
    assert.equal(Number(row.total), 8000, "Total should be ₱8,000 (meetup free shipping)");
    assert.equal(Number(row.deposit_amount), 4000, "Meetup deposit must be 50% = ₱4,000");
    assert.equal(Number(row.balance_due), 4000, "Balance due at meetup must be ₱4,000");
    assert.equal(Number(row.deposit_paid), 4000, "Transaction amount charged must be ₱4,000");
    assert.equal(Number(row.unit_price), 8000, "Order item price must be ₱8,000");
    assert.equal(row.offer_id, offerId);
    assert.equal(row.offer_status, "reserved");

    // Complete transaction
    await db.query(`select public.confirm_online_payment('${txId}')`);
  });

  it("4. buyer B is unaffected by buyer A's private offer (catalog price is ₱10,000, deposit is ₱5,000)", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerB}',false)`);

    // Buyer B adds product to cart
    await db.exec(`
      insert into public.cart_items(user_id, product_id, quantity)
      values ('${buyerB}', '${product10k}', 1);
    `);

    const cart = await db.query(`
      select c.quantity, c.offer_id, p.price
      from public.cart_items c
      join public.products p on p.id = c.product_id
      where c.user_id = '${buyerB}' and c.product_id = '${product10k}'
    `);

    assert.equal(cart.rows[0].offer_id, null, "Buyer B must have no offer_id");
    assert.equal(Number(cart.rows[0].price), 10000, "Buyer B must see standard ₱10,000 price");

    // Buyer B meetup checkout
    const created = await db.query(
      `select public.create_demo_checkout('${attemptMeetupB}','meetup',null,null,null,null,'4242') result`
    );
    const txId = created.rows[0].result.paymentTransactionId;
    const ordId = created.rows[0].result.orderIds[0];

    const state = await db.query(`
      select t.amount as deposit_paid, o.subtotal, o.total, o.deposit_amount, o.balance_due, i.unit_price, i.offer_id
      from public.payment_transactions t
      join public.orders o on o.payment_transaction_id = t.id
      join public.order_items i on i.order_id = o.id
      where t.id = '${txId}' and o.id = '${ordId}'
    `);

    const row = state.rows[0];
    assert.equal(Number(row.subtotal), 10000, "Buyer B subtotal must be ₱10,000");
    assert.equal(Number(row.total), 10000, "Buyer B total must be ₱10,000");
    assert.equal(Number(row.deposit_amount), 5000, "Buyer B meetup deposit must be 50% = ₱5,000");
    assert.equal(Number(row.balance_due), 5000, "Buyer B balance due must be ₱5,000");
    assert.equal(Number(row.deposit_paid), 5000);
    assert.equal(row.offer_id, null);

    // Cancel Buyer B checkout to clean up
    await db.query(`select public.cancel_online_checkout('${attemptMeetupB}')`);
  });

  it("5. expired offer halts checkout and prevents silent price increase", async () => {
    // Seller sends a second offer to Buyer A for ₱7,500
    await db.exec(`select set_config('request.jwt.claim.sub','${seller}',false)`);
    const sent = await db.query(
      `select public.send_chat_offer('${convA}','${product10k}',1,7500,24) id`
    );
    const expiredOfferId = sent.rows[0].id;

    // Buyer A accepts it
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);
    await db.query(`select public.respond_chat_offer('${expiredOfferId}','accept')`);

    // Artificially expire the offer in the database
    await db.exec(`
      update public.chat_offers
      set expires_at = clock_timestamp() - interval '1 hour'
      where id = '${expiredOfferId}'
    `);

    // Re-touch cart or trigger sync
    await db.exec(`
      update public.cart_items
      set updated_at = clock_timestamp()
      where user_id = '${buyerA}' and product_id = '${product10k}'
    `);

    const cart = await db.query(`
      select c.quantity, c.offer_id
      from public.cart_items c
      where c.user_id = '${buyerA}' and c.product_id = '${product10k}'
    `);

    // Offer ID must NOT be silently wiped to null — it must remain attached
    // so checkout stops the buyer from unknowingly paying the full price
    assert.equal(cart.rows[0].offer_id, expiredOfferId, "Expired offer_id must remain attached to halt unconfirmed checkout");

    // Attempting checkout without confirmation must fail with 'Private offer expired or changed'
    await assert.rejects(
      async () => {
        await db.query(
          `select public.create_demo_checkout('${attemptCODA}','meetup',null,null,null,null,'4242') result`
        );
      },
      (err) => {
        assert.match(err.message, /Private offer expired or changed/);
        return true;
      },
      "Checkout must abort payment initialization when an offer is expired"
    );
  });

  it("6. explicit buyer confirmation via dismiss_cart_offer clears offer and allows standard checkout", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);

    // Buyer explicitly confirms proceeding at catalog price
    const dismissed = await db.query(
      `select public.dismiss_cart_offer('${product10k}') result`
    );
    assert.equal(dismissed.rows[0].result, true);

    // Verify cart_items offer_id is now cleared
    const cart = await db.query(`
      select offer_id from public.cart_items where user_id = '${buyerA}' and product_id = '${product10k}'
    `);
    assert.equal(cart.rows[0].offer_id, null, "Offer ID must be cleared after explicit dismissal");

    // Verify dismissal is recorded in cart_offer_dismissals
    const dismissals = await db.query(`
      select buyer_id, product_id from public.cart_offer_dismissals where buyer_id = '${buyerA}' and product_id = '${product10k}'
    `);
    assert.equal(dismissals.rows.length, 1, "Dismissal record must be stored");

    // Now checkout succeeds at standard ₱10,000 price with ₱5,000 deposit
    const created = await db.query(
      `select public.create_demo_checkout('${attemptCODA}','meetup',null,null,null,null,'4242') result`
    );
    const ordId = created.rows[0].result.orderIds[0];

    const state = await db.query(`
      select o.subtotal, o.total, o.deposit_amount, i.unit_price, i.offer_id
      from public.orders o
      join public.order_items i on i.order_id = o.id
      where o.id = '${ordId}'
    `);

    assert.equal(Number(state.rows[0].subtotal), 10000, "Price proceeds at standard ₱10,000");
    assert.equal(Number(state.rows[0].deposit_amount), 5000, "Meetup deposit is 50% = ₱5,000");
    assert.equal(state.rows[0].offer_id, null);

    // Cancel checkout attempt to clean up
    await db.query(`select public.cancel_online_checkout('${attemptCODA}')`);
  });

  it("7. dismissed offer is not resurrected by normal add to cart or cart touches", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);

    // Buyer re-adds item to cart without offer_id
    await db.exec(`
      insert into public.cart_items(user_id, product_id, quantity)
      values ('${buyerA}', '${product10k}', 1)
      on conflict (user_id, product_id)
      do update set quantity = excluded.quantity;
    `);

    const cart = await db.query(`
      select offer_id from public.cart_items where user_id = '${buyerA}' and product_id = '${product10k}'
    `);
    assert.equal(cart.rows[0].offer_id, null, "Dismissed offer must NOT be reattached");
  });

  it("8. withdrawn offer halts checkout until buyer explicitly confirms", async () => {
    const attemptWithdrawn = "66666666-6666-4666-8666-444444444444";

    // Seller sends a 3rd offer for ₱8,500
    await db.exec(`select set_config('request.jwt.claim.sub','${seller}',false)`);
    const sent = await db.query(
      `select public.send_chat_offer('${convA}','${product10k}',1,8500,24) id`
    );
    const offer3Id = sent.rows[0].id;

    // Buyer A accepts it
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);
    await db.query(`select public.respond_chat_offer('${offer3Id}','accept')`);

    // Seller withdraws the offer
    await db.exec(`select set_config('request.jwt.claim.sub','${seller}',false)`);
    await db.query(`select public.respond_chat_offer('${offer3Id}','withdraw')`);

    // Buyer attempts checkout — must be blocked to prevent silent price change
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);
    await assert.rejects(
      async () => {
        await db.query(
          `select public.create_demo_checkout('${attemptWithdrawn}','meetup',null,null,null,null,'4242') result`
        );
      },
      (err) => {
        assert.match(err.message, /Private offer expired or changed/);
        return true;
      }
    );

    // Buyer explicitly confirms original price
    await db.query(`select public.dismiss_cart_offer('${product10k}', '${offer3Id}')`);

    // Now checkout succeeds
    const created = await db.query(
      `select public.create_demo_checkout('${attemptWithdrawn}','meetup',null,null,null,null,'4242') result`
    );
    assert.ok(created.rows[0].result.orderIds.length > 0);
    await db.query(`select public.cancel_online_checkout('${attemptWithdrawn}')`);
  });

  it("9. new valid offer from seller binds cleanly even after a previous offer was dismissed", async () => {
    const attemptNewOffer = "66666666-6666-4666-8666-555555555555";

    // Age prior test transactions to avoid the 3 attempts per hour rate limit
    await db.exec(`
      update public.payment_transactions
      set created_at = clock_timestamp() - interval '2 hours'
      where buyer_id = '${buyerA}';
    `);

    // Seller sends a 4th offer for ₱7,000
    await db.exec(`select set_config('request.jwt.claim.sub','${seller}',false)`);
    const sent = await db.query(
      `select public.send_chat_offer('${convA}','${product10k}',1,7000,24) id`
    );
    const offer4Id = sent.rows[0].id;

    // Buyer A accepts it
    await db.exec(`select set_config('request.jwt.claim.sub','${buyerA}',false)`);
    await db.query(`select public.respond_chat_offer('${offer4Id}','accept')`);

    const cart = await db.query(`
      select offer_id, quantity from public.cart_items where user_id = '${buyerA}' and product_id = '${product10k}'
    `);
    assert.equal(cart.rows[0].offer_id, offer4Id, "New offer must bind to cart");

    // Checkout with new offer charges ₱3,500 deposit on ₱7,000
    const created = await db.query(
      `select public.create_demo_checkout('${attemptNewOffer}','meetup',null,null,null,null,'4242') result`
    );
    const txId = created.rows[0].result.paymentTransactionId;
    const ordId = created.rows[0].result.orderIds[0];

    const state = await db.query(`
      select t.amount as deposit_paid, o.subtotal, o.deposit_amount, i.unit_price, i.offer_id
      from public.payment_transactions t
      join public.orders o on o.payment_transaction_id = t.id
      join public.order_items i on i.order_id = o.id
      where t.id = '${txId}' and o.id = '${ordId}'
    `);

    assert.equal(Number(state.rows[0].subtotal), 7000);
    assert.equal(Number(state.rows[0].deposit_amount), 3500);
    assert.equal(Number(state.rows[0].deposit_paid), 3500);
    assert.equal(state.rows[0].offer_id, offer4Id);

    await db.query(`select public.cancel_online_checkout('${attemptNewOffer}')`);
  });
});
