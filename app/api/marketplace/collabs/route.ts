import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";
import { collabCreateSchema, serializeCollab, type CollabDoc } from "@/lib/marketplace";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/marketplace/collabs — create a collab (auth required).
// GET  /api/marketplace/collabs — public board (open, unexpired) or
//       ?mine=1 for the authenticated brand's own collabs.

export async function POST(req: NextRequest) {
  const uid = await verifyAuthHeader(req);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    const rawText = await req.text();
    if (rawText.length > 64 * 1024) {
      return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    }
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = collabCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed: " + parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(", ") },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Per-user open-collab cap (anti-spam): max 10 active listings.
  try {
    const existing = await adminDb
      .collection("collabs")
      .where("brandUid", "==", uid)
      .where("status", "==", "open")
      .count()
      .get();
    if (existing.data().count >= 10) {
      return NextResponse.json(
        { error: "You already have 10 open collabs. Close one before posting another." },
        { status: 409 }
      );
    }

    // Brand display name: prefer Firebase displayName, fall back to email local part.
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const brandName =
      (typeof userData.displayName === "string" && userData.displayName.trim().slice(0, 80)) ||
      uid.slice(0, 8);

    const deadline = new Date(Date.now() + input.deadlineDays * 24 * 60 * 60 * 1000);

    const doc: CollabDoc = {
      brandUid: uid,
      brandName,
      title: input.title,
      description: input.description,
      niche: input.niche,
      platforms: input.platforms,
      minFollowers: input.minFollowers,
      compensation: {
        type: input.compensation.type,
        ...(input.compensation.amount !== undefined ? { amount: input.compensation.amount } : {}),
        currency: input.compensation.currency || "USD",
        ...(input.compensation.details ? { details: input.compensation.details } : {}),
      },
      deliverables: input.deliverables,
      applicationDeadline: deadline,
      status: "open",
      applicationCount: 0,
      createdAt: FieldValue.serverTimestamp() as unknown as CollabDoc["createdAt"],
      updatedAt: FieldValue.serverTimestamp() as unknown as CollabDoc["updatedAt"],
    };

    const ref = await adminDb.collection("collabs").add(doc as FirebaseFirestore.DocumentData);
    console.log(`[MARKETPLACE] Collab created ${ref.id} by ${uid}`);
    return NextResponse.json({ ok: true, id: ref.id }, { status: 201 });
  } catch (err: any) {
    console.error("[MARKETPLACE] Create failed:", err?.message || err);
    return NextResponse.json({ error: "Could not create collab. Please try again." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  try {
    if (mine) {
      const uid = await verifyAuthHeader(req);
      if (!uid) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      const snap = await adminDb
        .collection("collabs")
        .where("brandUid", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      const collabs = snap.docs.map((d) => serializeCollab(d.id, d.data() as CollabDoc));
      return NextResponse.json({ collabs });
    }

    // Public board: open + not expired, newest first.
    const snap = await adminDb
      .collection("collabs")
      .where("status", "==", "open")
      .orderBy("createdAt", "desc")
      .limit(60)
      .get();
    const now = Date.now();
    const collabs = snap.docs
      .map((d) => serializeCollab(d.id, d.data() as CollabDoc))
      .filter((c) => !c.applicationDeadline || new Date(c.applicationDeadline).getTime() > now);
    return NextResponse.json({ collabs });
  } catch (err: any) {
    console.error("[MARKETPLACE] List failed:", err?.message || err);
    return NextResponse.json({ error: "Could not load collabs." }, { status: 500 });
  }
}
