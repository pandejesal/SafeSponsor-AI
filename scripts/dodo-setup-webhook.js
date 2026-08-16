// dodo-setup-webhook.js — one-off ops script: create the test-mode webhook
// endpoint on the Dodo account (pointing at the deployed app's /api/webhook
// route), fetch its signing secret, and wire DODO_PAYMENTS_WEBHOOK_SECRET into
// .env.local. The filter list mirrors ALLOWED_WEBHOOK_EVENTS in
// app/api/webhook/route.ts.
// Run: node scripts/dodo-setup-webhook.js
const fs = require("fs");
const path = require("path");

const BASE = "https://test.dodopayments.com";
const WEBHOOK_URL = "https://safe-sponsor-ai.vercel.app/api/webhook";
const FILTER_TYPES = [
  "payment.succeeded",
  "subscription.active",
  "subscription.renewed",
  "subscription.cancelled",
  "subscription.expired",
  "refund.succeeded",
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

async function api(key, method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(method + " " + p + " status=" + res.status + " body=" + text.slice(0, 300));
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

  const existing = await api(key, "GET", "/webhooks");
  const list = Array.isArray(existing) ? existing : (existing.items || []);
  const match = list.find((w) => w.url === WEBHOOK_URL);
  let webhookId;
  if (match) {
    webhookId = match.id;
    console.log("[SKIP] Webhook endpoint exists (id=" + webhookId + " url=" + WEBHOOK_URL + ")");
  } else {
    const created = await api(key, "POST", "/webhooks", {
      url: WEBHOOK_URL,
      description: "SafeSponsor AI payments (test mode)",
      filter_types: FILTER_TYPES,
    });
    webhookId = created.id;
    console.log("[OK] Webhook endpoint created id=" + webhookId + " url=" + WEBHOOK_URL);
    console.log("     filter_types=" + JSON.stringify(created.filter_types));
  }

  const secretRes = await api(key, "GET", "/webhooks/" + webhookId + "/secret");
  const secret = secretRes.secret;
  if (!secret) {
    console.error("[FAIL] No signing secret returned for webhook " + webhookId);
    process.exit(1);
  }

  env.DODO_PAYMENTS_WEBHOOK_SECRET = secret;
  saveEnv(envPath, env);
  console.log("[OK] .env.local updated: DODO_PAYMENTS_WEBHOOK_SECRET=<" + secret.length + " chars>");
  console.log("[DONE]");
}

main().catch((e) => { console.error("[FATAL]", e.message); process.exit(1); });