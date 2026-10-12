import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabase } from "./database.mjs";

const buyer = "11111111-1111-4111-8111-111111111111";
const seller = "22222222-2222-4222-8222-222222222222";
const shop = "33333333-3333-4333-8333-333333333333";
const product = "44444444-4444-4444-8444-444444444444";
const conversation = "55555555-5555-4555-8555-555555555555";
const attempt = "66666666-6666-4666-8666-666666666666";

describe("private offer to meetup deposit lifecycle", () => {
  let db;
  let offerId;
  let transactionId;
  let orderId;

  before(async () => {
    db = await createTestDatabase();
    await db.exec(`
      insert into auth.users(id,email,raw_user_meta_data) values
        ('${buyer}','buyer@example.com','{"full_name":"Buyer"}'),
        ('${seller}','seller@example.com','{"full_name":"Seller"}');
      update public.profiles set role='seller' where id='${seller}';
      insert into public.shops(id,owner_id,name,slug,status,is_verified)
        values('${shop}','${seller}','Seller Shop','seller-shop','active',true);
      insert into public.products(id,seller_id,shop_id,title,category,condition,price,stock,status)
        values('${product}','${seller}','${shop}','Test Laptop','Laptops','Good',1000,2,'active');
      insert into public.conversations(id,buyer_id,seller_id,shop_id,product_id)
        values('${conversation}','${buyer}','${seller}','${shop}','${product}');
    `);
  });
  after(async () => { await db?.close(); });

  it("seller offer changes only this buyer's cart price", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${seller}',false)`);
    const sent = await db.query(`select public.send_chat_offer('${conversation}','${product}',1,800,24) id`);
    offerId = sent.rows[0].id;

    await db.exec(`select set_config('request.jwt.claim.sub','${buyer}',false)`);
    await db.query(`select public.respond_chat_offer('${offerId}','accept')`);
    const snapshot = await db.query(`
      select p.price public_price,c.quantity,c.offer_id,o.unit_price,o.status
      from public.cart_items c join public.products p on p.id=c.product_id
      join public.chat_offers o on o.id=c.offer_id where c.user_id='${buyer}'
    `);
    assert.equal(Number(snapshot.rows[0].public_price), 1000);
    assert.equal(Number(snapshot.rows[0].unit_price), 800);
    assert.equal(snapshot.rows[0].status, "accepted");
  });

  it("meetup checkout collects exactly half of the negotiated total", async () => {
    const created = await db.query(`select public.create_demo_checkout('${attempt}','meetup',null,null,null,null,'4242') result`);
    transactionId = created.rows[0].result.paymentTransactionId;
    orderId = created.rows[0].result.orderIds[0];
    const state = await db.query(`
      select t.amount,o.subtotal,o.total,o.deposit_amount,o.balance_due,i.unit_price,i.offer_id,f.status
      from public.payment_transactions t join public.orders o on o.payment_transaction_id=t.id
      join public.order_items i on i.order_id=o.id join public.chat_offers f on f.id=i.offer_id
      where t.id='${transactionId}'
    `);
    const row = state.rows[0];
    assert.equal(Number(row.subtotal), 800);
    assert.equal(Number(row.total), 800);
    assert.equal(Number(row.deposit_amount), 400);
    assert.equal(Number(row.balance_due), 400);
    assert.equal(Number(row.amount), 400);
    assert.equal(Number(row.unit_price), 800);
    assert.equal(row.offer_id, offerId);
    assert.equal(row.status, "reserved");
  });

  it("verified deposit records full commission and only collected seller funds", async () => {
    await db.query(`select public.confirm_online_payment('${transactionId}')`);
    const finance = await db.query(`
      select o.payment_status,o.status,c.gross_amount,c.commission_base,c.commission_amount,
             p.gross_amount payout_gross,p.platform_fee,p.net_amount,p.status payout_status
      from public.orders o join public.platform_commissions c on c.order_id=o.id
      join public.seller_payouts p on p.order_id=o.id where o.id='${orderId}'
    `);
    const row = finance.rows[0];
    assert.equal(row.payment_status, "partially_paid");
    assert.equal(row.status, "confirmed");
    assert.equal(Number(row.gross_amount), 800);
    assert.equal(Number(row.commission_base), 800);
    assert.equal(Number(row.commission_amount), 40);
    assert.equal(Number(row.payout_gross), 400);
    assert.equal(Number(row.platform_fee), 40);
    assert.equal(Number(row.net_amount), 360);
    assert.equal(row.payout_status, "pending");
  });

  it("requires seller balance confirmation before buyer completion", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${seller}',false)`);
    await db.query(`select public.update_seller_order_status('${orderId}','preparing')`);
    await db.query(`select public.update_seller_order_status('${orderId}','ready')`);
    await db.exec(`select set_config('request.jwt.claim.sub','${buyer}',false)`);
    await assert.rejects(db.query(`select public.buyer_confirm_order_received('${orderId}')`), /remaining meetup balance/i);

    await db.exec(`select set_config('request.jwt.claim.sub','${seller}',false)`);
    await db.query(`select public.confirm_meetup_balance('${orderId}')`);
    await db.exec(`select set_config('request.jwt.claim.sub','${buyer}',false)`);
    await db.query(`select public.buyer_confirm_order_received('${orderId}')`);
    const finished = await db.query(`select status,payment_status,balance_received_at from public.orders where id='${orderId}'`);
    const payout = await db.query(`select status from public.seller_payouts where order_id='${orderId}'`);
    assert.equal(finished.rows[0].status, "completed");
    assert.equal(finished.rows[0].payment_status, "paid");
    assert.ok(finished.rows[0].balance_received_at);
    assert.equal(payout.rows[0].status, "eligible");
  });

  it("cancels an unfinished sandbox meetup and reverses the deposit records", async () => {
    const product2 = "77777777-7777-4777-8777-777777777777";
    const attempt2 = "88888888-8888-4888-8888-888888888888";
    await db.exec(`
      insert into public.products(id,seller_id,shop_id,title,category,condition,price,stock,status)
        values('${product2}','${seller}','${shop}','Test Phone','Mobile','Good',1000,1,'active');
      insert into public.cart_items(user_id,product_id,quantity) values('${buyer}','${product2}',1);
      select set_config('request.jwt.claim.sub','${buyer}',false);
    `);
    const checkout = await db.query(`select public.create_demo_checkout('${attempt2}','meetup',null,null,null,null,'4242') result`);
    const tx2 = checkout.rows[0].result.paymentTransactionId;
    const order2 = checkout.rows[0].result.orderIds[0];
    await db.query(`select public.confirm_online_payment('${tx2}')`);
    await db.query(`select public.refund_meetup_deposit('${order2}')`);
    const result = await db.query(`
      select o.status,o.payment_status,o.deposit_refunded_at,p.stock,
             sp.status payout_status,pc.collection_status
      from public.orders o join public.order_items i on i.order_id=o.id
      join public.products p on p.id=i.product_id
      join public.seller_payouts sp on sp.order_id=o.id
      join public.platform_commissions pc on pc.order_id=o.id where o.id='${order2}'
    `);
    assert.equal(result.rows[0].status, "cancelled");
    assert.equal(result.rows[0].payment_status, "refunded");
    assert.ok(result.rows[0].deposit_refunded_at);
    assert.equal(Number(result.rows[0].stock), 1);
    assert.equal(result.rows[0].payout_status, "refunded");
    assert.equal(result.rows[0].collection_status, "refunded");
  });

  it("keeps normal delivery checkout at the full public total", async () => {
    const product3 = "99999999-9999-4999-8999-999999999999";
    const attempt3 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.exec(`
      insert into public.products(id,seller_id,shop_id,title,category,condition,price,stock,status)
        values('${product3}','${seller}','${shop}','Test Monitor','Components','Good',1000,1,'active');
      insert into public.cart_items(user_id,product_id,quantity) values('${buyer}','${product3}',1);
      select set_config('request.jwt.claim.sub','${buyer}',false);
    `);
    const checkout = await db.query(`
      select public.create_demo_checkout(
        '${attempt3}','delivery','Buyer','09171234567','Cebu City',null,'4242'
      ) result
    `);
    const tx3 = checkout.rows[0].result.paymentTransactionId;
    const order3 = checkout.rows[0].result.orderIds[0];
    const result = await db.query(`
      select t.amount,o.subtotal,o.shipping_fee,o.total,o.deposit_amount
      from public.payment_transactions t join public.orders o on o.payment_transaction_id=t.id
      where t.id='${tx3}' and o.id='${order3}'
    `);
    assert.equal(Number(result.rows[0].amount), 1150);
    assert.equal(Number(result.rows[0].subtotal), 1000);
    assert.equal(Number(result.rows[0].shipping_fee), 150);
    assert.equal(Number(result.rows[0].total), 1150);
    assert.equal(result.rows[0].deposit_amount, null);

    await db.query(`select public.confirm_online_payment('${tx3}')`);
    const paid = await db.query(`select payment_status from public.orders where id='${order3}'`);
    assert.equal(paid.rows[0].payment_status, "paid");
  });
});
