// dodo-probe.js — one-off ops script: verify the Dodo Payments API key in
// .env.local and list products on the merchant account. Prints product
// metadata only — never the key.
// Run: node scripts/dodo-probe.js
const fs = require("fs");
const path = require("path");

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

async function probe(base, bearer) {
  const res = await fetch(base + "/products?limit=100", {
    headers: { Authorization: "Bearer " + bearer, Accept: "application/json" },
  });
  const body = await res.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* not json */ }
  return { status: res.status, json, rawHead: body.slice(0, 300) };
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  const key = env.DODO_PAYMENTS_API_KEY;
  if (!key || key === "[SENSITIVE]") {
    console.error("[FAIL] DODO_PAYMENTS_API_KEY missing or redacted in .env.local");
    process.exit(1);
  }
  console.log("[INFO] Key loaded from .env.local (len " + key.length + ").");

  const bases = [
    { name: "test", url: "https://test.dodopayments.com" },
    { name: "live", url: "https://live.dodopayments.com" },
  ];
  let r = null;
  let usedBase = null;
  for (const b of bases) {
    console.log("[INFO] Probing " + b.name + ": " + b.url + "/products ...");
    r = await probe(b.url, key);
    console.log("[RESULT] " + b.name + " status=" + r.status);
    if (r.status === 200) { usedBase = b; break; }
    if (r.status === 401 || r.status === 403) {
      console.log("[WARN] " + b.name + " rejected raw key; retrying with 'key_' prefix...");
      r = await probe(b.url, "key_" + key);
      console.log("[RESULT] " + b.name + " key_-prefixed status=" + r.status);
      if (r.status === 200) { usedBase = b; break; }
    }
  }

  if (!usedBase || r.status !== 200) {
    console.log("[FAIL] API auth/scope failed on both environments. Last raw head: " + (r && r.rawHead));
    process.exit(1);
  }

  console.log("[OK] Products endpoint accessible (" + usedBase.name + ").");
  const items = r.json && (r.json.items || r.json.data || []);
  console.log("[OK] Count=" + items.length);
  for (const p of items) {
    console.log(
      "- id=" + (p.product_id || p.id || "?") +
      " | name=" + JSON.stringify(p.name || null) +
      " | price=" + (p.price && p.price.price) +
      " | currency=" + (p.price && p.price.currency) +
      " | type=" + (p.price && p.price.type || "?") +
      " | recurring=" + JSON.stringify(p.price && p.price.payment_frequency_interval || null) +
      " | status=" + (p.status || "?")
    );
  }
  console.log("[DONE]");
}

main().catch((e) => { console.error("[FATAL]", e.message); process.exit(1); });