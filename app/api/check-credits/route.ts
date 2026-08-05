import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({
        videoCredits: 0,
        channelCredits: 0,
        hasSubscription: false,
        subscriptionExpiresAt: null,
        cancelAtPeriodEnd: false,
        plan: null,
      });
    }

    const data = userDoc.data() || {};
    const sub = data.subscription && typeof data.subscription === "object" ? data.subscription : null;
    const expiresAt = sub?.expiresAt || null;
    const isSubActive = data.hasSubscription === true && expiresAt && new Date(expiresAt).getTime() > Date.now();

    return NextResponse.json({
      videoCredits: typeof data.videoCredits === "number" ? data.videoCredits : 0,
      channelCredits: typeof data.channelCredits === "number" ? data.channelCredits : 0,
      hasSubscription: isSubActive,
      subscriptionExpiresAt: expiresAt,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd === true,
      plan: data.plan || null,
    });
  } catch (error: any) {
    console.error("[CHECK CREDITS] Error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch credits." }, { status: 500 });
  }
}
