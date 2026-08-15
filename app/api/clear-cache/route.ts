import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthHeader } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyAuthHeader(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Admin-only: cache entries are shared across all users, so a regular
    // authenticated user must not be able to purge them for everyone.
    const adminSnap = await adminDb.collection("users").doc(uid).get();
    const adminData = adminSnap.exists ? adminSnap.data() || {} : {};
    if (adminData.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { target_key } = (body as { target_key?: unknown }) || {};
    if (!target_key || typeof target_key !== "string") {
      return NextResponse.json({ error: "target_key required" }, { status: 400 });
    }

    const docRef = adminDb.collection("global_audits").doc(target_key.slice(0, 500));
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: `No cache entry found for: ${target_key}` }, { status: 404 });
    }

    await docRef.delete();
    console.log(`[CACHE CLEAR] Deleted cache entry: ${target_key}`);
    return NextResponse.json({ success: true, deleted: target_key });
  } catch (error: any) {
    console.error("[CACHE CLEAR] Error:", error);
    return NextResponse.json({ error: "Failed to clear cache entry." }, { status: 500 });
  }
}
