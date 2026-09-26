// Disposable localhost:55432 cluster ONLY. Never accepts a remote DB URL.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const psql = process.env.PSQL_TEST_BIN || "C:/Program Files/PostgreSQL/18/bin/psql.exe";
function sql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn(psql, ["-X", "-qAt", "-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
      windowsHide: true, env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" },
    });
    let output = "", error = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
    child.stdin.end(statement);
  });
}
const buyer = "71000000-0000-4000-8000-000000000001";
const otherBuyer = "71000000-0000-4000-8000-000000000002";
const seller = "71000000-0000-4000-8000-000000000003";
const shop = "72000000-0000-4000-8000-000000000001";
const product = "73000000-0000-4000-8000-000000000001";
const key = "74000000-0000-4000-8000-000000000001";
function attempt(user, attemptKey = key) {
  return sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}';
    select public.create_online_checkout('${attemptKey}', 'meetup'); commit;`);
}
async function cleanup() {
  await sql(`begin;
    delete from public.notifications where user_id in ('${buyer}','${otherBuyer}','${seller}');
    delete from public.orders where buyer_id in ('${buyer}','${otherBuyer}');
    delete from public.payment_transactions where buyer_id in ('${buyer}','${otherBuyer}');
    delete from public.cart_items where user_id in ('${buyer}','${otherBuyer}');
    delete from public.products where id='${product}';
    delete from public.shops where id='${shop}';
    delete from auth.users where id in ('${buyer}','${otherBuyer}','${seller}'); commit;`);
}
(async () => {
  assert.equal(await sql("select count(*) from auth.users"), "0", "requires empty disposable fixture database");
  try {
    await sql(`insert into auth.users(id,email) values ('${buyer}','concurrent-a@example.invalid'),('${otherBuyer}','concurrent-b@example.invalid'),('${seller}','concurrent-seller@example.invalid');
      update public.profiles set role='seller' where id='${seller}';
      insert into public.shops(id,owner_id,name,slug) values('${shop}','${seller}','Concurrent shop','concurrent-shop');
      insert into public.products(id,seller_id,shop_id,title,category,condition,price,stock,status)
        values('${product}','${seller}','${shop}','Last unit','Accessories','New',25.55,1,'active');
      insert into public.cart_items(user_id,product_id,quantity) values('${buyer}','${product}',1);`);
    const results = await Promise.all(Array.from({ length: 5 }, () => attempt(buyer)));
    assert.equal(new Set(results).size, 1, "concurrent identical keys return one checkout");
    assert.equal(await sql("select count(*) from public.payment_transactions"), "1");
    assert.equal(await sql("select count(*) from public.orders"), "1");
    assert.equal(await sql(`select stock from public.products where id='${product}'`), "0");
    assert.equal(await attempt(buyer, "74000000-0000-4000-8000-000000000002"), results[0], "different key recovers active checkout");
    console.log("PASS: five concurrent requests, one checkout/order, one stock decrement; different-key recovery");
    await sql(`update public.payment_transactions set expires_at=clock_timestamp()-interval '1 second' where buyer_id='${buyer}'`);
    const expiries = await Promise.all(Array.from({ length: 5 }, () => sql(`begin; set local role authenticated;
      set local request.jwt.claim.sub='${otherBuyer}'; select public.expire_online_checkouts(); commit;`)));
    assert.equal(expiries.filter((result) => result === "1").length, 1);
    assert.equal(await sql(`select stock from public.products where id='${product}'`), "1");
    assert.equal(await sql("select count(*) from public.orders where status='cancelled'"), "1");
    console.log("PASS: five concurrent expiry calls restore the last unit exactly once");
    await cleanup();
    await sql(`insert into auth.users(id,email) values ('${buyer}','race-a@example.invalid'),('${otherBuyer}','race-b@example.invalid'),('${seller}','race-seller@example.invalid');
      update public.profiles set role='seller' where id='${seller}';
      insert into public.shops(id,owner_id,name,slug) values('${shop}','${seller}','Race shop','race-shop');
      insert into public.products(id,seller_id,shop_id,title,category,condition,price,stock,status)
        values('${product}','${seller}','${shop}','Last unit','Accessories','New',25.55,1,'active');
      insert into public.cart_items(user_id,product_id,quantity) values('${buyer}','${product}',1),('${otherBuyer}','${product}',1);`);
    const race = await Promise.allSettled([attempt(buyer), attempt(otherBuyer)]);
    assert.equal(race.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(race.filter((item) => item.status === "rejected").length, 1);
    assert.equal(await sql("select count(*) from public.orders"), "1");
    assert.equal(await sql("select count(*) from public.cart_items"), "1", "losing buyer cart retained");
    assert.equal(await sql(`select stock from public.products where id='${product}'`), "0");
    console.log("PASS: two buyers racing for last unit; one checkout wins, loser rolls back without overselling");
    const winner = await sql("select buyer_id from public.payment_transactions limit 1");
    const orderId = await sql("select id from public.orders limit 1");
    await sql("update public.payment_transactions set expires_at=clock_timestamp()-interval '1 second'");
    await Promise.all([
      sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${winner}'; select public.cancel_online_checkout('${key}'); commit;`),
      sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${seller}'; select public.update_seller_order_status('${orderId}','cancelled'); commit;`),
      sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${otherBuyer}'; select public.expire_online_checkouts(); commit;`),
    ]);
    assert.equal(await sql(`select stock from public.products where id='${product}'`), "1");
    console.log("PASS: buyer cancellation, seller cancellation and expiry race; exactly one restoration, no deadlock");
  } finally { await cleanup(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
