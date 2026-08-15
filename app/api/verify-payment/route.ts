import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getDodoPayments } from "@/lib/dodopayments";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // App Check posture matches /api/checkout: only App-Check-verified
    // clients may trigger payment-verification side effects.
    const appCheckResult = await verifyAppCheckHeader(req);
    if (!appCheckResult.valid) {
      return NextResponse.json(
        { error: "Unauthorized client request (App Check failed)." },
        { status: 401 }
      );
    }

    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Rate limiting (SEC-M3): money-adjacent endpoint; same transactional
    // pattern as /api/analyze. 20/min is generous for a post-payment fallback.
    const rateLimitRef = adminDb.collection("rate_limits").doc(uid);
    const rlNow = Date.now();
    try {
      const rateLimitAllowed = await adminDb.runTransaction(async (tx) => {
        const doc = await tx.get(rateLimitRef);
        const data = doc.exists ? doc.data() : { timestamps: [] };
        const windowStart = rlNow - 60000;
        const validTimestamps = (data?.timestamps || []).filter((ts: number) => typeof ts === "number" && ts > windowStart);
        if (validTimestamps.length >= 20) {
          return false;
        }
        validTimestamps.push(rlNow);
        tx.set(rateLimitRef, { timestamps: validTimestamps, updatedAt: new Date() }, { merge: true });
        return true;
      });
      if (!rateLimitAllowed) {
        return NextResponse.json({ error: "Rate limit exceeded. Please try again shortly." }, { status: 429 });
      }
    } catch (rlErr: any) {
      console.error("Rate limit transaction failure:", rlErr?.message || rlErr);
      return NextResponse.json({ error: "Rate limiting system unavailable. Please try again shortly." }, { status: 429 });
    }

    let rawBody: unknown;
    try {
      const rawText = await req.text();
      if (rawText.length > 1024 * 1024) {
        return NextResponse.json({ error: "Payload too large. Maximum allowed request size is 1MB." }, { status: 413 });
      }
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

    // P-M2: a refunded payment must never be re-claimed. The webhook writes a
    // marker under refunded_payments/{paymentId} on refund.succeeded.
    const refundMarker = await adminDb
      .collection("refunded_payments")
      .doc(paymentId)
      .get()
      .catch(() => null);
    if (refundMarker?.exists) {
      return NextResponse.json({ error: "This payment has been refunded and cannot be re-claimed." }, { status: 410 });
    }

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
      entitlementUpdate.hasSubscription = true;
      // M3T2: the intro offer is first-purchase only — stamp the flag so a
      // future checkout never re-applies the $99 discount code.
      entitlementUpdate.introProClaimed = true;
      // T6: clear the checkout in-flight marker — the intro has been claimed.
      entitlementUpdate.introPending = false;
      // P-M5: keep the subscription->user mapping fresh so renewal/refund
      // payloads (which may omit metadata.uid) can still resolve this user.
      if (matchingPayment.subscription_id) {
        entitlementUpdate.lastSubscriptionId = matchingPayment.subscription_id;
      }
    }

    try {
      await adminDb.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const existing = userSnap.exists ? userSnap.data() || {} : {};
        if (existing.lastPaymentId === paymentId) {
          throw new Error("already_granted");
        }
        if (plan === "subscription") {
          // P-M4: extend from the latest expiry (webhook parity) instead of
          // resetting to now+1mo — a stale verify-payment call must never
          // shorten an active subscription.
          const existingSub = existing.subscription && typeof existing.subscription === "object" ? existing.subscription : null;
          const existingExpiryMs = existingSub?.expiresAt ? new Date(existingSub.expiresAt).getTime() : NaN;
          const hasValidExpiry = !isNaN(existingExpiryMs) && existingExpiryMs > 0;
          const alreadyActiveForPeriod = existingSub?.status === "active" && hasValidExpiry && existingExpiryMs > Date.now() + 20 * 24 * 60 * 60 * 1000;
          let expiresAt: Date;
          if (alreadyActiveForPeriod) {
            expiresAt = new Date(existingExpiryMs);
          } else {
            const baseMs = hasValidExpiry ? Math.max(existingExpiryMs, Date.now()) : Date.now();
            expiresAt = new Date(baseMs);
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }
          entitlementUpdate.subscription = {
            status: "active",
            expiresAt: expiresAt.toISOString(),
            ...(matchingPayment.subscription_id ? { subscriptionId: matchingPayment.subscription_id } : {}),
          };
        }
        tx.set(userRef, entitlementUpdate, { merge: true });
      });
    } catch (grantErr: any) {
      if (grantErr?.message === "already_granted") {
        return NextResponse.json({ success: true, message: "Credits already granted.", alreadyCredited: true });
      }
      throw grantErr;
    }
    console.log(`[VERIFY PAYMENT] Credits granted to user ${uid.slice(0, 8)} via fallback verification (plan: ${plan}, payment: ${paymentId})`);

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
