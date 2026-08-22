import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";
import { serializeCollab, type CollabDoc } from "@/lib/marketplace";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET    /api/marketplace/collabs/[id] — public detail view.
// PATCH  /api/marketplace/collabs/[id] — owner: close/reopen.
// DELETE /api/marketplace/collabs/[id] — owner delete.

async function loadCollab(id: string) {
  const snap = await adminDb.collection("collabs").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, data: snap.data() as CollabDoc };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  try {
    const found = await loadCollab(id);
    if (!found) return NextResponse.json({ error: "Collab not found." }, { status: 404 });
    return NextResponse.json({ collab: serializeCollab(found.id, found.data) });
  } catch (err: any) {
    console.error("[MARKETPLACE] Detail failed:", err?.message || err);
    return NextResponse.json({ error: "Could not load collab." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const uid = await verifyAuthHeader(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const status = (body as any)?.status;
  if (status !== "open" && status !== "closed") {
    return NextResponse.json({ error: "status must be 'open' or 'closed'." }, { status: 400 });
  }

  try {
    const ref = adminDb.collection("collabs").doc(id);
    const updated = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return false;
      const data = doc.data() as CollabDoc;
      if (data.brandUid !== uid) return false; // ownership check — do not leak existence
      tx.update(ref, { status, updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!updated) return NextResponse.json({ error: "Collab not found or not yours." }, { status: 404 });
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    console.error("[MARKETPLACE] Update failed:", err?.message || err);
    return NextResponse.json({ error: "Could not update collab." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const uid = await verifyAuthHeader(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const ref = adminDb.collection("collabs").doc(id);
    await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error("not_found");
      const data = doc.data() as CollabDoc;
      if (data.brandUid !== uid) throw new Error("forbidden");
      tx.delete(ref);
    });
    // Applications are subcollection-attached; leave them orphan-safe by also
    // deleting them best-effort (bounded by the 10-open-listings cap).
    const apps = await adminDb.collection("collabs").doc(id).collection("applications").limit(500).get();
    const batch = adminDb.batch();
    apps.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.message === "not_found" || err?.message === "forbidden") {
      return NextResponse.json({ error: "Collab not found or not yours." }, { status: 404 });
    }
    console.error("[MARKETPLACE] Delete failed:", err?.message || err);
    return NextResponse.json({ error: "Could not delete collab." }, { status: 500 });
  }
}
