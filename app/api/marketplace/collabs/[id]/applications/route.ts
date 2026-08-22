import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";
import { serializeApplication, type ApplicationDoc, type CollabDoc } from "@/lib/marketplace";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/marketplace/collabs/[id]/applications — owner-only applications
// inbox for a collab. Emails are masked in list view; full address is
// revealed by the accept action (see PATCH /api/marketplace/applications/[id]).

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const uid = await verifyAuthHeader(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const collabSnap = await adminDb.collection("collabs").doc(id).get();
    if (!collabSnap.exists) {
      return NextResponse.json({ error: "Collab not found." }, { status: 404 });
    }
    const collab = collabSnap.data() as CollabDoc;
    if (collab.brandUid !== uid) {
      return NextResponse.json({ error: "Collab not found or not yours." }, { status: 404 });
    }

    const snap = await adminDb
      .collection("collabs")
      .doc(id)
      .collection("applications")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const applications = snap.docs.map((d) => serializeApplication(d.id, d.data() as ApplicationDoc));
    return NextResponse.json({ applications });
  } catch (err: any) {
    console.error("[MARKETPLACE] Applications list failed:", err?.message || err);
    return NextResponse.json({ error: "Could not load applications." }, { status: 500 });
  }
}
