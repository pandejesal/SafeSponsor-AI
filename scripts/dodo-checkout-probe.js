// dodo-checkout-probe.js — verify a checkout session can be created with the
// products wired into .env.local (mirrors app/api/checkout/route.ts).
// Run: node scripts/dodo-checkout-probe.js
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

async function main() {
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  const key = env.DODO_PAYMENTS_API_KEY;
  const productId = env.DODO_PAYMENTS_PRODUCT_ID_SINGLE;
  if (!key || key === "[SENSITIVE]" || !productId || productId === "[SENSITIVE]") {
    console.error("[FAIL] Key or product ID missing/redacted in .env.local");
    process.exit(1);
  }
  const base = env.DODO_PAYMENTS_MODE === "live" || env.DODO_PAYMENTS_MODE === "live_mode"
    ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

  const res = await fetch(base + "/checkouts", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: "e2e-probe@example.com" },
      return_url: "https://safe-sponsor-ai.vercel.app/dashboard?dodo_success=true&plan=single",
    }),
  });
  const body = await res.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* not json */ }
  console.log("[RESULT] checkout create status=" + res.status);
  if (res.ok && json) {
    console.log("[OK] checkout_id=" + (json.checkout_id || "?"));
    console.log("[OK] checkout_url=" + (json.checkout_url || json.payment_link || json.url || "?"));
  } else {
    console.log("[FAIL] " + body.slice(0, 300));
    process.exit(1);
  }
  console.log("[DONE]");
}

main().catch((e) => { console.error("[FATAL]", e.message); process.exit(1); });