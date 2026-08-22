import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";
import { APPLICATION_STATUSES, type ApplicationDoc } from "@/lib/marketplace";

export const runtime = "nodejs";
export const maxDuration = 60;

// PATCH /api/marketplace/applications/[id]?collab=<collabId>
// Owner-only decision endpoint: pending -> accepted | rejected.
// On accept, the response includes the applicant's full contact email
// (the only place unmasked PII leaves the server for this feature).

export async function PATCH(req: NextRequest) {
  const uid = await verifyAuthHeader(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const collabId = req.nextUrl.searchParams.get("collab") || "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(collabId)) {
    return NextResponse.json({ error: "Invalid collab id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const status = (body as any)?.status;
  if (!APPLICATION_STATUSES.includes(status) || status === "pending") {
    return NextResponse.json({ error: "status must be 'accepted' or 'rejected'." }, { status: 400 });
  }

  // Application doc ids are sha256-derived (40 hex chars).
  const appId = req.url.split("/applications/")[1]?.split("?")[0] || "";
  if (!/^[a-f0-9]{40}$/.test(appId)) {
    return NextResponse.json({ error: "Invalid application id." }, { status: 400 });
  }

  try {
    let email: string | null = null;
    const ok = await adminDb.runTransaction(async (tx) => {
      const collabRef = adminDb.collection("collabs").doc(collabId);
      const collabSnap = await tx.get(collabRef);
      if (!collabSnap.exists) return false;
      if ((collabSnap.data() as { brandUid?: string }).brandUid !== uid) return false;

      const appRef = collabRef.collection("applications").doc(appId);
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) return false;
      const app = appSnap.data() as ApplicationDoc;
      if ((app.status || "pending") !== "pending") throw new Error("already_decided");

      tx.update(appRef, { status, decidedAt: FieldValue.serverTimestamp() });
      email = app.email || null;
      return true;
    });

    if (!ok) return NextResponse.json({ error: "Application not found or not yours." }, { status: 404 });
    return NextResponse.json({ ok: true, status, ...(status === "accepted" && email ? { contactEmail: email } : {}) });
  } catch (err: any) {
    if (err?.message === "already_decided") {
      return NextResponse.json({ error: "This application was already decided." }, { status: 409 });
    }
    console.error("[MARKETPLACE] Decision failed:", err?.message || err);
    return NextResponse.json({ error: "Could not update application." }, { status: 500 });
  }
}
