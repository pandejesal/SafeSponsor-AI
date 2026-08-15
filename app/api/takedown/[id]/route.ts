// M4T2 — Takedown request detail (GET, requester or admin) and admin
// decision (POST approve/deny). Approve deletes the cached audit and writes a
// tombstone that blocks future cache serving/re-caching of the key.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";

async function isAdmin(uid: string): Promise<boolean> {
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    return userDoc.exists && userDoc.data()?.role === "admin";
  } catch (err: any) {
    console.warn("[TAKEDOWN] Admin check failed:", err?.message || err);
    return false;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const appCheckOk = await verifyAppCheckHeader(req);
  if (!appCheckOk.valid) {
    return NextResponse.json({ error: "App Check verification failed" }, { status: 403 });
  }
  const uid = await verifyAuthHeader(req);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    const doc = await adminDb.collection("takedown_requests").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    const data = doc.data();
    const admin = await isAdmin(uid);
    if (data?.requesterUid !== uid && !admin) {
      return NextResponse.json({ error: "Not authorized to view this request" }, { status: 403 });
    }
    return NextResponse.json({ id: doc.id, ...data });
  } catch (err: any) {
    console.warn("[TAKEDOWN] Fetch failed:", err?.message || err);
    return NextResponse.json({ error: "Failed to fetch takedown request" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const appCheckOk = await verifyAppCheckHeader(req);
  if (!appCheckOk.valid) {
    return NextResponse.json({ error: "App Check verification failed" }, { status: 403 });
  }
  const uid = await verifyAuthHeader(req);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!(await isAdmin(uid))) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = (body as { action?: string })?.action;
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "action must be 'approve' or 'deny'" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const requestRef = adminDb.collection("takedown_requests").doc(id);
      const requestSnap = await tx.get(requestRef);
      if (!requestSnap.exists) {
        throw { code: "not_found" };
      }
      const requestData = requestSnap.data();
      if (requestData?.status !== "pending") {
        throw { code: "not_pending", status: requestData?.status };
      }
      const { targetKey, target } = requestData;

      if (action === "approve") {
        // Remove the cached audit and tombstone the key atomically with the
        // request state change so a crash can never leave a half-decision.
        tx.delete(adminDb.collection("global_audits").doc(targetKey));
        tx.set(adminDb.collection("takedown_tombstones").doc(targetKey), {
          requestId: id,
          targetKey,
          target: target || "",
          createdAt: requestData.createdAt || nowIso,
          decidedAt: nowIso,
          decidedBy: uid,
        });
        tx.update(requestRef, {
          status: "approved",
          decidedAt: nowIso,
          decidedBy: uid,
        });
        return { status: "approved", targetKey };
      }

      tx.update(requestRef, {
        status: "denied",
        decidedAt: nowIso,
        decidedBy: uid,
      });
      return { status: "denied", targetKey };
    });

    return NextResponse.json({ success: true, id, ...result });
  } catch (err: any) {
    if (err?.code === "not_found") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (err?.code === "not_pending") {
      return NextResponse.json(
        { error: "Request already decided", status: err.status },
        { status: 409 }
      );
    }
    console.warn("[TAKEDOWN] Decision failed:", err?.message || err);
    return NextResponse.json({ error: "Failed to process takedown decision" }, { status: 500 });
  }
}
