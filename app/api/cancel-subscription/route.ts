import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";
import { getDodoPayments } from "@/lib/dodopayments";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyAuthHeader(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const userData = userDoc.data() || {};
    const subData = userData.subscription && typeof userData.subscription === "object" ? userData.subscription : null;
    const subscriptionId = subData?.subscriptionId;
    const expiresAt = subData?.expiresAt;

    if (!subscriptionId) {
      return NextResponse.json({ error: "No active subscription found." }, { status: 400 });
    }

    if (!userData.hasSubscription) {
      return NextResponse.json({ error: "Subscription is not active." }, { status: 400 });
    }

    // Check if already cancelled
    if (subData?.cancelAtPeriodEnd) {
      return NextResponse.json({
        error: "Subscription is already scheduled for cancellation.",
        expiresAt: expiresAt,
      }, { status: 400 });
    }

    // Cancel via Dodo Payments API — cancel at next billing date (no refund)
    const dodo = getDodoPayments();
    try {
      await dodo.subscriptions.update(subscriptionId, {
        cancel_at_next_billing_date: true,
        cancel_reason: "cancelled_by_customer",
      });
    } catch (dodoErr: any) {
      console.error("[CANCEL SUB] Dodo API error:", dodoErr?.message || dodoErr);
      return NextResponse.json(
        { error: `Failed to cancel subscription: ${dodoErr?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    // Update Firestore to reflect pending cancellation
    await adminDb.collection("users").doc(uid).set(
      {
        subscription: {
          ...subData,
          cancelAtPeriodEnd: true,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[CANCEL SUB] User ${uid} subscription ${subscriptionId} scheduled for cancellation. Access until: ${expiresAt}`);

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled. Access continues until the end of your billing period.",
      expiresAt: expiresAt,
    });
  } catch (error: any) {
    console.error("[CANCEL SUB] Error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to cancel subscription. Please try again." },
      { status: 500 }
    );
  }
}
