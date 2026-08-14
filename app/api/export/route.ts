// M4T3 — GDPR data export: bundles the user's profile, audit history, and all
// usage records as a JSON download. Admin-only ?uid= allows exporting another
// user on request.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";

async function listAllDocs(query: FirebaseFirestore.Query): Promise<FirebaseFirestore.DocumentData[]> {
  // Firestore pagination: page 500 at a time until exhausted.
  const acc: FirebaseFirestore.DocumentData[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let page = query.limit(500);
    if (cursor) page = page.startAfter(cursor);
    const snap = await page.get();
    for (const doc of snap.docs) acc.push({ id: doc.id, ...doc.data() });
    if (snap.docs.length < 500) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return acc;
}

export async function GET(req: NextRequest) {
  const appCheckOk = await verifyAppCheckHeader(req);
  if (!appCheckOk) {
    return NextResponse.json({ error: "App Check verification failed" }, { status: 403 });
  }
  const uid = await verifyAuthHeader(req);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let targetUid = uid;
  const paramUid = req.nextUrl.searchParams.get("uid");
  if (paramUid) {
    try {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (!userDoc.exists || userDoc.data()?.role !== "admin") {
        return NextResponse.json({ error: "Admin role required to export another user" }, { status: 403 });
      }
    } catch (err: any) {
      console.warn("[EXPORT] Admin check failed:", err?.message || err);
      return NextResponse.json({ error: "Failed to verify admin role" }, { status: 500 });
    }
    targetUid = paramUid;
  }

  try {
    const userDoc = await adminDb.collection("users").doc(targetUid).get();
    const [history, usageLogs, usageDaily] = await Promise.all([
      listAllDocs(adminDb.collection("users").doc(targetUid).collection("history")),
      listAllDocs(adminDb.collection("usage_logs").where("uid", "==", targetUid).orderBy("ts", "asc")),
      listAllDocs(adminDb.collection("usage_daily").where("uid", "==", targetUid).orderBy("day", "asc")),
    ]);

    const bundle = {
      exportedAt: new Date().toISOString(),
      uid: targetUid,
      user: userDoc.exists ? userDoc.data() : null,
      history,
      usageLogs,
      usageDaily,
    };

    const dateStamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="safesponsor-export-${targetUid}-${dateStamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.warn("[EXPORT] Export failed:", err?.message || err);
    return NextResponse.json({ error: "Failed to export account data" }, { status: 500 });
  }
}
