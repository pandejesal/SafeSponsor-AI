import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// N3T1 — liveness + readiness probe for UptimeRobot (and any uptime monitor).
// No auth: it is public by design, returns only health data, and never touches
// secrets. Firestore ping is best-effort and FAIL-OPEN — a Firestore hiccup
// must not mark the app dead when it is only the backing store that wobbled.
export async function GET(_req: NextRequest) {
  const ts = new Date().toISOString();

  let dbOk = true;
  let dbMs: number | null = null;
  try {
    const start = Date.now();
    await adminDb.collection("_health").doc("ping").get();
    dbMs = Date.now() - start;
  } catch (err: any) {
    console.warn("[HEALTH] Firestore ping failed:", err?.message || err);
    dbOk = false;
  }

  return NextResponse.json({
    ok: true,
    ts,
    db: dbOk ? "ok" : "degraded",
    dbMs,
    paymentsMode: process.env.DODO_PAYMENTS_MODE === "live" || process.env.DODO_PAYMENTS_MODE === "live_mode" ? "live" : "test",
  });
}