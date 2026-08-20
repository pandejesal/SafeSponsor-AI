import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";
import { getSeededAudit } from "@/lib/seeded_audits";
import { buildTeaserReport } from "@/lib/teaser";
import {
  BUDGET_MARGIN_MS,
  createMockLlmProvider,
  createMockVideoFetcher,
  createRealLlmProvider,
  createRealVideoFetcher,
  isChannelTarget,
  normalizeTargetKey,
  runAnalyzePipeline,
  runTeaserScan,
} from "@/lib/analyze-pipeline";
import {
  CACHE_REFRESH_COOLDOWN_MS,
  computeTtlStamps,
  evaluateCacheTtl,
  shouldSkipGlobalCacheWrite,
} from "@/lib/lifecycle";
import { scrubPiiDeep } from "@/lib/utils";
import {
  DAILY_CAP_REASON,
  UsageLogEntry,
  checkPerAuditCostAlert,
  decrementDailyCapCount,
  enforceDailyCap,
  getCostAlertThresholdUsd,
  getDayKey,
  getProDailyAuditCap,
  perAuditCostUsd,
} from "@/lib/usage";
import { z } from "zod";

export const runtime = "nodejs";
// Vercel Hobby caps serverless duration at 60s; declaring 120 (a Pro-tier
// value) gets silently clamped and misleads — the internal OVERALL_BUDGET_MS
// + BUDGET_MARGIN_MS keep the pipeline under the real ceiling anyway.
export const maxDuration = 60;

// Hard wall-clock budget for the whole pipeline (Vercel Hobby ~60s limit).
const OVERALL_BUDGET_MS = 50000;
// P7 — the free teaser must complete inside the 60s Vercel cap while giving
// free-tier Gemini (5-40s latency) a real chance: one 40s patient attempt
// plus ~2s of grant overhead still lands well under the ceiling.
const TEASER_BUDGET_MS = 45000;

// Best-effort persistence of one LLM usage record (M1T1). Never throws: a
// Firestore hiccup must not fail the audit the record describes.
async function persistUsageLog(entry: UsageLogEntry): Promise<void> {
  try {
    const doc: Record<string, unknown> = {
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      latencyMs: entry.latencyMs,
      estCostUsd: entry.estCostUsd,
      success: entry.success,
      ts: new Date().toISOString(),
    };
    // Firestore rejects undefined values — only attach optional fields present.
    if (entry.uid) doc.uid = entry.uid;
    if (entry.targetKey) doc.targetKey = entry.targetKey;
    if (entry.stage) doc.stage = entry.stage;
    if (entry.error) doc.error = entry.error;
    if (entry.attempt !== undefined) doc.attempt = entry.attempt;
    await adminDb.collection("usage_logs").add(doc);
  } catch (err: any) {
    console.warn("[USAGE LOG] Failed to write usage log:", err?.message || err);
  }
}

// M4T2 — tombstone gate: true when a creator takedown blocks serving or
// re-caching this key. Fail-safe: on read error we report tombstoned so the
// caller never serves possibly-withdrawn data.
async function isTombstoned(targetKey: string): Promise<boolean> {
  try {
    const tomb = await adminDb.collection("takedown_tombstones").doc(targetKey).get();
    return tomb.exists;
  } catch (err: any) {
    console.warn(`[TAKEDOWN] Tombstone check failed for ${targetKey}:`, err?.message || err);
    return true;
  }
}

// M4T1 — background cache refresh for soft-expired entries. Runs inside
// after() (post-response) so the user is never blocked on cache maintenance.
// Guards: 15-min stampede cooldown via refreshingAt, tombstone re-check before
// writing, and the same anti-poisoning guard as the main write path. Failure is
// non-fatal — the stale entry simply keeps serving until the next soft expiry.
async function refreshCachedAudit(targetKey: string, target: string): Promise<void> {
  const globalDocRef = adminDb.collection("global_audits").doc(targetKey);
  let existingSnap;
  try {
    existingSnap = await globalDocRef.get();
  } catch (err: any) {
    console.warn("[CACHE REFRESH] Read failed:", err?.message || err);
    return;
  }

  const existingData = existingSnap.exists ? existingSnap.data() : null;
  const refreshingAtMs = existingData?.refreshingAt ? new Date(existingData.refreshingAt).getTime() : NaN;
  if (Number.isFinite(refreshingAtMs) && Date.now() - refreshingAtMs < CACHE_REFRESH_COOLDOWN_MS) {
    console.log(`[CACHE REFRESH] Skipping ${targetKey}: refresh already in progress.`);
    return;
  }

  try {
    await globalDocRef.update({ refreshingAt: new Date().toISOString() });
  } catch (err: any) {
    console.warn("[CACHE REFRESH] Stampede marker write failed:", err?.message || err);
    return;
  }

  const llmProvider = process.env.LLM_MOCK_MODE === "true"
    ? createMockLlmProvider()
    // "cache_refresh" uid keeps system-maintenance cost visible in usage
    // rollups without polluting any real user's per-uid totals.
    : createRealLlmProvider({ uid: "cache_refresh", targetKey, onUsage: persistUsageLog });
  const videoFetcher = process.env.MOCK_YOUTUBE_FETCHES === "true"
    ? createMockVideoFetcher()
    : createRealVideoFetcher();

  const outcome = await runAnalyzePipeline({
    target,
    brandName: "Sponsoring Brand",
    auditFocus: "standard",
    competitorBrands: [],
    additionalUrls: [],
    aliases: [],
    targetKey,
    isChannelAudit: isChannelTarget(target),
    deadlineMs: Date.now() + OVERALL_BUDGET_MS,
    checkBudget: async () => {}, // no user quota involved in cache maintenance
    llm: llmProvider,
    video: videoFetcher,
  });

  if (!outcome.ok) {
    console.warn(`[CACHE REFRESH] Pipeline failed for ${targetKey} (${outcome.reason}); keeping stale cache.`);
    return;
  }
  const reportData = outcome.reportData as Record<string, unknown>;

  if (await isTombstoned(targetKey)) {
    console.log(`[CACHE REFRESH] ${targetKey} is tombstoned; not re-caching.`);
    return;
  }
  if (shouldSkipGlobalCacheWrite(existingData, reportData)) {
    console.log(`[CACHE REFRESH] Guarded: keeping existing cache for ${targetKey}.`);
    await globalDocRef.update({ refreshingAt: FieldValue.delete() });
    return;
  }

  const sanitizedGlobalReport = {
    ...reportData,
    brand_name: "Sponsoring Brand",
    competitor_brands: [],
    competitor_and_sponsorship_history: [],
    creator_known_aliases: [],
    additional_urls: [],
  };
  const nowMs = Date.now();
  await globalDocRef.set({
    targetKey,
    target,
    report: scrubPiiDeep(sanitizedGlobalReport) as Record<string, unknown>,
    createdAt: existingData?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...computeTtlStamps(nowMs),
    refreshingAt: FieldValue.delete(),
  }, { merge: true });
  console.log(`[CACHE REFRESH] Refreshed cache for ${targetKey}.`);
}

const analyzeSchema = z.object({
  target: z.string().max(500).optional(),
  primary_url: z.string().max(500).optional(),
  url: z.string().max(500).optional(),
  brand_name: z.string().max(100).optional(),
  force_refresh: z.boolean().optional(),
  audit_focus: z.string().max(100).optional(),
  competitor_brands: z.union([
    z.array(z.string().max(100)),
    z.string().max(500)
  ]).optional(),
  additional_urls: z.union([
    z.array(z.string().max(300)),
    z.string().max(1000)
  ]).optional(),
  creator_known_aliases: z.union([
    z.array(z.string().max(100)),
    z.string().max(500)
  ]).optional(),
  // N1T1 — teaser mode: fresh pipeline run whose trimmed result is discarded.
  teaser: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  // Hoisted so the outer catch can refund credits if the pipeline fails after
  // the quota was consumed.
  let consumedEntitlement: string | null = null;
  let activeUserRef: FirebaseFirestore.DocumentReference | null = null;
  let activeUid: string | null = null;
  // Hoisted so a failed audit can refund the daily-cap slot it claimed
  // (usage_daily/{uid}_{day}). Null until a subscription audit claims a slot.
  let activeDayKey: string | null = null;
  // Hoisted so failure exits can still run the per-audit cost alert.
  let activeTargetKey: string | null = null;
  // Hoisted so the shared per-audit cost alert sees every LLM call of this
  // audit even when the pipeline fails before the success-path reporting.
  let auditUsageEntries: UsageLogEntry[] = [];

  // Audit-failure refund of the subscription daily-cap slot (M1T3 counter).
  // Failed Pro audits must NOT burn a cap slot: the 502 responses promise
  // "credit was not consumed", so the increment from the quota transaction is
  // rolled back (transactional read+decrement, never below 0). Failure to
  // refund is logged and non-fatal — the audit result stands.
  const refundDailyCapSlot = async (reason: string) => {
    if (!activeDayKey || !activeUid) return;
    const dayKey = activeDayKey;
    activeDayKey = null;
    const counterRef = adminDb.collection("usage_daily").doc(`${activeUid}_${dayKey}`);
    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
        const next = decrementDailyCapCount(count);
        if (next !== count) {
          tx.update(counterRef, { count: next, updatedAt: new Date() });
        }
      });
      console.warn(`[CAP SLOT REFUND] Refunded daily cap slot for ${activeUid}_${dayKey} (${reason})`);
    } catch (refundErr: any) {
      console.error(`[CAP SLOT REFUND FAILED] Could not refund daily cap slot for ${activeUid}_${dayKey}:`, refundErr?.message || refundErr);
    }
  };

  const refundEntitlement = async (reason: string) => {
    if (!consumedEntitlement || !activeUserRef) return;
    // Subscription claims never decrement credits — but they DO claim a daily
    // cap slot, which must be refunded when the audit fails.
    if (consumedEntitlement === "subscription") {
      consumedEntitlement = null;
      await refundDailyCapSlot(reason);
      return;
    }
    try {
      if (consumedEntitlement === "videoCredit") await activeUserRef.update({ videoCredits: FieldValue.increment(1) });
      else if (consumedEntitlement === "channelCredit") await activeUserRef.update({ channelCredits: FieldValue.increment(1) });
      else if (consumedEntitlement === "reportCredit") await activeUserRef.update({ reportCredits: FieldValue.increment(1) });
      console.warn(`[CREDIT REFUND] Refunded ${consumedEntitlement} (${reason})`);
      consumedEntitlement = null;
    } catch (refundErr: any) {
      console.error(`[CREDIT REFUND FAILED] Could not refund ${consumedEntitlement}:`, refundErr?.message || refundErr);
    }
  };

  // M1T4(b) per-audit cost alert, shared by success and failure exits: a
  // failed audit can still have burned real LLM money (usage already logged
  // via onUsage), so the alert must fire whenever the summed estCostUsd of
  // this audit's calls crossed the threshold — not only on success.
  const emitPerAuditCostAlert = async (targetKey: string | null) => {
    const totalUsd = perAuditCostUsd(auditUsageEntries);
    if (!checkPerAuditCostAlert(totalUsd, getCostAlertThresholdUsd())) return;
    console.error(
      `[COST ALERT] Audit for targetKey=${targetKey || "unknown"} (uid=${activeUid || "unknown"}) cost $${totalUsd.toFixed(4)} — above threshold $${getCostAlertThresholdUsd().toFixed(2)}`
    );
    try {
      await adminDb.collection("usage_alerts").add({
        type: "per-audit-cost",
        ...(activeUid ? { uid: activeUid } : {}),
        ...(targetKey ? { targetKey } : {}),
        estCostUsd: totalUsd,
        thresholdUsd: getCostAlertThresholdUsd(),
        ts: new Date().toISOString(),
      });
    } catch (alertErr: any) {
      console.warn("[COST ALERT] Failed to persist per-audit alert:", alertErr?.message || alertErr);
    }
  };

  // Hard wall-clock budget for the whole pipeline (Vercel Hobby ~60s limit).
  const requestStartMs = performance.now();
  const deadlineMs = requestStartMs + OVERALL_BUDGET_MS;

  // Fail fast BEFORE starting an expensive phase when the remaining budget is
  // already smaller than the phase's worst-case cost + margin. On exhaustion,
  // refund the entitlement and return the existing 502 shape.
  const failFastIfOverBudget = async (phase: string, worstCaseMs: number) => {
    const remaining = deadlineMs - performance.now();
    if (remaining < worstCaseMs + BUDGET_MARGIN_MS) {
      console.warn(`[TIME BUDGET] Over budget before ${phase}: ${Math.round(remaining)}ms left, needing ~${worstCaseMs + BUDGET_MARGIN_MS}ms`);
      await refundEntitlement(`time budget exhausted before ${phase}`);
      const err: any = new Error(
        "Analysis could not be completed within the time budget. Please try again later."
      );
      err.timeBudgetExhausted = true;
      throw err;
    }
  };

  try {
    // 2. Parse Body FIRST so the App Check policy below can be teaser-aware
    // (the anonymous teaser is intentionally a public, sign-in-free endpoint).
    let rawBody: unknown;
    try {
      const rawText = await req.text();
      if (rawText.length > 1024 * 1024) {
        return NextResponse.json({ error: "Payload too large. Maximum allowed request size is 1MB." }, { status: 413 });
      }
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parseResult = analyzeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed: " + parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }

    const inputData = parseResult.data;
    const isTeaserBody = inputData.teaser === true;

    // 1. Authenticate Request. uid is NULLABLE for the anonymous teaser;
    // every other path re-requires it after the teaser branch below.
    const uid = await verifyAuthHeader(req);
    activeUid = uid;

    // Anonymous abuse controls: the teaser is public (no sign-in), so it is
    // gated on a per-IP marker + per-IP rate limit instead of Firebase auth.
    // IP comes from the Vercel x-forwarded-for chain and is hashed so raw
    // addresses never land in Firestore.
    const ipRaw = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
    const ipKey = "ip_" + crypto.createHash("sha256").update("teaser:" + ipRaw).digest("hex").slice(0, 32);

    // 0. App Check Token Verification. Signed-in paths stay enforced (the
    // client initializes App Check only after sign-in — FR-4). The anonymous
    // teaser is EXEMPT: its protection is the 1-per-IP marker and per-IP rate
    // limit below, and demanding reCAPTCHA would re-create the exact
    // sign-in friction P7 exists to remove.
    const appCheckResult = await verifyAppCheckHeader(req);
    if (!appCheckResult.valid && !(isTeaserBody && !uid)) {
      return NextResponse.json(
        { error: "Unauthorized client request (App Check failed)." },
        { status: 401 }
      );
    }

    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large. Maximum allowed request size is 1MB." }, { status: 413 });
    }

    // Rate Limiting Check: max 10 audit requests per minute (per uid, or per
    // IP for anonymous callers).
    const rateLimitRef = adminDb.collection("rate_limits").doc(uid || ipKey);
    const now = Date.now();
    try {
      const rateLimitAllowed = await adminDb.runTransaction(async (tx) => {
        const doc = await tx.get(rateLimitRef);
        const data = doc.exists ? doc.data() : { timestamps: [] };
        const windowStart = now - 60000;
        const validTimestamps = (data?.timestamps || []).filter((ts: number) => typeof ts === "number" && ts > windowStart);
        if (validTimestamps.length >= 10) {
          return false;
        }
        validTimestamps.push(now);
        tx.set(rateLimitRef, { timestamps: validTimestamps, updatedAt: new Date() }, { merge: true });
        return true;
      });

      if (!rateLimitAllowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Maximum 10 analysis requests allowed per minute." },
          { status: 429 }
        );
      }
    } catch (rlErr: any) {
      console.error("Rate limit transaction failure:", rlErr?.message || rlErr);
      return NextResponse.json(
        { error: "Rate limiting system unavailable. Please try again shortly." },
        { status: 429 }
      );
    }

    const rawTarget = inputData.target || inputData.primary_url || inputData.url;
    
    if (!rawTarget || typeof rawTarget !== "string" || rawTarget.trim().length === 0) {
      return NextResponse.json(
        { error: "Target Creator handle, name, or URL is required" },
        { status: 400 }
      );
    }

    const target = rawTarget.trim().slice(0, 500);
    const brand_name = (inputData.brand_name || "Sponsoring Brand").trim().slice(0, 100);
    const force_refresh = inputData.force_refresh === true;
    const teaser = inputData.teaser === true;
    const audit_focus = inputData.audit_focus || "standard";
    const targetKey = normalizeTargetKey(target);
    activeTargetKey = targetKey;
    // Anonymous teasers never write to a user doc; the doc ref is only used
    // in the (uid-guarded) teaser branch and after the auth re-check below.
    const userDocRef = adminDb.collection('users').doc(uid || "anon");

    // Per-audit usage accumulator (M1T1/M1T4): every LLM call of this audit is
    // pushed into the hoisted array (visible to the shared cost-alert emitter
    // even on failure exits) so the audit's total estCostUsd can be checked
    // against the per-audit cost-alert threshold before responding.
    const reportAuditUsage = async (entry: UsageLogEntry) => {
      auditUsageEntries.push(entry);
      await persistUsageLog(entry);
    };

    // Detect target type from the target value itself (not audit_focus, which is a
    // dossier depth mode and must not drive billing). Handles: @name, youtube.com/@name,
    // youtube.com/channel/<ID>, youtube.com/c/Name.
    const isChannelHandle = isChannelTarget(target);

    // Parse competitor_brands (capped at 5 items, max 100 chars each)
    let competitor_brands: string[] = [];
    if (Array.isArray(inputData.competitor_brands)) {
      competitor_brands = inputData.competitor_brands
        .map((b: any) => String(b).trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 5);
    } else if (typeof inputData.competitor_brands === "string") {
      competitor_brands = inputData.competitor_brands
        .split(",")
        .map((b: string) => b.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 5);
    }

    // Parse additional_urls (capped at 3 URLs max to prevent resource exhaustion)
    let additional_urls: string[] = [];
    if (Array.isArray(inputData.additional_urls)) {
      additional_urls = inputData.additional_urls
        .map((u: any) => String(u).trim().slice(0, 300))
        .filter(Boolean)
        .slice(0, 3);
    } else if (typeof inputData.additional_urls === "string") {
      additional_urls = inputData.additional_urls
        .split("\n")
        .map((u: string) => u.trim().slice(0, 300))
        .filter(Boolean)
        .slice(0, 3);
    }

    // Parse creator_known_aliases (capped at 5 items)
    let creator_known_aliases: string[] = [];
    if (Array.isArray(inputData.creator_known_aliases)) {
      creator_known_aliases = inputData.creator_known_aliases
        .map((a: any) => String(a).trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 5);
    } else if (typeof inputData.creator_known_aliases === "string") {
      creator_known_aliases = inputData.creator_known_aliases
        .split(",")
        .map((a: string) => a.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 5);
    }

    // -------------------------------------------------------------
    // TEASER MODE (N1) — "Check any creator free", once per device (IP)
    // and once per account.
    // A FAST single-call scan (runTeaserScan) whose result is DISCARDED:
    // never written to user history or global_audits, and no normal
    // entitlement claim happens (no credit decrement, no subscription cap
    // slot, no daily-cap counter — only the dual-marker cap below applies).
    // usage_logs + per-audit cost alerts still apply so the run's real LLM
    // cost stays visible. Tombstoned creators are denied outright (fail-safe
    // mirror of M4T2). This branch returns before the quota transaction and
    // the cache read path below.
    // -------------------------------------------------------------
    if (teaser) {
      // N1T1 — takedown tombstones block teaser runs BEFORE the cap is
      // consumed: a withdrawn creator must not be re-analyzed, and a denial
      // must not burn the user's one free check.
      if (await isTombstoned(targetKey)) {
        console.log(`[TEASER] Denied tombstoned targetKey ${targetKey}`);
        return NextResponse.json(
          { error: "This creator cannot be analyzed." },
          { status: 404 }
        );
      }

      // N1T2 — dual-marker free-check cap: one per IP (never expires) AND one
      // per account when signed in. Every run writes BOTH markers, so the
      // sign-in/sign-out rotation can never reset the IP marker. Atomic
      // check+set (mirror of the M1T3 counter pattern): concurrent teaser
      // requests cannot both pass. Applies to EVERY uid, paid or not — paid
      // users simply never see the teaser CTA (UI-level gating).
      const ipRef = adminDb.collection("rate_limits").doc(ipKey);
      const teaserGrant = await adminDb.runTransaction(async (tx) => {
        const ipSnap = await tx.get(ipRef);
        if (ipSnap.exists && ipSnap.data()?.teaserUsedAt) {
          return { allowed: false, reason: "ip" };
        }
        if (uid) {
          const uSnap = await tx.get(userDocRef);
          const used = uSnap.exists && (uSnap.data() || {}).freeAnalysisUsed === true;
          if (used) return { allowed: false, reason: "account" };
        }
        tx.set(ipRef, {
          teaserUsedAt: new Date().toISOString(),
          updatedAt: new Date(),
        }, { merge: true });
        if (uid) {
          tx.set(userDocRef, {
            freeAnalysisUsed: true,
            teaserUsedAt: new Date().toISOString(),
            updatedAt: new Date(),
          }, { merge: true });
        }
        return { allowed: true, reason: null };
      }).catch((grantErr: any) => {
        console.error("[TEASER] Cap check transaction failed:", grantErr?.message || grantErr);
        return null;
      });

      if (teaserGrant === null) {
        return NextResponse.json(
          { error: "Teaser verification error. Please try again." },
          { status: 500 }
        );
      }
      if (!teaserGrant.allowed) {
        return NextResponse.json(
          { error: "Free teaser already used" },
          { status: 429 }
        );
      }

      const llmProvider = process.env.LLM_MOCK_MODE === "true"
        ? createMockLlmProvider()
        : createRealLlmProvider({ uid: uid || "anon", targetKey, onUsage: reportAuditUsage });

      // P7 — fast first-impression scan (single LLM call, no video fetching,
      // no evidence collection): the full pipeline routinely exceeds the
      // 50s budget on cold starts and the free check must return in seconds.
      // The scan runs under its own tighter 25s deadline (see TEASER_BUDGET_MS).
      const teaserOutcome = await runTeaserScan({
        target,
        brandName: brand_name,
        deadlineMs: Math.min(deadlineMs, requestStartMs + TEASER_BUDGET_MS),
        llm: llmProvider,
      });

      if (!teaserOutcome.ok) {
        // Nothing was consumed (no entitlement claim), but the failed LLM
        // calls still cost real money — the per-audit cost alert must fire.
        await emitPerAuditCostAlert(activeTargetKey);
        // Roll BOTH teaser markers back: a failed run must not burn the
        // device's or the account's one free check. ALL reads first — the
        // Firestore transaction API rejects reads issued after writes.
        await adminDb.runTransaction(async (tx) => {
          const ipSnap = await tx.get(ipRef);
          const uSnap = uid ? await tx.get(userDocRef) : null;
          if (ipSnap.exists && ipSnap.data()?.teaserUsedAt) {
            tx.update(ipRef, { teaserUsedAt: FieldValue.delete() });
          }
          if (uid && uSnap) {
            const ud = uSnap.data() || {};
            if (ud.freeAnalysisUsed === true) {
              tx.update(userDocRef, {
                freeAnalysisUsed: FieldValue.delete(),
                teaserUsedAt: FieldValue.delete(),
              });
            }
          }
        }).catch((rollbackErr: any) => {
          console.error("[TEASER] Cap rollback failed:", rollbackErr?.message || rollbackErr);
        });
        if (teaserOutcome.reason === "research_failed") {
          return NextResponse.json(
            { error: "The AI analysis service is temporarily unavailable. Please try again shortly." },
            { status: 502 }
          );
        }
        return NextResponse.json(
          { error: "Unverifiable model output: unable to parse JSON response." },
          { status: 502 }
        );
      }

      // N1T1 — trimmed headline verdict only; the result is discarded
      // (no history/global_audits write), so a purchase re-runs the pipeline.
      await emitPerAuditCostAlert(activeTargetKey);
      return NextResponse.json(buildTeaserReport(teaserOutcome.reportData));
    }

    // Anonymous callers are done (the teaser returned above); every other
    // path requires a real account.
    if (!uid) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to run brand safety analyses." },
        { status: 401 }
      );
    }

    // -------------------------------------------------------------
    // GLOBAL DATABASE CACHE CHECK
    // If another user previously audited this same creator target,
    // retrieve from Firestore global_audits instantly (saves API costs).
    // SKIP for subscribed users — they paid for fresh analysis.
    // -------------------------------------------------------------
    const userDoc = await userDocRef.get();
    const userData = userDoc.data() || {};
    const subData = userData.subscription && typeof userData.subscription === "object" ? userData.subscription : null;
    // Subscription is only valid when there is a finite expiry in the future.
    // Missing/corrupt expiresAt MUST NOT be treated as an unlimited subscription.
    const subExpiryMs = subData?.expiresAt ? new Date(subData.expiresAt).getTime() : NaN;
    const isSubValid = Number.isFinite(subExpiryMs) && subExpiryMs > Date.now();
    const isSubscribed = userData.hasSubscription === true && isSubValid;

    const hasCredits = (typeof userData.videoCredits === "number" && userData.videoCredits > 0) ||
                       (typeof userData.channelCredits === "number" && userData.channelCredits > 0) ||
                       (typeof userData.reportCredits === "number" && userData.reportCredits > 0);
    const isPaidUser = isSubscribed || hasCredits;

    // N1T2 — cache/seed full dossiers are served ONLY to users with a paid
    // entitlement. Free-tier users (never-teasered or teaser-exhausted) skip
    // the seed + global_audits read entirely and fall through to the quota
    // denial below, so stored full dossiers are never handed to them.
    if (!force_refresh && targetKey && isPaidUser) {
      // M4T2 — a creator takedown blocks ALL cached serving of the key,
      // including the in-memory seed dossiers. Fail-safe: if the tombstone
      // check errors, treat the key as tombstoned and skip the cache.
      const tombstoned = await isTombstoned(targetKey);
      if (!tombstoned) {
        // First check in-memory pre-computed seeded audits for top famous YouTubers
        const seeded = getSeededAudit(target || targetKey);
        if (seeded) {
          console.log(`[SEED HIT] Serving pre-computed audit for famous creator: ${target}`);
          const reportData = {
            ...seeded,
            brand_name: brand_name || seeded.brand_name || "Sponsoring Brand",
            target: target || seeded.target,
            is_cached: true,
            cached_at: seeded.analyzed_at || new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };

          let reportId = "report_" + Date.now();
          try {
            const historyRef = await userDocRef.collection('history').add(reportData);
            reportId = historyRef.id;
          } catch (hErr: any) {
            console.warn("Failed to save seeded audit to user history:", hErr?.message || hErr);
          }

          return NextResponse.json({
            id: reportId,
            ...reportData,
          });
        }

        try {
          const cachedDoc = await adminDb.collection('global_audits').doc(targetKey).get();
          if (cachedDoc.exists) {
            const cachedData = cachedDoc.data();
            const nowMs = Date.now();
            // M4T1 — TTL tiers: fresh (<90d) serves instantly; soft_expired
            // (90–180d) still serves a stale copy while a background refresh
            // runs; hard_expired (>180d) falls through to a fresh pipeline run.
            const ttl = evaluateCacheTtl(cachedData, nowMs);

            if (cachedData?.report && (ttl.state === "fresh" || ttl.state === "soft_expired")) {
              console.log(`[CACHE HIT] Serving global cached audit for targetKey: ${targetKey} (state=${ttl.state})`);

              // Backfill TTL stamps on docs written before stamping existed.
              if (ttl.needsBackfill) {
                try {
                  await adminDb.collection('global_audits').doc(targetKey).update(computeTtlStamps(nowMs));
                } catch (backfillErr: any) {
                  console.warn("Failed to backfill cache TTL stamps:", backfillErr?.message || backfillErr);
                }
              }

              // Serve the stale dossier immediately; refresh the cache after
              // the response completes so the next viewer gets fresh data.
              if (ttl.state === "soft_expired") {
                after(() => {
                  refreshCachedAudit(targetKey, target || cachedData.report.target).catch((err: any) =>
                    console.warn("[CACHE REFRESH] Background refresh failed:", err?.message || err)
                  );
                });
              }

              const reportData = {
                ...cachedData.report,
                brand_name: brand_name || "Sponsoring Brand",
                competitor_brands: competitor_brands || [],
                target: target || cachedData.report.target,
                is_cached: true,
                cached_at: cachedData.updatedAt || cachedData.createdAt || new Date().toISOString(),
                createdAt: new Date().toISOString(),
              };

              // Save report to current user's history (guarded — a Firestore hiccup
              // must not 500 a perfectly good cached response)
              let cachedReportId = "report_" + Date.now();
              try {
                const historyRef = await userDocRef.collection('history').add(reportData);
                cachedReportId = historyRef.id;
              } catch (cacheHistoryErr: any) {
                console.warn("Failed to save cached audit to user history:", cacheHistoryErr?.message || cacheHistoryErr);
              }

              return NextResponse.json({
                id: cachedReportId,
                ...reportData,
              });
            }
            // hard_expired (or missing report body) falls through to live research.
          }
        } catch (cacheErr: any) {
          console.warn("Global cache check failed, falling back to live research:", cacheErr.message);
        }
      }
    }

    // 3. Check User Quota / Entitlements ATOMICALLY via Firestore Transaction
    // Runs AFTER the cache check so cached/zero-cost audits never consume credits.
    // NOTE: consumedEntitlement is intentionally NOT re-declared here — it is
    // hoisted above the outer try block so refundEntitlement() can see the value
    // when this request fails after quota consumption. A shadowing re-declaration
    // here would make the variable invisible to the refund closure.
    // isChannelAudit MUST be declared BEFORE the transaction: the Firestore
    // callback below runs synchronously (TDZ — "Cannot access X before
    // initialization"), and the closure branches on isChannelAudit for free
    // users. A declaration after this block would crash every no-subscription,
    // zero-credit request with a 500 instead of the intended 402.
    const isChannelAudit = isChannelHandle;
    try {
      const transactionResult = await adminDb.runTransaction(async (tx) => {
        const userSnap = await tx.get(userDocRef);
        const userData = userSnap.exists ? userSnap.data() || {} : {};

        const subObj = userData.subscription && typeof userData.subscription === "object" ? userData.subscription : null;
        const subExpiryMs = subObj?.expiresAt ? new Date(subObj.expiresAt).getTime() : NaN;
        const isNotExpired = Number.isFinite(subExpiryMs) && subExpiryMs > Date.now();
        const isSubActive = subObj?.status === "active" && isNotExpired;
        const hasSub = (userData.hasSubscription === true && isNotExpired) || isSubActive;
        const videoCredits = typeof userData.videoCredits === "number" ? userData.videoCredits : 0;
        const channelCredits = typeof userData.channelCredits === "number" ? userData.channelCredits : 0;
        const reportCredits = typeof userData.reportCredits === "number" ? userData.reportCredits : 0;

        // M1T3: per-user, per-day audit counter. Paid (subscription) users skip
        // the global cache by design, so EVERY audit they run counts against the
        // cap — there is no cache exemption. The check + increment happen inside
        // this transaction so concurrent requests cannot overshoot the cap
        // (Firestore retries the tx when the counter doc changes mid-flight).
        const dayKey = getDayKey(new Date());
        const dailyCounterRef = adminDb.collection("usage_daily").doc(`${uid}_${dayKey}`);
        const dailyCounterSnap = await tx.get(dailyCounterRef);
        const usedToday = dailyCounterSnap.exists ? Number(dailyCounterSnap.data()?.count || 0) : 0;

        if (hasSub) {
          const capCheck = enforceDailyCap(usedToday, getProDailyAuditCap());
          if (!capCheck.allowed) {
            return { allowed: false, type: "none" as const, reason: capCheck.reason };
          }
          tx.set(dailyCounterRef, { count: capCheck.nextCount, uid, day: dayKey, updatedAt: new Date() }, { merge: true });
          // Remember the claimed slot so a failed audit can refund it.
          activeDayKey = dayKey;
          return { allowed: true, type: "subscription" as const };
        }

        if (isChannelAudit) {
          if (channelCredits > 0) {
            tx.set(userDocRef, { channelCredits: channelCredits - 1, updatedAt: new Date() }, { merge: true });
            return { allowed: true, type: "channelCredit" as const };
          } else {
            return { allowed: false, type: "none" as const, reason: "Channel Report credit required. Please purchase a Channel Report or Unlimited Pro subscription." };
          }
        } else {
          // Single video audit. NOTE: freeAnalysisUsed is no longer granted
          // here (N1T2) — it is the 1-per-account teaser cap only. The $8
          // Single Report is the only path to a full dossier for free-tier
          // users; the teaser is the only free pipeline run.
          if (videoCredits > 0) {
            tx.set(userDocRef, { videoCredits: videoCredits - 1, updatedAt: new Date() }, { merge: true });
            return { allowed: true, type: "videoCredit" as const };
          } else if (reportCredits > 0) {
            tx.set(userDocRef, { reportCredits: reportCredits - 1, updatedAt: new Date() }, { merge: true });
            return { allowed: true, type: "reportCredit" as const };
          } else if (channelCredits > 0) {
            tx.set(userDocRef, { channelCredits: channelCredits - 1, updatedAt: new Date() }, { merge: true });
            return { allowed: true, type: "channelCredit" as const };
          } else {
            return { allowed: false, type: "none" as const, reason: "Analysis credit required. Please purchase a Single Report or Unlimited Pro subscription." };
          }
        }
      });

      if (!transactionResult.allowed) {
        const isDailyCap = transactionResult.reason === DAILY_CAP_REASON;
        return NextResponse.json(
          { error: transactionResult.reason || "Quota limit reached. Please purchase credits or upgrade to Unlimited Pro." },
          { status: isDailyCap ? 429 : 402 }
        );
      }
      consumedEntitlement = transactionResult.type;
      activeUserRef = userDocRef;
    } catch (txErr: any) {
      console.error("[SECURITY FAILURE] Quota check transaction failed:", txErr?.message || txErr);
      return NextResponse.json(
        { error: "Quota verification error. Please try again." },
        { status: 500 }
      );
    }

    // NOTE: isChannelAudit is declared ABOVE the quota transaction block (see
    // the note there) because the Firestore callback runs synchronously and
    // branches on it for free users — a declaration after the block would
    // crash with a TDZ error ("Cannot access X before initialization").
    // 4-6. Run the research → synthesis → repair pipeline core (M2T1a).
    // The route stays thin: auth, quota, cache, alerts. LLM and YouTube
    // dependencies are injected; mock modes make the pipeline run offline
    // (LLM_MOCK_MODE=true, MOCK_YOUTUBE_FETCHES=true — used by the benchmark
    // eval in CI, zero network calls).
    const llmProvider = process.env.LLM_MOCK_MODE === "true"
      ? createMockLlmProvider()
      : createRealLlmProvider({ uid, targetKey, onUsage: reportAuditUsage });
    const videoFetcher = process.env.MOCK_YOUTUBE_FETCHES === "true"
      ? createMockVideoFetcher()
      : createRealVideoFetcher();

    const outcome = await runAnalyzePipeline({
      target,
      brandName: brand_name,
      auditFocus: audit_focus,
      competitorBrands: competitor_brands,
      additionalUrls: additional_urls,
      aliases: creator_known_aliases,
      targetKey,
      isChannelAudit,
      deadlineMs,
      checkBudget: failFastIfOverBudget,
      llm: llmProvider,
      video: videoFetcher,
    });

    if (!outcome.ok) {
      if (outcome.reason === "research_failed") {
        // Fail fast: charge NOTHING when every AI provider failed. Synthesizing a
        // dossier from a failure string would bill the user for a fabricated report.
        await refundEntitlement("Pass 1 produced no research output");
        // Failed calls still cost money — alert if this audit crossed the
        // per-audit cost threshold despite the failure.
        await emitPerAuditCostAlert(activeTargetKey);
        return NextResponse.json(
          { error: "The AI analysis service is temporarily unavailable. Your credit was not consumed — please try again shortly." },
          { status: 502 }
        );
      }
      // synthesis_unparseable — repair pass failed too.
      await refundEntitlement("Pass 2 output could not be parsed or validated");
      await emitPerAuditCostAlert(activeTargetKey);
      return NextResponse.json(
        { error: "Unverifiable model output: unable to parse JSON response." },
        { status: 502 }
      );
    }

    const reportData = outcome.reportData as Record<string, unknown>;

    // 6. Save Report to User History in Firestore (Server-side)
    let reportId = "report_" + Date.now();
    let reportPersisted = true;
    try {
      const historyRef = await userDocRef.collection('history').add(reportData);
      reportId = historyRef.id;
    } catch (historyErr: any) {
      reportPersisted = false;
      console.warn("Failed to write to user history in Firestore:", historyErr?.message || historyErr);
    }

    // 7. Save to Global Database Cache (global_audits) for instant cost-saving cache hits across all users
    // Strip brand-specific fields (brand_name, competitor_brands) to protect competitive intelligence
    // Cache-poisoning guard: Do not overwrite an existing fresh report if incoming report is materially more favorable
    if (targetKey) {
      try {
        // M4T2 — tombstoned keys are never re-cached.
        if (await isTombstoned(targetKey)) {
          console.log(`[CACHE SAVE] Skipping global_audits write for tombstoned targetKey ${targetKey}`);
        } else {
          const globalDocRef = adminDb.collection('global_audits').doc(targetKey);
          const existingDoc = await globalDocRef.get();

          let shouldSkipGlobalCache = false;

          if (existingDoc.exists) {
            const existingData = existingDoc.data();
            // M4T1 — the anti-poisoning guard now covers the full TTL window
            // (fresh + soft_expired); hard-expired entries are replaced freely.
            const ttl = evaluateCacheTtl(existingData, Date.now());
            const isExistingFresh = ttl.state === "fresh" || ttl.state === "soft_expired";

            if (isExistingFresh && shouldSkipGlobalCacheWrite(existingData, reportData)) {
              shouldSkipGlobalCache = true;
              console.log(
                `[CACHE GUARD] Skipping global_audits overwrite for targetKey ${targetKey}: Incoming result is not materially better than existing cache.`
              );
            }
          }

          if (!shouldSkipGlobalCache) {
            const sanitizedGlobalReport = {
              ...reportData,
              brand_name: "Sponsoring Brand",
              competitor_brands: [],
              // These fields are only meaningful to the brand that paid for this
              // audit (their competitor list + inferred sponsorship status) and
              // could leak competitive intelligence to every subsequent user.
              competitor_and_sponsorship_history: [],
              creator_known_aliases: [],
              additional_urls: [],
            };
            const nowMs = Date.now();
            await globalDocRef.set({
              targetKey,
              target,
              // M4T5 — PII scrub (emails/phones/addresses) before the dossier
              // enters the shared cache.
              report: scrubPiiDeep(sanitizedGlobalReport) as Record<string, unknown>,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              // M4T1 — TTL tiers: soft expiry 90d, hard expiry 180d.
              ...computeTtlStamps(nowMs),
            }, { merge: true });
            console.log(`[CACHE SAVE] Saved targetKey ${targetKey} to global_audits (sanitized of brand strategy + PII)`);
          }
        }
      } catch (globalSaveErr: any) {
        console.warn("Failed to write to global_audits collection:", globalSaveErr.message);
      }
    }

    // M1T4(b): per-audit cost alert. Basis = sum of estCostUsd of every LLM
    // call in this audit (research + synthesis + repair), keyed by targetKey.
    // Shared emitter: failure exits call the same check (failed audits can
    // still have incurred real LLM cost).
    await emitPerAuditCostAlert(activeTargetKey);

    return NextResponse.json({
      id: reportId,
      persisted: reportPersisted,
      ...reportData,
    });
  } catch (error: any) {
    console.error("Analysis execution error:", error);
    if (error?.timeBudgetExhausted) {
      // refundEntitlement already ran inside failFastIfOverBudget before the
      // throw — emit the alert for whatever LLM cost was already incurred.
      await emitPerAuditCostAlert(activeTargetKey);
      return NextResponse.json(
        { error: "Analysis could not be completed within the time budget. Your credit was not consumed — please try again." },
        { status: 502 }
      );
    }
    await refundEntitlement("analysis pipeline failed");
    await emitPerAuditCostAlert(activeTargetKey);
    return NextResponse.json(
      { error: "Failed to analyze the creator target. Please try again." },
      { status: 500 }
    );
  }
}
