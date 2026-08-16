import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Server-side audit history for the dashboard. The client must never read
// Firestore directly: the project enforces App Check on Firestore, and the
// client SDK's streaming channel does not attach App Check tokens, so any
// client-side listener is denied. This endpoint mirrors the old
// onSnapshot(users/{uid}/history) read through the Admin SDK instead.
export async function GET(req: NextRequest) {
  try {
    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const snap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("history")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const history = snap.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        target: data.target || data.url || "Creator Audit",
        ...data,
      };
    });

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error("[HISTORY] Error:", error?.message || error);
    return NextResponse.json({ error: "Failed to load audit history." }, { status: 500 });
  }
}