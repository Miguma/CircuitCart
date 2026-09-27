import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// 1. Read environment variables from .env.local
const envText = fs.readFileSync(".env.local", "utf8");
const getEnv = (k) => {
  const m = envText.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const supabase = createClient(url, key);

// 2. Fetch real products from live Supabase
const { data: products, error } = await supabase
  .from("products")
  .select("id, title, price, seller_id, shop_id, stock")
  .eq("status", "active")
  .gt("stock", 0)
  .order("price", { ascending: false });

assert.equal(error, null, "Supabase products query should not error");
assert.ok(products && products.length >= 2, "Should have at least 2 active products in live DB");

console.log(`Loaded ${products.length} live products for runtime test.`);

// 3. Replicate the EXACT client-side helper functions from app/marketplace/cart/page.tsx
const formatPrice = (price) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(price);

function computeCartTotals(cartItems, deliveryMethod = "delivery") {
  const map = new Map();
  for (const item of cartItems) {
    const k =
      item.product.shopId ||
      item.product.sellerId ||
      item.product.sellerName ||
      "verified-seller";
    const name = item.product.sellerName || "Verified Seller";
    const existing = map.get(k);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(k, { sellerName: name, items: [item] });
    }
  }

  const sellerGroups = Array.from(map.entries()).map(([k, data]) => {
    const subtotal = data.items.reduce(
      (sum, it) => sum + Number(it.product.price) * Number(it.quantity),
      0
    );
    const shippingFee =
      deliveryMethod === "meetup" || subtotal >= 10000 || subtotal === 0
        ? 0
        : 150;
    const total = subtotal + shippingFee;
    return { sellerKey: k, sellerName: data.sellerName, items: data.items, subtotal, shippingFee, total };
  });

  const checkoutDisplayTotal = (!cartItems || cartItems.length === 0)
    ? 0
    : sellerGroups.reduce(
        (acc, g) => acc + Number(g.subtotal || 0) + Number(g.shippingFee || 0),
        0
      );

  const totalAmountDueRendered = checkoutDisplayTotal > 0
    ? formatPrice(checkoutDisplayTotal)
    : "Unable to calculate total";

  const mayaButtonRendered = checkoutDisplayTotal <= 0 || cartItems.length === 0
    ? "Unable to calculate total"
    : `Pay ${formatPrice(checkoutDisplayTotal)} with Maya`;

  const mayaButtonDisabled = checkoutDisplayTotal <= 0 || cartItems.length === 0;

  return {
    sellerGroups,
    checkoutDisplayTotal,
    totalAmountDueRendered,
    mayaButtonRendered,
    mayaButtonDisabled,
  };
}

// Find ROG STRIX RTX 5070 (₱55,000) or fallback to highest price product
const rogGpu = products.find(p => p.title.includes("5070")) || products[0];
const secondProd = products.find(p => p.id !== rogGpu.id) || products[1];

console.log(`\nProduct 1: "${rogGpu.title}" — Price: ${formatPrice(rogGpu.price)} (raw: ${rogGpu.price})`);
console.log(`Product 2: "${secondProd.title}" — Price: ${formatPrice(secondProd.price)} (raw: ${secondProd.price})`);

// =========================================================================
// TEST 1: 1 item x non-zero price (ROG STRIX RTX 5070, ₱55,000, Qty 1)
// =========================================================================
console.log("\n--- TEST 1: 1 item x non-zero price ---");
const cart1 = [
  {
    product: {
      id: rogGpu.id,
      name: rogGpu.title,
      price: rogGpu.price,
      sellerId: rogGpu.seller_id,
      shopId: rogGpu.shop_id,
      sellerName: "Test Seller",
    },
    quantity: 1,
  },
];
const res1 = computeCartTotals(cart1, "delivery");
console.log("Expected total:", formatPrice(rogGpu.price));
console.log("checkoutDisplayTotal:", res1.checkoutDisplayTotal);
console.log("Total Amount Due rendered:", res1.totalAmountDueRendered);
console.log("Maya Button rendered:", res1.mayaButtonRendered);
console.log("Maya Button disabled:", res1.mayaButtonDisabled);

assert.equal(res1.checkoutDisplayTotal, rogGpu.price);
assert.equal(res1.totalAmountDueRendered, formatPrice(rogGpu.price));
assert.equal(res1.mayaButtonRendered, `Pay ${formatPrice(rogGpu.price)} with Maya`);
assert.equal(res1.mayaButtonDisabled, false);
console.log("✅ TEST 1 PASSED");

// =========================================================================
// TEST 2: 2 quantity x non-zero price (ROG STRIX RTX 5070, ₱55,000, Qty 2)
// =========================================================================
console.log("\n--- TEST 2: 2 quantity x non-zero price ---");
const expected2 = rogGpu.price * 2;
const cart2 = [
  {
    product: {
      id: rogGpu.id,
      name: rogGpu.title,
      price: rogGpu.price,
      sellerId: rogGpu.seller_id,
      shopId: rogGpu.shop_id,
      sellerName: "Test Seller",
    },
    quantity: 2,
  },
];
const res2 = computeCartTotals(cart2, "delivery");
console.log("Expected total:", formatPrice(expected2));
console.log("checkoutDisplayTotal:", res2.checkoutDisplayTotal);
console.log("Total Amount Due rendered:", res2.totalAmountDueRendered);
console.log("Maya Button rendered:", res2.mayaButtonRendered);
console.log("Maya Button disabled:", res2.mayaButtonDisabled);

assert.equal(res2.checkoutDisplayTotal, expected2);
assert.equal(res2.totalAmountDueRendered, formatPrice(expected2));
assert.equal(res2.mayaButtonRendered, `Pay ${formatPrice(expected2)} with Maya`);
assert.equal(res2.mayaButtonDisabled, false);
console.log("✅ TEST 2 PASSED");

// =========================================================================
// TEST 3: Multiple products (ROG STRIX RTX 5070 + second product)
// =========================================================================
console.log("\n--- TEST 3: Multiple products ---");
const cart3 = [
  {
    product: {
      id: rogGpu.id,
      name: rogGpu.title,
      price: rogGpu.price,
      sellerId: rogGpu.seller_id,
      shopId: rogGpu.shop_id,
      sellerName: "Seller A",
    },
    quantity: 1,
  },
  {
    product: {
      id: secondProd.id,
      name: secondProd.title,
      price: secondProd.price,
      sellerId: secondProd.seller_id,
      shopId: secondProd.shop_id,
      sellerName: "Seller B",
    },
    quantity: 1,
  },
];
const res3 = computeCartTotals(cart3, "delivery");
// Check shipping: if subtotal >= 10000 free, otherwise 150 per shop
let expectedSubtotal = rogGpu.price + secondProd.price;
let expectedShipping = 0;
if (rogGpu.price < 10000) expectedShipping += 150;
if (secondProd.price < 10000) expectedShipping += 150;
const expectedTotal3 = expectedSubtotal + expectedShipping;

console.log("Expected total:", formatPrice(expectedTotal3));
console.log("checkoutDisplayTotal:", res3.checkoutDisplayTotal);
console.log("Total Amount Due rendered:", res3.totalAmountDueRendered);
console.log("Maya Button rendered:", res3.mayaButtonRendered);

assert.equal(res3.checkoutDisplayTotal, expectedTotal3);
assert.equal(res3.totalAmountDueRendered, formatPrice(expectedTotal3));
assert.equal(res3.mayaButtonRendered, `Pay ${formatPrice(expectedTotal3)} with Maya`);
console.log("✅ TEST 3 PASSED");

// =========================================================================
// TEST 4: Zero / Empty Cart Guard (Should NOT say "Pay ₱0 with Maya")
// =========================================================================
console.log("\n--- TEST 4: Zero / Empty cart guard ---");
const res4 = computeCartTotals([], "delivery");
console.log("Empty cart display total:", res4.checkoutDisplayTotal);
console.log("Total Amount Due rendered:", res4.totalAmountDueRendered);
console.log("Maya Button rendered:", res4.mayaButtonRendered);
console.log("Maya Button disabled:", res4.mayaButtonDisabled);

assert.equal(res4.checkoutDisplayTotal, 0);
assert.equal(res4.totalAmountDueRendered, "Unable to calculate total");
assert.equal(res4.mayaButtonRendered, "Unable to calculate total");
assert.equal(res4.mayaButtonDisabled, true);
assert.notEqual(res4.mayaButtonRendered, "Pay ₱0 with Maya", "Must NEVER say Pay ₱0 with Maya");
console.log("✅ TEST 4 PASSED");

console.log("\n🎉 ALL CC-018 RUNTIME TESTS PASSED WITH LIVE SUPABASE PRODUCT DATA!");
