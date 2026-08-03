import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getDodoPayments } from "@/lib/dodopayments";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      const rawText = await req.text();
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const plan = (rawBody as any)?.plan;
    if (!plan || !["single", "channel", "subscription"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    const dodo = getDodoPayments();

    // List recent succeeded payments (last 20)
    let recentPayments: any[] = [];
    try {
      const response: any = await dodo.payments.list({ status: "succeeded" });
      const raw = response?.data || response || [];
      if (Array.isArray(raw)) {
        recentPayments = raw;
      } else if (raw && typeof raw[Symbol.asyncIterator as any] === "function") {
        for await (const payment of raw) {
          recentPayments.push(payment);
          if (recentPayments.length >= 20) break;
        }
      }
    } catch (listErr: any) {
      console.error("[VERIFY PAYMENT] Failed to list payments from Dodo:", listErr?.message || listErr);
      return NextResponse.json({ error: "Failed to query payment gateway." }, { status: 502 });
    }

    // Find a payment matching this user's uid and plan
    const matchingPayment = recentPayments.find((p: any) => {
      const meta = p.metadata || {};
      return meta.uid === uid && meta.plan === plan && p.status === "succeeded";
    });

    if (!matchingPayment) {
      return NextResponse.json({ error: "No matching successful payment found." }, { status: 404 });
    }

    const paymentId = matchingPayment.payment_id || matchingPayment.id;

    // Check if this payment was already credited
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};

    if (userData.lastPaymentId === paymentId) {
      return NextResponse.json({ success: true, message: "Credits already granted.", alreadyCredited: true });
    }

    // Grant credits atomically
    const userRef = adminDb.collection("users").doc(uid);
    const entitlementUpdate: Record<string, any> = {
      lastPaymentId: paymentId,
      plan,
      paymentProvider: "dodo_payments",
      updatedAt: new Date(),
    };

    if (plan === "single") {
      entitlementUpdate.videoCredits = FieldValue.increment(1);
    } else if (plan === "channel") {
      entitlementUpdate.channelCredits = FieldValue.increment(1);
    } else if (plan === "subscription") {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      entitlementUpdate.hasSubscription = true;
      entitlementUpdate.subscription = {
        status: "active",
        expiresAt: expiresAt.toISOString(),
      };
    }

    await userRef.set(entitlementUpdate, { merge: true });
    console.log(`[VERIFY PAYMENT] Credits granted to user ${uid} via fallback verification (plan: ${plan}, payment: ${paymentId})`);

    return NextResponse.json({ success: true, message: "Credits granted.", plan });
  } catch (error: any) {
    console.error("[VERIFY PAYMENT] Error:", error?.message || error);
    return NextResponse.json({ error: "Internal error verifying payment." }, { status: 500 });
  }
}
