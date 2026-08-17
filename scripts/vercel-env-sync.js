// vercel-env-sync.js — replace the 6 Dodo env vars in Vercel Production with
// the values from .env.local. Requires `vercel` CLI installed + linked
// (vercel link --project safe-sponsor-ai --yes).
// Run: node scripts/vercel-env-sync.js
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const KEYS = [
  "DODO_PAYMENTS_API_KEY",
  "DODO_PAYMENTS_MODE",
  "DODO_PAYMENTS_PRODUCT_ID_SINGLE",
  "DODO_PAYMENTS_PRODUCT_ID_CHANNEL",
  "DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION",
  "DODO_PAYMENTS_WEBHOOK_SECRET",
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

function vercel(args, input) {
  const r = spawnSync("vercel", args, {
    input,
    encoding: "utf8",
    timeout: 120000,
    shell: true,
  });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim() };
}

function main() {
  const target = process.env.SYNC_TARGET || "production";
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  const missing = KEYS.filter((k) => !env[k] || env[k] === "[SENSITIVE]");
  if (missing.length) {
    console.error("[FAIL] Missing/redacted in .env.local: " + missing.join(", "));
    process.exit(1);
  }

  for (const key of KEYS) {
    const rm = vercel(["env", "rm", key, target, "--yes"]);
    console.log("[rm] " + key + " (" + target + ") -> " + (rm.status === 0 ? "removed" : "not present (" + (rm.status || "?") + ")"));
    const add = vercel(["env", "add", key, target], env[key] + "\n");
    if (add.status !== 0) {
      console.error("[FAIL] " + key + " add failed: " + add.stderr + " " + add.stdout);
      process.exit(1);
    }
    console.log("[ok] " + key + " = <" + env[key].length + " chars> added");
  }
  console.log("[DONE]");
}

main();