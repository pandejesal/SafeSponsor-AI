import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";
import { applicationSchema, type ApplicationDoc, type CollabDoc } from "@/lib/marketplace";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/marketplace/collabs/[id]/apply — public creator application.
// Abuse controls: per-IP 5/min rate limit (hashed), per-collab cap (200),
// per-email dedup per collab, collab must be open + unexpired.

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ipRaw = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: unknown;
  try {
    const rawText = await req.text();
    if (rawText.length > 32 * 1024) {
      return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    }
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = applicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed: " + parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(", ") },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const emailNormalized = input.email.trim().toLowerCase();

  // Optional auth — attach creatorUid when signed in so brands can match
  // applications to dossiers later. Never blocks the public funnel.
  let uid: string | null = null;
  try {
    uid = await verifyAuthHeader(req);
  } catch {
    uid = null;
  }

  try {
    // Per-IP rate limit: 5 applies/min (mirrors /api/lead pattern).
    const ipKey = "mkt_ip_" + crypto.createHash("sha256").update("apply:" + ipRaw).digest("hex").slice(0, 32);
    const allowed = await adminDb.runTransaction(async (tx) => {
      const rlRef = adminDb.collection("rate_limits").doc(ipKey);
      const doc = await tx.get(rlRef);
      const data = doc.exists ? doc.data() : { timestamps: [] };
      const now = Date.now();
      const valid = (data?.timestamps || []).filter((ts: number) => typeof ts === "number" && ts > now - 60000);
      if (valid.length >= 5) return false;
      valid.push(now);
      tx.set(rlRef, { timestamps: valid, updatedAt: new Date() }, { merge: true });
      return true;
    });
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again shortly." }, { status: 429 });
    }

    await adminDb.runTransaction(async (tx) => {
      const collabRef = adminDb.collection("collabs").doc(id);
      const collabSnap = await tx.get(collabRef);
      if (!collabSnap.exists) throw new Error("not_found");
      const collab = collabSnap.data() as CollabDoc;

      if (collab.status !== "open") throw new Error("closed");
      const deadline =
        collab.applicationDeadline instanceof Date
          ? collab.applicationDeadline.getTime()
          : collab.applicationDeadline?.toDate?.().getTime?.() ?? Date.now();
      if (deadline <= Date.now()) throw new Error("expired");
      if ((collab.applicationCount || 0) >= 200) throw new Error("full");

      // Per-email dedup on this collab.
      const dedupId = crypto.createHash("sha256").update(emailNormalized).digest("hex").slice(0, 40);
      const appRef = collabRef.collection("applications").doc(dedupId);
      const existing = await tx.get(appRef);
      if (existing.exists) throw new Error("duplicate");

      const appDoc: ApplicationDoc & Record<string, unknown> = {
        collabId: id,
        brandUid: collab.brandUid,
        ...(uid ? { creatorUid: uid } : {}),
        creatorHandle: input.creatorHandle,
        platform: input.platform,
        followers: input.followers,
        email: input.email,
        emailNormalized,
        pitch: input.pitch,
        links: input.links,
        status: "pending",
        createdAt: FieldValue.serverTimestamp() as unknown as import("@/lib/marketplace").TsLike,
      };
      tx.set(appRef, appDoc);
      tx.update(collabRef, {
        applicationCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[MARKETPLACE] Application on ${id}${uid ? ` by ${uid}` : ""}`);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    const msg = err?.message;
    if (msg === "not_found") return NextResponse.json({ error: "Collab not found." }, { status: 404 });
    if (msg === "closed" || msg === "expired")
      return NextResponse.json({ error: "This collab is no longer accepting applications." }, { status: 409 });
    if (msg === "full")
      return NextResponse.json({ error: "This collab has reached its application limit." }, { status: 409 });
    if (msg === "duplicate")
      return NextResponse.json({ error: "You already applied to this collab." }, { status: 409 });
    console.error("[MARKETPLACE] Apply failed:", msg || err);
    return NextResponse.json({ error: "Could not submit application. Please try again." }, { status: 500 });
  }
}
