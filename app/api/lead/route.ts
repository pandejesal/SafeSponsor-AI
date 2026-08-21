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
// lead plus optional UTM attribution for funnel source tracking; when
// MAILERLITE_API_KEY is configured the lead is also pushed to MailerLite
// (fail-soft — never blocks the lead save). See docs/ops-runbooks.md.
const leadSchema = z.object({
  email: z.string().email().max(254),
  target: z.string().max(500).optional(),
  score: z.number().min(0).max(100).optional(),
  riskLevel: z.string().max(50).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_content: z.string().max(100).optional(),
  utm_term: z.string().max(100).optional(),
});

// MailerLite bridge — env-gated (MAILERLITE_API_KEY), fail-soft by design.
// Subscriber only: custom fields would 422 until defined in the account, and
// UTM attribution already lives on the Firestore lead (docs/funnel-nurture.md).
async function pushToMailerLite(email: string) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.log("[LEAD] MailerLite not configured (MAILERLITE_API_KEY unset) — skipping bridge.");
    return;
  }
  try {
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ email, status: "active" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[LEAD] MailerLite push failed (${res.status}):`, detail.slice(0, 300));
    } else {
      console.log("[LEAD] MailerLite subscriber created.");
    }
  } catch (err: any) {
    console.error("[LEAD] MailerLite bridge error (fail-soft):", err?.message || err);
  }
}

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
  const { email, target, score, riskLevel, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = parsed.data;
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
      ...(utm_source ? { utm_source: utm_source.toLowerCase() } : {}),
      ...(utm_medium ? { utm_medium: utm_medium.toLowerCase() } : {}),
      ...(utm_campaign ? { utm_campaign } : {}),
      ...(utm_content ? { utm_content } : {}),
      ...(utm_term ? { utm_term } : {}),
      source: "landing-teaser",
      firstSeenAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
      count: FieldValue.increment(1),
    }, { merge: true });
    // Firestore write succeeded — MailerLite is best-effort and never blocks.
    await pushToMailerLite(email);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[LEAD] Write failed:", err?.message || err);
    return NextResponse.json({ error: "Could not save your email. Please try again." }, { status: 500 });
  }
}