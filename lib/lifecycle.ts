// M4 — Data lifecycle pure helpers (cache TTL tiers, cache-poisoning guard,
// takedown SLA). No Firestore/network imports so scripts/test_m4.ts can unit
// test these directly, mirroring the lib/usage.ts + scripts/test_m1.ts pattern.

// TTL tiers (D8): soft expiry at 90 days — stale copy still served while a
// background refresh runs; hard expiry at 180 days — treated as a cache miss.
export const CACHE_SOFT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const CACHE_HARD_TTL_MS = 180 * 24 * 60 * 60 * 1000;
// Cooldown between background cache refreshes for the same key (stampede guard).
export const CACHE_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;
// Takedown SLA: 48 hours from request submission (D8).
export const TAKEDOWN_SLA_MS = 48 * 60 * 60 * 1000;

export type CacheTtlState =
  | "fresh"
  | "soft_expired"
  | "hard_expired"
  | "missing";

export interface CacheTtlResult {
  state: CacheTtlState;
  /** True when the cached doc predates TTL stamping and needs a backfill write. */
  needsBackfill: boolean;
  /** Soft-expiry timestamp in ms when state is fresh/soft_expired (for caching
   *  metadata like cached_at / refreshing decisions); NaN otherwise. */
  softExpiresAtMs: number;
  /** Hard-expiry timestamp in ms when determinable; NaN otherwise. */
  hardExpiresAtMs: number;
}

export function computeTtlStamps(nowMs: number): {
  cacheExpiresAt: string;
  hardExpiresAt: string;
} {
  return {
    cacheExpiresAt: new Date(nowMs + CACHE_SOFT_TTL_MS).toISOString(),
    hardExpiresAt: new Date(nowMs + CACHE_HARD_TTL_MS).toISOString(),
  };
}

function toMs(value: unknown): number {
  if (typeof value !== "string") return NaN;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Evaluate the TTL state of a global_audits doc.
 * Docs without TTL stamps get their stamps derived from updatedAt/createdAt
 * (they were written before M4T1); derived stamps keep the old 7-day window
 * behaving correctly because they will be "fresh" until 90 days from the write.
 * Seeded docs live outside global_audits and are never evaluated here.
 */
export function evaluateCacheTtl(docData: Record<string, unknown> | null | undefined, nowMs: number): CacheTtlResult {
  if (!docData) {
    return { state: "missing", needsBackfill: false, softExpiresAtMs: NaN, hardExpiresAtMs: NaN };
  }

  const stampSoft = toMs(docData.cacheExpiresAt);
  const stampHard = toMs(docData.hardExpiresAt);
  const hasStamps = Number.isFinite(stampSoft) && Number.isFinite(stampHard);

  if (!hasStamps) {
    // Backfill path: derive from the write timestamp. A doc with no usable
    // timestamp at all cannot be evaluated — treat as fresh so it still serves
    // (matches pre-M4 behavior of "no timestamp = serve") and gets stamped.
    const baseMs = toMs(docData.updatedAt) || toMs(docData.createdAt);
    if (!Number.isFinite(baseMs) || baseMs <= 0) {
      return { state: "fresh", needsBackfill: true, softExpiresAtMs: NaN, hardExpiresAtMs: NaN };
    }
    return {
      state: "fresh",
      needsBackfill: true,
      softExpiresAtMs: baseMs + CACHE_SOFT_TTL_MS,
      hardExpiresAtMs: baseMs + CACHE_HARD_TTL_MS,
    };
  }

  if (nowMs >= stampHard) {
    return { state: "hard_expired", needsBackfill: false, softExpiresAtMs: stampSoft, hardExpiresAtMs: stampHard };
  }
  if (nowMs >= stampSoft) {
    return { state: "soft_expired", needsBackfill: false, softExpiresAtMs: stampSoft, hardExpiresAtMs: stampHard };
  }
  return { state: "fresh", needsBackfill: false, softExpiresAtMs: stampSoft, hardExpiresAtMs: stampHard };
}

const RISK_WEIGHTS: Record<string, number> = { "Low": 1, "Medium": 2, "High": 3, "Critical": 4 };

/**
 * Cache-poisoning guard (extracted from the analyze route): keep the existing
 * fresh cache unless the incoming result is clearly better. Returns true when
 * the write should be SKIPPED.
 */
export function shouldSkipGlobalCacheWrite(
  existingData: Record<string, unknown> | null | undefined,
  reportData: Record<string, unknown>
): boolean {
  if (!existingData || !existingData.report) return false;

  const existingReport = existingData.report as Record<string, unknown>;
  const rawOldScore = Number(existingReport.brand_safety_score);
  const oldScore = Number.isFinite(rawOldScore) ? rawOldScore : 50;
  const rawNewScore = Number(reportData.brand_safety_score);
  const newScore = Number.isFinite(rawNewScore) ? rawNewScore : 50;

  const oldRiskWeight = RISK_WEIGHTS[String(existingReport.risk_level)] || 2;
  const newRiskWeight = RISK_WEIGHTS[String(reportData.risk_level)] || 2;

  const isScoreMateriallyMoreFavorable = newScore > oldScore + 15;
  const isRiskDowngraded = newRiskWeight < oldRiskWeight;
  const isIncomingEqualToOrWorse = newScore <= oldScore && newRiskWeight >= oldRiskWeight;

  return isScoreMateriallyMoreFavorable || isRiskDowngraded || isIncomingEqualToOrWorse;
}

/** 48h SLA deadline for a takedown request submitted at `createdAtMs`. */
export function slaDeadlineIso(createdAtMs: number): string {
  return new Date(createdAtMs + TAKEDOWN_SLA_MS).toISOString();
}
