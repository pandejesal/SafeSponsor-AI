// M4T2 — Creator takedown requests (48h SLA). POST creates a pending request.
// Auth-required (Google sign-in) so abuse is attributable to a uid.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";
import { normalizeTargetKey } from "@/lib/analyze-pipeline";
import { slaDeadlineIso } from "@/lib/lifecycle";
import { z } from "zod";

const takedownBodySchema = z.object({
  target: z.string().min(1, "target is required").max(500, "target must be 500 chars or fewer"),
  requesterName: z.string().max(200).optional(),
  requesterEmail: z.string().email().max(200).optional(),
  details: z.string().max(4000).optional(),
});

export async function POST(req: NextRequest) {
  const appCheckOk = await verifyAppCheckHeader(req);
  if (!appCheckOk.valid) {
    return NextResponse.json({ error: "App Check verification failed" }, { status: 403 });
  }
  const uid = await verifyAuthHeader(req);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = takedownBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request body" },
      { status: 400 }
    );
  }
  const { target, requesterName, requesterEmail, details } = parsed.data;

  const targetKey = normalizeTargetKey(target);
  if (!targetKey) {
    return NextResponse.json({ error: "Could not parse target into a cache key" }, { status: 400 });
  }

  try {
    // Already tombstoned? The content is already blocked from cache serving.
    const existingTomb = await adminDb.collection("takedown_tombstones").doc(targetKey).get();
    if (existingTomb.exists) {
      return NextResponse.json(
        { error: "already_removed", message: "This target is already removed." },
        { status: 409 }
      );
    }

    // Dedupe + create atomically: a transaction prevents two concurrent POSTs
    // for the same targetKey from both passing the empty-pending check.
    const now = new Date();
    const createResult = await adminDb.runTransaction(async (tx) => {
      const pendingQuery = await tx.get(
        adminDb
          .collection("takedown_requests")
          .where("targetKey", "==", targetKey)
          .where("status", "==", "pending")
          .limit(1)
      );
      if (!pendingQuery.empty) {
        return { existing: pendingQuery.docs[0].id };
      }
      const docRef = adminDb.collection("takedown_requests").doc();
      tx.set(docRef, {
        targetKey,
        target,
        requesterUid: uid,
        requesterName: requesterName || "",
        requesterEmail: requesterEmail || "",
        details: details || "",
        status: "pending",
        createdAt: now.toISOString(),
        slaDeadline: slaDeadlineIso(now.getTime()),
      });
      return { created: docRef.id };
    });

    if (createResult.existing) {
      return NextResponse.json(
        {
          error: "already_pending",
          message: "A request for this target is already pending.",
          id: createResult.existing,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        id: createResult.created,
        status: "pending",
        targetKey,
        slaDeadline: slaDeadlineIso(now.getTime()),
        message: "Takedown request submitted. We aim to review within 48 hours.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.warn("[TAKEDOWN] Request creation failed:", err?.message || err);
    return NextResponse.json({ error: "Failed to submit takedown request" }, { status: 500 });
  }
}
