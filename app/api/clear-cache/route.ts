import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { target_key } = await request.json();
    if (!target_key) {
      return NextResponse.json({ error: "target_key required" }, { status: 400 });
    }

    const docRef = adminDb.collection("global_audits").doc(target_key);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: `No cache entry found for: ${target_key}` }, { status: 404 });
    }

    await docRef.delete();
    console.log(`[CACHE CLEAR] Deleted cache entry: ${target_key}`);
    return NextResponse.json({ success: true, deleted: target_key });
  } catch (error: any) {
    console.error("[CACHE CLEAR] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
