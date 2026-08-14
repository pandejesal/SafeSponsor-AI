import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthHeader } from "@/lib/firebase-admin";
import {
  UsageLogEntry,
  aggregateUsageByUid,
  checkWeeklyCostAlert,
  getProDailyAuditCap,
  getWeekKey,
  weeklyCostAlertThreshold,
  weekStartIso,
} from "@/lib/usage";

export const dynamic = "force-dynamic";

// Rollup docs older than this are recomputed from usage_logs on read.
const ROLLUP_MAX_AGE_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const uid = await verifyAuthHeader(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Admin-only: usage data aggregates costs across ALL users.
    const adminSnap = await adminDb.collection("users").doc(uid).get();
    const adminData = adminSnap.exists ? adminSnap.data() || {} : {};
    if (adminData.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const weekKey = request.nextUrl.searchParams.get("week") || getWeekKey(new Date());
    const rollupRef = adminDb.collection("usage_rollups").doc(weekKey);

    // Serve a fresh rollup doc if one was computed recently; otherwise
    // recompute the week's aggregation from usage_logs and persist it.
    const existing = await rollupRef.get();
    if (existing.exists) {
      const generatedAt = existing.data()?.generatedAt;
      const ageMs = generatedAt ? Date.now() - new Date(generatedAt).getTime() : Infinity;
      if (Number.isFinite(ageMs) && ageMs < ROLLUP_MAX_AGE_MS) {
        return NextResponse.json({ weekKey, cached: true, ...existing.data() });
      }
    }

    const weekStart = weekStartIso(weekKey);
    const snap = await adminDb
      .collection("usage_logs")
      .where("ts", ">=", weekStart)
      .get();
    const entries: UsageLogEntry[] = snap.docs.map((d) => ({ ...(d.data() as UsageLogEntry), id: d.id }));

    const perUid = aggregateUsageByUid(entries);
    const weeklyTotalEstUsd = Object.values(perUid).reduce((sum, u) => sum + u.estCostUsd, 0);
    const proDailyCap = getProDailyAuditCap();

    // M1T4(a): weekly spend alert — fires when the week's estCostUsd reaches
    // 75% of the worst-case budget (cap × 7 days × $0.10/audit).
    let adminFlagged = false;
    if (checkWeeklyCostAlert(weeklyTotalEstUsd, proDailyCap)) {
      adminFlagged = true;
      console.error(
        `[COST ALERT] Weekly spend for ${weekKey}: $${weeklyTotalEstUsd.toFixed(2)} — at/above 75% of worst-case budget ($${weeklyCostAlertThreshold(proDailyCap).toFixed(2)})`
      );
    }

    const rollupData = {
      weekKey,
      weekStart,
      generatedAt: new Date().toISOString(),
      weeklyTotalEstUsd,
      weeklyThresholdUsd: weeklyCostAlertThreshold(proDailyCap),
      adminFlagged,
      perUid,
    };

    // Keep the admin flag sticky across recomputes (merge never clears it).
    await rollupRef.set(rollupData, { merge: true });

    return NextResponse.json(rollupData);
  } catch (error: any) {
    console.error("[USAGE API] Error:", error);
    return NextResponse.json({ error: "Failed to compute usage rollup." }, { status: 500 });
  }
}
