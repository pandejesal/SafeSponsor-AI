// M4T2 — Admin takedown queue: pending requests (SLA-aware) + status counts.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const appCheckOk = await verifyAppCheckHeader(req);
  if (!appCheckOk) {
    return NextResponse.json({ error: "App Check verification failed" }, { status: 403 });
  }
  const uid = await verifyAuthHeader(req);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }
  } catch (err: any) {
    console.warn("[TAKEDOWN] Admin check failed:", err?.message || err);
    return NextResponse.json({ error: "Failed to verify admin role" }, { status: 500 });
  }

  try {
    const [pendingSnap, countsSnap] = await Promise.all([
      adminDb
        .collection("takedown_requests")
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get(),
      adminDb.collection("takedown_requests").get(),
    ]);

    const nowMs = Date.now();
    const requests = pendingSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        slaDeadlinePassed: data.slaDeadline ? nowMs > new Date(data.slaDeadline).getTime() : false,
      };
    });

    const counts = { pending: 0, approved: 0, denied: 0 };
    countsSnap.forEach((doc) => {
      const status = doc.data()?.status as keyof typeof counts;
      if (status in counts) counts[status] += 1;
    });

    return NextResponse.json({ requests, counts });
  } catch (err: any) {
    console.warn("[TAKEDOWN] Queue fetch failed:", err?.message || err);
    return NextResponse.json({ error: "Failed to fetch takedown queue" }, { status: 500 });
  }
}
