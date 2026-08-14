// M4 gate: unit tests for the data lifecycle (run: npm run test:m4).
// Pure tests against lib/lifecycle.ts + lib/utils.ts — no network, no
// Firestore, no Admin SDK (same pattern as scripts/test_m1.ts).
import assert from "node:assert/strict";
import {
  CACHE_HARD_TTL_MS,
  CACHE_REFRESH_COOLDOWN_MS,
  CACHE_SOFT_TTL_MS,
  TAKEDOWN_SLA_MS,
  computeTtlStamps,
  evaluateCacheTtl,
  shouldSkipGlobalCacheWrite,
  slaDeadlineIso,
} from "../lib/lifecycle";
import { scrubPii, scrubPiiDeep } from "../lib/utils";

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (err: any) {
    failures.push(`${name}: ${err?.message || err}`);
    console.error(`  FAIL ${name}: ${err?.message || err}`);
  }
}

const closeTo = (actual: number, expected: number, eps = 1e-9) => {
  assert.ok(Math.abs(actual - expected) < eps, `expected ${actual} ~= ${expected}`);
};

const DAY_MS = 24 * 60 * 60 * 1000;

console.log("M4 — Data Lifecycle unit tests");

// ---- M4T5: PII scrubbing ----

test("scrubPii redacts emails", () => {
  const out = scrubPii("Contact: john.doe@example.com or jane@sub.domain.co");
  assert.ok(!out.includes("john.doe@example.com"), "email survived");
  assert.ok(!out.includes("jane@sub.domain.co"), "second email survived");
  assert.ok(out.includes("[REDACTED EMAIL]"));
});

test("scrubPii redacts phone numbers (plain, dashed, parenthesized, +prefix)", () => {
  const inputs = [
    "call 555-123-4567 now",
    "call (555) 123-4567 now",
    "call +1 555 123 4567 now",
    "reach 555.123.4567 today",
  ];
  for (const input of inputs) {
    const out = scrubPii(input);
    assert.ok(out.includes("[REDACTED PHONE]"), `no redaction for: ${input}`);
  }
});

test("scrubPii redacts street addresses", () => {
  const out = scrubPii("Office at 1234 Market Street, suite 9");
  assert.ok(!out.includes("Market Street"), "address survived");
  assert.ok(out.includes("[REDACTED ADDRESS]"));
});

test("scrubPii leaves ordinary text intact", () => {
  const out = scrubPii("This is a completely normal sentence with 3 items and no PII.");
  assert.strictEqual(out, "This is a completely normal sentence with 3 items and no PII.");
});

test("scrubPiiDeep walks nested objects and arrays", () => {
  const doc = {
    creator: {
      name: "Test Creator",
      contact: "reach me at bob@example.com",
      socials: [{ url: "https://youtube.com/@test", phone: "555-123-4567" }],
    },
    score: 42,
    tags: ["safe", "note: live at 5 Oak Avenue"],
  };
  const out = scrubPiiDeep(doc) as typeof doc;
  assert.ok(!JSON.stringify(out).includes("bob@example.com"));
  assert.ok(!JSON.stringify(out).includes("555-123-4567"));
  assert.ok(!JSON.stringify(out).includes("Oak Avenue"));
  assert.strictEqual(out.score, 42);
  assert.strictEqual(out.tags[0], "safe");
});

// ---- M4T1: TTL tiers ----

test("computeTtlStamps produces 90d soft and 180d hard stamps", () => {
  const now = 1_700_000_000_000;
  const stamps = computeTtlStamps(now);
  const soft = new Date(stamps.cacheExpiresAt).getTime();
  const hard = new Date(stamps.hardExpiresAt).getTime();
  closeTo(soft - now, CACHE_SOFT_TTL_MS);
  closeTo(hard - now, CACHE_HARD_TTL_MS);
});

test("evaluateCacheTtl: missing doc is a miss", () => {
  const r = evaluateCacheTtl(null, Date.now());
  assert.strictEqual(r.state, "missing");
  assert.strictEqual(r.needsBackfill, false);
});

test("evaluateCacheTtl: stamped fresh doc is fresh", () => {
  const now = 1_700_000_000_000;
  const r = evaluateCacheTtl(
    { report: {}, ...computeTtlStamps(now - 1000) },
    now
  );
  assert.strictEqual(r.state, "fresh");
  assert.strictEqual(r.needsBackfill, false);
  closeTo(r.softExpiresAtMs, now - 1000 + CACHE_SOFT_TTL_MS, 10);
});

test("evaluateCacheTtl: soft expiry is detected inside the hard window", () => {
  const now = 1_700_000_000_000;
  // Written 100 days ago: past the 90d soft tier, inside the 180d hard tier.
  const r = evaluateCacheTtl(
    { report: {}, ...computeTtlStamps(now - 100 * DAY_MS) },
    now
  );
  assert.strictEqual(r.state, "soft_expired");
});

test("evaluateCacheTtl: hard expiry is a miss", () => {
  const now = 1_700_000_000_000;
  // Written 200 days ago: past the 180d hard tier.
  const r = evaluateCacheTtl(
    { report: {}, ...computeTtlStamps(now - 200 * DAY_MS) },
    now
  );
  assert.strictEqual(r.state, "hard_expired");
});

test("evaluateCacheTtl: unstamped doc backfills from updatedAt", () => {
  const now = 1_700_000_000_000;
  const r = evaluateCacheTtl(
    { report: {}, updatedAt: new Date(now - 10 * DAY_MS).toISOString() },
    now
  );
  assert.strictEqual(r.state, "fresh");
  assert.strictEqual(r.needsBackfill, true);
  closeTo(r.softExpiresAtMs, now - 10 * DAY_MS + CACHE_SOFT_TTL_MS, 10);
});

test("evaluateCacheTtl: unstamped doc without timestamps still serves (legacy)", () => {
  const r = evaluateCacheTtl({ report: {} }, Date.now());
  assert.strictEqual(r.state, "fresh");
  assert.strictEqual(r.needsBackfill, true);
});

// ---- M4T1: cache-poisoning guard (extracted from the route) ----

const makeReport = (score: number, risk: string) => ({
  report: { brand_safety_score: score, risk_level: risk },
});

test("guard: writes through when no existing cache", () => {
  assert.strictEqual(shouldSkipGlobalCacheWrite(null, { brand_safety_score: 10, risk_level: "High" }), false);
  assert.strictEqual(shouldSkipGlobalCacheWrite(undefined, { brand_safety_score: 10, risk_level: "High" }), false);
});

test("guard: skips when incoming is worse", () => {
  assert.strictEqual(shouldSkipGlobalCacheWrite(makeReport(80, "Low"), { brand_safety_score: 40, risk_level: "High" }), true);
});

test("guard: skips when incoming is equal", () => {
  assert.strictEqual(shouldSkipGlobalCacheWrite(makeReport(80, "Low"), { brand_safety_score: 80, risk_level: "Low" }), true);
});

test("guard: skips on material score drop even at same risk", () => {
  assert.strictEqual(shouldSkipGlobalCacheWrite(makeReport(90, "Medium"), { brand_safety_score: 70, risk_level: "Medium" }), true);
});

test("guard: skips when incoming is materially more favorable (poison protection)", () => {
  // A +15 jump or a risk downgrade is exactly the suspicious pattern the guard
  // refuses to write over an existing cache with.
  assert.strictEqual(shouldSkipGlobalCacheWrite(makeReport(50, "High"), { brand_safety_score: 80, risk_level: "Low" }), true);
  assert.strictEqual(shouldSkipGlobalCacheWrite(makeReport(50, "High"), { brand_safety_score: 70, risk_level: "Low" }), true);
});

test("guard: writes through for modest improvement", () => {
  // +10 is not "materially more favorable" (+15) and risk is unchanged.
  assert.strictEqual(shouldSkipGlobalCacheWrite(makeReport(70, "Medium"), { brand_safety_score: 80, risk_level: "Medium" }), false);
});

// ---- M4T2: takedown SLA ----

test("slaDeadlineIso is 48h after submission", () => {
  const now = 1_700_000_000_000;
  const deadline = new Date(slaDeadlineIso(now)).getTime();
  closeTo(deadline - now, TAKEDOWN_SLA_MS);
});

// ---- constants sanity ----

test("cooldown constant sanity", () => {
  assert.strictEqual(CACHE_REFRESH_COOLDOWN_MS, 15 * 60 * 1000);
});

console.log(`\nM4 results: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("Failures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
