// dodo-create-products.js — one-off ops script: create the SafeSponsor AI
// products on the Dodo test-mode account and wire their IDs into .env.local.
// E2E-4 fix: prices were wildly wrong on the lost account; the new account
// starts clean, so we create $8 / $19 / $149 USD products here.
// Run: node scripts/dodo-create-products.js
const fs = require("fs");
const path = require("path");

const BASE = "https://test.dodopayments.com";

const PRODUCTS = [
  {
    name: "Single Report",
    description: "One-time audit of a single creator profile.",
    price: {
      currency: "USD",
      price: 800, // $8.00 USD, minor units
      discount: 0,
      purchasing_power_parity: false,
      type: "one_time_price",
    },
    tax_category: "digital_products",
  },
  {
    name: "Channel Report",
    description: "One-time deep audit of a creator channel (videos + comments).",
    price: {
      currency: "USD",
      price: 1900, // $19.00 USD
      discount: 0,
      purchasing_power_parity: false,
      type: "one_time_price",
    },
    tax_category: "digital_products",
  },
  {
    name: "Pro",
    description: "Unlimited audits, monthly subscription.",
    price: {
      currency: "USD",
      price: 14900, // $149.00 USD / month
      discount: 0,
      purchasing_power_parity: false,
      type: "recurring_price",
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 1,
      subscription_period_interval: "Month",
      trial_period_days: 0,
    },
    tax_category: "saas",
  },
];

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

function saveEnv(file, env) {
  const lines = Object.entries(env)
    .map(([k, v]) => `${k}="${v}"`)
    .join("\n");
  fs.writeFileSync(file, lines + "\n", "utf8");
}

async function createProduct(key, spec) {
  const res = await fetch(BASE + "/products", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(spec),
  });
  const body = await res.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* not json */ }
  if (res.status !== 200 && res.status !== 201) {
    throw new Error("create '" + spec.name + "' failed status=" + res.status + " body=" + body.slice(0, 300));
  }
  return json;
}

async function main() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = loadEnv(envPath);
  const key = env.DODO_PAYMENTS_API_KEY;
  if (!key || key === "[SENSITIVE]") {
    console.error("[FAIL] DODO_PAYMENTS_API_KEY missing or redacted in .env.local");
    process.exit(1);
  }

  // Skip products that already exist (re-run safety: two were created in a
  // previous partial run before the script crashed on the third).
  const listRes = await fetch(BASE + "/products?limit=100", {
    headers: { Authorization: "Bearer " + key, Accept: "application/json" },
  });
  const existing = listRes.ok ? ((await listRes.json()).items || []) : [];
  const byName = new Map(existing.map((p) => [p.name, p.product_id]));
  console.log("[INFO] Existing products on account: " + existing.length);

  const created = {};
  for (const spec of PRODUCTS) {
    const already = byName.get(spec.name);
    if (already) {
      console.log("[SKIP] '" + spec.name + "' exists (id=" + already + ")");
      created[already] = true;
      continue;
    }
    const p = await createProduct(key, spec);
    created[p.product_id] = true;
    console.log("[OK] created id=" + p.product_id + " name=" + JSON.stringify(p.name) + " price=" + (p.price && p.price.price) + " currency=" + (p.price && p.price.currency));
  }

  // Resolve final IDs by name (covers skip + fresh paths identically).
  const finalList = await (await fetch(BASE + "/products?limit=100", {
    headers: { Authorization: "Bearer " + key, Accept: "application/json" },
  })).json();
  const finalByName = new Map((finalList.items || []).map((p) => [p.name, p.product_id]));
  const single = finalByName.get("Single Report");
  const channel = finalByName.get("Channel Report");
  const pro = finalByName.get("Pro");
  if (!single || !channel || !pro) {
    console.error("[FAIL] Could not resolve all three product IDs. single=" + single + " channel=" + channel + " pro=" + pro);
    process.exit(1);
  }

  env.DODO_PAYMENTS_PRODUCT_ID_SINGLE = single;
  env.DODO_PAYMENTS_PRODUCT_ID_CHANNEL = channel;
  env.DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION = pro;
  env.DODO_PAYMENTS_MODE = "test_mode";
  saveEnv(envPath, env);
  console.log("[OK] .env.local updated:");
  console.log("  DODO_PAYMENTS_PRODUCT_ID_SINGLE=" + single);
  console.log("  DODO_PAYMENTS_PRODUCT_ID_CHANNEL=" + channel);
  console.log("  DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION=" + pro);
  console.log("  DODO_PAYMENTS_MODE=test_mode");
  console.log("[DONE]");
}

main().catch((e) => { console.error("[FATAL]", e.message); process.exit(1); });