// Usage instrumentation & cost accounting helpers (M1 — Economics & Guardrails).
// PURE module: no Firestore/Admin SDK imports, so scripts/test_m1.ts can unit
// test the cap + alert thresholds without initializing Firebase.

export interface UsageLogEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estCostUsd: number;
  success: boolean;
  uid?: string;
  targetKey?: string;
  stage?: string;
  error?: string;
  attempt?: number;
}

// Approximate per-1M-token list prices in USD. Kept as a constant rate table so
// cost accounting is deterministic; update when provider pricing changes.
export const MODEL_RATE_TABLE: Record<string, { inputUsdPerMToken: number; outputUsdPerMToken: number }> = {
  "gemini-3.6-flash": { inputUsdPerMToken: 0.3, outputUsdPerMToken: 1.5 },
  "gemini-3.5-flash": { inputUsdPerMToken: 0.3, outputUsdPerMToken: 1.5 },
  "gemini-3.1-flash-lite": { inputUsdPerMToken: 0.15, outputUsdPerMToken: 0.6 },
  "llama-3.3-70b-versatile": { inputUsdPerMToken: 0.59, outputUsdPerMToken: 0.79 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_RATE_TABLE[model];
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.inputUsdPerMToken + (outputTokens / 1_000_000) * rate.outputUsdPerMToken;
}

// UTC day key "yyyymmdd" — used for the per-user daily audit counter doc id.
export function getDayKey(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// Monday-start week key, e.g. "20260810-week" for any day in that week.
export function getWeekKey(date: Date): string {
  const d = new Date(date.toISOString());
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return getDayKey(d) + "-week";
}

export function weekStartIso(weekKey: string): string {
  const m = weekKey.match(/^(\d{4})(\d{2})(\d{2})-week$/);
  if (!m) throw new Error(`Invalid week key: ${weekKey}`);
  return `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
}

// Exclusive upper bound of a week — used to bound the rollup query so
// future-dated logs (client clock skew, bad NTP) never inflate the current
// week. nextWeekStartIso("20260810-week") = "2026-08-17T00:00:00.000Z".
export function nextWeekStartIso(weekKey: string): string {
  return new Date(Date.parse(weekStartIso(weekKey)) + 7 * 24 * 60 * 60 * 1000).toISOString();
}

// Refund half of a daily-cap claim: the analyze route increments
// usage_daily/{uid}_{day} when a Pro audit starts, and decrements it (never
// below 0) when the audit fails — failed audits must not burn a cap slot.
export function decrementDailyCapCount(currentCount: number): number {
  const n = Number.isFinite(currentCount) ? currentCount : 0;
  return Math.max(0, Math.floor(n) - 1);
}

// Exact 429 message the analyze route returns when a Pro user hits the cap.
export const DAILY_CAP_REASON = "Daily audit limit reached";

export function enforceDailyCap(
  usedToday: number,
  cap: number
): { allowed: true; nextCount: number } | { allowed: false; reason: string } {
  if (usedToday >= cap) return { allowed: false, reason: DAILY_CAP_REASON };
  return { allowed: true, nextCount: usedToday + 1 };
}

// 75% of worst-case budget: cap audits/day × 7 days × $0.10 worst-case per audit.
export function weeklyCostAlertThreshold(proDailyCap: number): number {
  return 0.75 * proDailyCap * 7 * 0.1;
}

// Fires at exactly the threshold (>=), not before. EPSILON absorbs binary
// float error (e.g. 0.75*50*7*0.1 computes to 26.250000000000004) so a spend
// of exactly $26.25 still triggers while $26.2499 does not.
const COST_EPSILON_USD = 1e-9;

export function checkWeeklyCostAlert(weeklyTotalUsd: number, proDailyCap: number): boolean {
  return weeklyTotalUsd >= weeklyCostAlertThreshold(proDailyCap) - COST_EPSILON_USD;
}

export function checkPerAuditCostAlert(totalEstUsd: number, thresholdUsd: number): boolean {
  return totalEstUsd >= thresholdUsd;
}

// Per-audit cost basis (M1T4b): sum of estCostUsd across every LLM call of
// ONE audit — including calls from audits that later failed, since failed
// calls can still have burned real money.
export function perAuditCostUsd(entries: Pick<UsageLogEntry, "estCostUsd">[]): number {
  return entries.reduce((sum, e) => sum + (e.estCostUsd || 0), 0);
}

export interface UidRollup {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
  byModel: Record<string, { calls: number; tokens: number; estCostUsd: number }>;
}

export function aggregateUsageByUid(entries: UsageLogEntry[]): Record<string, UidRollup> {
  const perUid: Record<string, UidRollup> = {};
  for (const e of entries) {
    const uid = e.uid || "unknown";
    let u = perUid[uid];
    if (!u) {
      u = { calls: 0, inputTokens: 0, outputTokens: 0, estCostUsd: 0, byModel: {} };
      perUid[uid] = u;
    }
    u.calls += 1;
    u.inputTokens += e.inputTokens || 0;
    u.outputTokens += e.outputTokens || 0;
    u.estCostUsd += e.estCostUsd || 0;
    let m = u.byModel[e.model];
    if (!m) {
      m = { calls: 0, tokens: 0, estCostUsd: 0 };
      u.byModel[e.model] = m;
    }
    m.calls += 1;
    m.tokens += (e.inputTokens || 0) + (e.outputTokens || 0);
    m.estCostUsd += e.estCostUsd || 0;
  }
  return perUid;
}

export function getProDailyAuditCap(): number {
  const raw = parseInt(process.env.PRO_DAILY_AUDIT_CAP || "50", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

export function getCostAlertThresholdUsd(): number {
  const raw = parseFloat(process.env.COST_ALERT_THRESHOLD_USD || "0.30");
  return Number.isFinite(raw) && raw > 0 ? raw : 0.3;
}
