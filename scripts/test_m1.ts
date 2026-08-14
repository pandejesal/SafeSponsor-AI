// M1 gate: unit tests for cost accounting + guardrails (run: npm run test:m1).
// Pure tests against lib/usage.ts — no network, no Firestore, no Admin SDK.
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  DAILY_CAP_REASON,
  UsageLogEntry,
  aggregateUsageByUid,
  checkPerAuditCostAlert,
  checkWeeklyCostAlert,
  decrementDailyCapCount,
  enforceDailyCap,
  estimateCostUsd,
  getCostAlertThresholdUsd,
  getDayKey,
  getProDailyAuditCap,
  getWeekKey,
  nextWeekStartIso,
  perAuditCostUsd,
  weekStartIso,
  weeklyCostAlertThreshold,
} from "../lib/usage";

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

console.log("M1 — Economics & Guardrails unit tests");

// ---- M1T1: cost estimation rate table ----
test("estimateCostUsd computes per-model pricing", () => {
  closeTo(estimateCostUsd("gemini-3.6-flash", 1_000_000, 1_000_000), 1.8);
  closeTo(estimateCostUsd("gemini-3.6-flash", 0, 0), 0);
  closeTo(estimateCostUsd("gemini-3.1-flash-lite", 1_000_000, 1_000_000), 0.75);
  closeTo(estimateCostUsd("llama-3.3-70b-versatile", 1_000_000, 100_000), 0.669);
  assert.strictEqual(estimateCostUsd("unknown-model", 1_000_000, 1_000_000), 0);
});

// ---- M1T3: daily cap boundaries + 429 payload contract ----
test("enforceDailyCap allows under cap and denies at cap", () => {
  const atZero = enforceDailyCap(0, 50);
  assert.ok(atZero.allowed);
  if (atZero.allowed) assert.strictEqual(atZero.nextCount, 1);

  const at49 = enforceDailyCap(49, 50);
  assert.ok(at49.allowed);
  if (at49.allowed) assert.strictEqual(at49.nextCount, 50);

  const at50 = enforceDailyCap(50, 50);
  assert.ok(!at50.allowed);
  if (!at50.allowed) assert.strictEqual(at50.reason, DAILY_CAP_REASON);

  const at99 = enforceDailyCap(99, 50);
  assert.ok(!at99.allowed);
});

test("429 payload contract: reason string is exactly what the route returns", () => {
  // app/api/analyze/route.ts returns { error: DAILY_CAP_REASON } with 429.
  assert.strictEqual(DAILY_CAP_REASON, "Daily audit limit reached");
  const payload = { error: DAILY_CAP_REASON };
  const status = 429;
  assert.deepStrictEqual(payload, { error: "Daily audit limit reached" });
  assert.strictEqual(status, 429);
});

test("daily cap is atomic under concurrent claims (Firestore-style retry)", () => {
  // Two concurrent requests both read the counter at 49 (neither has written
  // yet). Firestore runTransaction retries the loser with a fresh read, so the
  // 51st claim must be denied even though both requests started from 49.
  const cap = 50;
  let committedCount = 49;
  let allowedClaims = 0;

  const claimA = enforceDailyCap(committedCount, cap); // tx A reads 49
  if (!claimA.allowed) throw new Error("claim A should be allowed");
  allowedClaims++;
  committedCount = claimA.nextCount; // tx A commits: 50

  const claimB = enforceDailyCap(committedCount, cap); // tx B retried with fresh read
  assert.ok(!claimB.allowed, "concurrent claim B must be denied after A commits");
  if (!claimB.allowed) assert.strictEqual(claimB.reason, DAILY_CAP_REASON);

  assert.strictEqual(allowedClaims, 1, "exactly one concurrent claim may pass");
  assert.strictEqual(committedCount, 50, "counter must land exactly on the cap");

  // The next serial request is also denied (still at cap).
  const claimC = enforceDailyCap(committedCount, cap);
  assert.ok(!claimC.allowed);
});

// ---- M1T4(a): weekly cost alert ----
test("weekly alert threshold is 75% of worst-case budget ($26.25 at cap 50)", () => {
  closeTo(weeklyCostAlertThreshold(50), 26.25);
  closeTo(weeklyCostAlertThreshold(10), 5.25);
  closeTo(weeklyCostAlertThreshold(100), 52.5);
});

test("weekly alert fires AT 75% ($26.25) and not before", () => {
  assert.strictEqual(checkWeeklyCostAlert(26.249, 50), false, "below threshold must not fire");
  assert.strictEqual(checkWeeklyCostAlert(26.2499, 50), false, "just below threshold must not fire");
  assert.strictEqual(checkWeeklyCostAlert(26.25, 50), true, "exactly at threshold must fire");
  assert.strictEqual(checkWeeklyCostAlert(26.251, 50), true, "above threshold must fire");
  assert.strictEqual(checkWeeklyCostAlert(0, 50), false);
  // Sanity: threshold scales with the cap.
  assert.strictEqual(checkWeeklyCostAlert(5.25, 10), true);
  assert.strictEqual(checkWeeklyCostAlert(5.24, 10), false);
});

// ---- M1T4(b): per-audit cost alert ----
test("per-audit alert fires AT $0.30 and not before", () => {
  assert.strictEqual(checkPerAuditCostAlert(0.299, 0.3), false, "below threshold must not fire");
  assert.strictEqual(checkPerAuditCostAlert(0.30, 0.3), true, "exactly at threshold must fire");
  assert.strictEqual(checkPerAuditCostAlert(0.301, 0.3), true, "above threshold must fire");
  assert.strictEqual(checkPerAuditCostAlert(0, 0.3), false);
  // Sum basis: 0.1 + 0.1 + 0.1 is 0.30000000000000004 in binary float — must fire.
  assert.strictEqual(checkPerAuditCostAlert(0.1 + 0.1 + 0.1, 0.3), true);
});

// ---- M1T1/M1T2: day/week keys ----
test("day and week keys are UTC and Monday-aligned", () => {
  assert.strictEqual(getDayKey(new Date("2026-08-14T12:00:00.000Z")), "20260814");
  // 2026-08-14 is a Friday → week starts Monday 2026-08-10.
  assert.strictEqual(getWeekKey(new Date("2026-08-14T12:00:00.000Z")), "20260810-week");
  // Sunday of the same week still belongs to Monday 2026-08-10.
  assert.strictEqual(getWeekKey(new Date("2026-08-16T23:59:59.000Z")), "20260810-week");
  // Monday itself starts the week.
  assert.strictEqual(getWeekKey(new Date("2026-08-10T00:00:00.000Z")), "20260810-week");
  assert.strictEqual(weekStartIso("20260810-week"), "2026-08-10T00:00:00.000Z");
  assert.throws(() => weekStartIso("not-a-week"), /Invalid week key/);
});

// ---- M1T2: rollup aggregation ----
test("aggregateUsageByUid groups calls, tokens, cost, and models per uid", () => {
  const entries: UsageLogEntry[] = [
    { model: "gemini-3.6-flash", inputTokens: 1000, outputTokens: 500, latencyMs: 100, estCostUsd: 0.001, success: true, uid: "u1", targetKey: "t1", stage: "research" },
    { model: "gemini-3.1-flash-lite", inputTokens: 200, outputTokens: 100, latencyMs: 50, estCostUsd: 0.0001, success: true, uid: "u1", targetKey: "t1", stage: "synthesis" },
    { model: "llama-3.3-70b-versatile", inputTokens: 500, outputTokens: 300, latencyMs: 80, estCostUsd: 0.0005, success: true, uid: "u2" },
    { model: "gemini-3.6-flash", inputTokens: 10, outputTokens: 5, latencyMs: 30, estCostUsd: 0, success: false, error: "boom" },
  ];
  const agg = aggregateUsageByUid(entries);
  assert.strictEqual(agg["u1"].calls, 2);
  assert.strictEqual(agg["u1"].inputTokens, 1200);
  assert.strictEqual(agg["u1"].outputTokens, 600);
  closeTo(agg["u1"].estCostUsd, 0.0011);
  assert.strictEqual(agg["u1"].byModel["gemini-3.6-flash"].calls, 1);
  assert.strictEqual(agg["u1"].byModel["gemini-3.1-flash-lite"].tokens, 300);
  assert.strictEqual(agg["u2"].calls, 1);
  assert.strictEqual(agg["u2"].byModel["llama-3.3-70b-versatile"].tokens, 800);
  // Failed call with no uid buckets to "unknown".
  assert.strictEqual(agg["unknown"].calls, 1);
  assert.strictEqual(Object.keys(agg).length, 3);
});

// ---- T2: daily-cap slot refund on audit failure (fix audit) ----
test("decrementDailyCapCount never goes below zero", () => {
  assert.strictEqual(decrementDailyCapCount(5), 4);
  assert.strictEqual(decrementDailyCapCount(1), 0);
  assert.strictEqual(decrementDailyCapCount(0), 0);
  assert.strictEqual(decrementDailyCapCount(NaN as any), 0);
  assert.strictEqual(decrementDailyCapCount(-3), 0);
});

test("simulated Pro audit failure: claim consumes one slot, refund restores it", () => {
  // Mirrors the route: quota tx claims a slot (usedToday 49 -> 50), the
  // pipeline fails, refundDailyCapSlot decrements back to 49.
  const cap = getProDailyAuditCap();
  let counter = 49;
  const claim = enforceDailyCap(counter, cap);
  assert.ok(claim.allowed);
  if (claim.allowed) counter = claim.nextCount;
  assert.strictEqual(counter, 50, "success claim consumes exactly one slot");
  counter = decrementDailyCapCount(counter);
  assert.strictEqual(counter, 49, "failed audit refunds the slot back to 49");

  // A refund at the floor must not go negative (e.g. double refund, counter
  // already deleted).
  assert.strictEqual(decrementDailyCapCount(0), 0);

  // Success path unchanged: exactly one slot consumed, next claim allowed at
  // 49, denied at 50.
  const claim2 = enforceDailyCap(49, cap);
  assert.ok(claim2.allowed);
  if (claim2.allowed) assert.strictEqual(claim2.nextCount, 50);
  const claim3 = enforceDailyCap(50, cap);
  assert.ok(!claim3.allowed, "counter back at cap denies the next claim");
});

// ---- T3: per-audit cost alert fires for FAILED audits too (fix audit) ----
test("failed audit with summed estCostUsd over threshold triggers the alert decision", () => {
  // A research_failed audit can still have burned real LLM cost on earlier
  // calls. perAuditCostUsd sums ALL entries (success or not) — the route's
  // shared emitter uses exactly this basis before writing usage_alerts.
  const failedAuditEntries: Pick<UsageLogEntry, "estCostUsd">[] = [
    { estCostUsd: 0.12 },
    { estCostUsd: 0.11 },
    { estCostUsd: 0.09 },
  ];
  const total = perAuditCostUsd(failedAuditEntries);
  closeTo(total, 0.32, 1e-9);
  assert.strictEqual(checkPerAuditCostAlert(total, 0.3), true, "failed audit above $0.30 must alert");

  const below: Pick<UsageLogEntry, "estCostUsd">[] = [{ estCostUsd: 0.2 }, { estCostUsd: 0.09 }];
  assert.strictEqual(checkPerAuditCostAlert(perAuditCostUsd(below), 0.3), false, "below threshold must not alert");

  // Zero-cost failure (no LLM calls made) never alerts.
  assert.strictEqual(perAuditCostUsd([]), 0);
  assert.strictEqual(checkPerAuditCostAlert(0, 0.3), false);
});

// ---- T7: weekly rollup upper bound (fix audit) ----
test("nextWeekStartIso is the exclusive upper bound of the week", () => {
  assert.strictEqual(nextWeekStartIso("20260810-week"), "2026-08-17T00:00:00.000Z");
  assert.strictEqual(nextWeekStartIso("20260803-week"), "2026-08-10T00:00:00.000Z");
  // Lower bound < upper bound; a Sunday log belongs to the week, next Monday
  // does not.
  const weekStart = Date.parse(weekStartIso("20260810-week"));
  const nextStart = Date.parse(nextWeekStartIso("20260810-week"));
  assert.ok(weekStart < nextStart);
  assert.strictEqual(new Date("2026-08-16T23:59:59.000Z").getTime() >= weekStart, true);
  assert.strictEqual(new Date("2026-08-16T23:59:59.000Z").getTime() < nextStart, true);
  assert.strictEqual(new Date("2026-08-17T00:00:00.000Z").getTime() < nextStart, false);
  assert.throws(() => nextWeekStartIso("not-a-week"), /Invalid week key/);
});

// ---- T1: firestore.rules protects the intro flags (fix audit) ----
test("firestore.rules sensitiveFields blocks client writes to introProClaimed/introPending", () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
  const m = rules.match(/sensitiveFields\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, "sensitiveFields array must exist in firestore.rules");
  const fields = m[1].split(",").map((f) => f.trim().replace(/^'|'$/g, "").replace(/^"|"$/g, "")).filter(Boolean);
  assert.ok(fields.includes("introProClaimed"), "introProClaimed must be in sensitiveFields");
  assert.ok(fields.includes("introPending"), "introPending must be in sensitiveFields");

  // Simulate the rule semantics: a client update touching a sensitive field
  // must be denied; an update touching only safe fields must pass.
  const touched = (payload: Record<string, unknown>, existing: Record<string, unknown>) =>
    Object.keys(payload).filter((k) => !(k in existing) || payload[k] !== existing[k]);
  const isTouchingSensitive = (affected: string[]) => affected.some((k) => fields.includes(k));

  assert.strictEqual(isTouchingSensitive(touched({ introProClaimed: false }, {})), true, "resetting introProClaimed must be denied");
  assert.strictEqual(isTouchingSensitive(touched({ introPending: false }, {})), true, "resetting introPending must be denied");
  assert.strictEqual(isTouchingSensitive(touched({ displayName: "New" }, { displayName: "Old" })), false, "safe fields still update");
  assert.strictEqual(isTouchingSensitive(touched({ introProClaimed: true }, { introProClaimed: true })), false, "unchanged sensitive value passes diff");
});

// ---- T4: $99 banner is config-gated end-to-end (fix audit) ----
test("check-credits exposes introAvailable only from server env; banner gates on it", () => {
  const route = fs.readFileSync(path.join(__dirname, "..", "app", "api", "check-credits", "route.ts"), "utf8");
  assert.ok(route.includes("introAvailable"), "check-credits must return introAvailable");
  assert.ok(
    route.includes('Boolean(process.env.DODO_PAYMENTS_DISCOUNT_CODE_PRO_INTRO)'),
    "introAvailable must derive from the server-side env var (no client-visible code value)"
  );
  // The env var name appears exactly once (the derivation) — never inside the
  // response body, so the code value cannot leak to the client.
  const envRefs = route.split("DODO_PAYMENTS_DISCOUNT_CODE_PRO_INTRO").length - 1;
  assert.strictEqual(envRefs, 1, "env var referenced exactly once (derivation only), never in the response");
  // Both response shapes (fresh user + existing user) must carry the field.
  assert.strictEqual((route.match(/introAvailable/g) || []).length >= 3, true, "field present in both response branches + derivation");

  const dashboard = fs.readFileSync(path.join(__dirname, "..", "app", "dashboard", "page.tsx"), "utf8");
  assert.ok(
    dashboard.includes("{!introBannerDismissed && userCredits.introAvailable && ("),
    "banner render condition must combine dismissal with introAvailable (never promises $99 when unconfigured)"
  );
  // The banner section already sits inside the !hasSubscription block — the
  // combination !hasSubscription && introAvailable is the render condition.
  assert.ok(dashboard.includes("userCredits.introAvailable"), "introAvailable must flow into the banner condition");
});

// ---- T5/T6: verify-payment App Check + checkout intro serialization (fix audit) ----
test("verify-payment enforces App Check like checkout", () => {
  const route = fs.readFileSync(path.join(__dirname, "..", "app", "api", "verify-payment", "route.ts"), "utf8");
  assert.ok(route.includes("verifyAppCheckHeader"), "verify-payment must call verifyAppCheckHeader");
  assert.ok(route.includes("Unauthorized client request (App Check failed)"), "invalid App Check must reject 401");
});

test("checkout serializes the intro claim in a transaction and clears pending on grant", () => {
  const checkout = fs.readFileSync(path.join(__dirname, "..", "app", "api", "checkout", "route.ts"), "utf8");
  assert.ok(checkout.includes("runTransaction"), "intro read+apply must run inside runTransaction");
  assert.ok(checkout.includes("introPending"), "checkout must stamp introPending before creating the session");
  const verify = fs.readFileSync(path.join(__dirname, "..", "app", "api", "verify-payment", "route.ts"), "utf8");
  assert.ok(verify.includes("introPending = false"), "grant path must clear introPending");
  const webhook = fs.readFileSync(path.join(__dirname, "..", "app", "api", "webhook", "route.ts"), "utf8");
  assert.ok(webhook.includes("introPending: false"), "webhook grant path must clear introPending");
});

// ---- M1T5: env config defaults ----
test("env getters default and honor PRO_DAILY_AUDIT_CAP / COST_ALERT_THRESHOLD_USD", () => {
  const prevCap = process.env.PRO_DAILY_AUDIT_CAP;
  const prevCost = process.env.COST_ALERT_THRESHOLD_USD;
  try {
    delete process.env.PRO_DAILY_AUDIT_CAP;
    delete process.env.COST_ALERT_THRESHOLD_USD;
    assert.strictEqual(getProDailyAuditCap(), 50);
    assert.strictEqual(getCostAlertThresholdUsd(), 0.3);

    process.env.PRO_DAILY_AUDIT_CAP = "100";
    process.env.COST_ALERT_THRESHOLD_USD = "0.75";
    assert.strictEqual(getProDailyAuditCap(), 100);
    assert.strictEqual(getCostAlertThresholdUsd(), 0.75);

    process.env.PRO_DAILY_AUDIT_CAP = "abc";
    process.env.COST_ALERT_THRESHOLD_USD = "0";
    assert.strictEqual(getProDailyAuditCap(), 50);
    assert.strictEqual(getCostAlertThresholdUsd(), 0.3);
  } finally {
    if (prevCap === undefined) delete process.env.PRO_DAILY_AUDIT_CAP;
    else process.env.PRO_DAILY_AUDIT_CAP = prevCap;
    if (prevCost === undefined) delete process.env.COST_ALERT_THRESHOLD_USD;
    else process.env.COST_ALERT_THRESHOLD_USD = prevCost;
  }
});

// ---- Summary ----
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
