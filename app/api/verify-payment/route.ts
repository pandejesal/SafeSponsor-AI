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

    // List recent succeeded payments (bounded) — filter server-side by created
    // time instead of scanning the full account history.
    let recentPayments: any[] = [];
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const response: any = await dodo.payments.list({
        status: "succeeded",
        created_at_gte: cutoff.toISOString(),
        page_size: 20,
      });
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

    // Grant credits atomically: the already-credited check and the grant must
    // run in ONE transaction so two concurrent calls cannot both pass the
    // lastPaymentId check and double-grant credits.
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
      // M3T2: the intro offer is first-purchase only — stamp the flag so a
      // future checkout never re-applies the $99 discount code.
      entitlementUpdate.introProClaimed = true;
      entitlementUpdate.subscription = {
        status: "active",
        expiresAt: expiresAt.toISOString(),
      };
    }

    try {
      await adminDb.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const existing = userSnap.exists ? userSnap.data() || {} : {};
        if (existing.lastPaymentId === paymentId) {
          throw new Error("already_granted");
        }
        tx.set(userRef, entitlementUpdate, { merge: true });
      });
    } catch (grantErr: any) {
      if (grantErr?.message === "already_granted") {
        return NextResponse.json({ success: true, message: "Credits already granted.", alreadyCredited: true });
      }
      throw grantErr;
    }
    console.log(`[VERIFY PAYMENT] Credits granted to user ${uid} via fallback verification (plan: ${plan}, payment: ${paymentId})`);

    const verifySnap = await userRef.get();
    const verifyData = verifySnap.exists ? verifySnap.data() : null;
    console.log(`[VERIFY PAYMENT] Post-write verification:`, {
      exists: verifySnap.exists,
      videoCredits: verifyData?.videoCredits,
      channelCredits: verifyData?.channelCredits,
      lastPaymentId: verifyData?.lastPaymentId,
    });

    return NextResponse.json({ success: true, message: "Credits granted.", plan, debug: { videoCredits: verifyData?.videoCredits, channelCredits: verifyData?.channelCredits } });
  } catch (error: any) {
    console.error("[VERIFY PAYMENT] Error:", error?.message || error);
    return NextResponse.json({ error: "Internal error verifying payment." }, { status: 500 });
  }
}
