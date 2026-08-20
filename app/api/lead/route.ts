import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

// P7 — email capture from the anonymous teaser result card. Public endpoint
// (no auth, no App Check — its abuse control is the per-IP rate limit below,
// mirroring the anonymous teaser path in /api/analyze). Stores a retargeting
// lead; no email is sent today (no provider wired — docs/ops-runbooks.md).
const leadSchema = z.object({
  email: z.string().email().max(254),
  target: z.string().max(500).optional(),
  score: z.number().min(0).max(100).optional(),
  riskLevel: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  const ipRaw = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";

  let body: unknown;
  try {
    const rawText = await req.text();
    if (rawText.length > 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    }
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed: " + parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(", ") },
      { status: 400 }
    );
  }
  const { email, target, score, riskLevel } = parsed.data;
  const emailNormalized = email.trim().toLowerCase();

  // Per-IP rate limit: max 5 lead captures per minute (hashed doc id —
  // raw addresses never land in Firestore).
  const leadIpKey = "lead_ip_" + crypto.createHash("sha256").update("lead:" + ipRaw).digest("hex").slice(0, 32);
  try {
    const rateLimitRef = adminDb.collection("rate_limits").doc(leadIpKey);
    const allowed = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(rateLimitRef);
      const data = doc.exists ? doc.data() : { timestamps: [] };
      const now = Date.now();
      const validTimestamps = (data?.timestamps || []).filter((ts: number) => typeof ts === "number" && ts > now - 60000);
      if (validTimestamps.length >= 5) return false;
      validTimestamps.push(now);
      tx.set(rateLimitRef, { timestamps: validTimestamps, updatedAt: new Date() }, { merge: true });
      return true;
    });
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again shortly." }, { status: 429 });
    }
  } catch (rlErr: any) {
    console.error("[LEAD] Rate limit transaction failure:", rlErr?.message || rlErr);
    return NextResponse.json({ error: "Rate limiting system unavailable. Please try again shortly." }, { status: 429 });
  }

  try {
    const leadRef = adminDb.collection("leads").doc(emailNormalized);
    await leadRef.set({
      email,
      emailNormalized,
      ...(target ? { target } : {}),
      ...(score !== undefined ? { score } : {}),
      ...(riskLevel ? { riskLevel } : {}),
      source: "landing-teaser",
      firstSeenAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
      count: FieldValue.increment(1),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[LEAD] Write failed:", err?.message || err);
    return NextResponse.json({ error: "Could not save your email. Please try again." }, { status: 500 });
  }
}