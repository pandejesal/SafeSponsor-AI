import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const ALLOWED_WEBHOOK_EVENTS = new Set([
  "payment.succeeded",
  "subscription.active",
  "checkout.completed",
  "subscription.cancelled",
  "subscription.revoked",
  "subscription.expired",
  "payment.refunded"
]);

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large. Maximum allowed request size is 1MB." }, { status: 413 });
    }

    const rawBody = await req.text();
    if (rawBody.length > 1024 * 1024) {
      return NextResponse.json({ error: "Payload body exceeds 1MB limit." }, { status: 413 });
    }

    const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

    // Optional timestamp replay window check (5 minutes max drift)
    const timestampHeader = req.headers.get("webhook-timestamp") || req.headers.get("x-webhook-timestamp");
    if (timestampHeader) {
      const ts = parseInt(timestampHeader, 10);
      if (!isNaN(ts)) {
        const nowSec = Math.floor(Date.now() / 1000);
        // Standardwebhooks timestamp is usually in seconds
        const ageSec = Math.abs(nowSec - (ts > 1e11 ? Math.floor(ts / 1000) : ts));
        if (ageSec > 300) { // > 5 minutes
          console.error(`[SECURITY REJECTION] Webhook timestamp outside allowed 5-minute replay window (Age: ${ageSec}s).`);
          return NextResponse.json({ error: "Webhook timestamp outside replay window" }, { status: 401 });
        }
      }
    }

    if (!webhookSecret) {
      console.error("[SECURITY REJECTION] DODO_PAYMENTS_WEBHOOK_SECRET is unconfigured.");
      return NextResponse.json({ error: "Webhook secret unconfigured" }, { status: 500 });
    }

    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(rawBody, {
        "webhook-id": req.headers.get("webhook-id") || req.headers.get("x-webhook-id") || "",
        "webhook-signature": req.headers.get("webhook-signature") || req.headers.get("x-dodo-signature") || req.headers.get("signature") || "",
        "webhook-timestamp": timestampHeader || "",
      });
    } catch (err: any) {
      console.error("[SECURITY REJECTION] Dodo Payments webhook signature verification failed:", err?.message || err);
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventType = body?.type || body?.event;
    const data = body?.data || body;

    // Event Whitelist check
    if (!eventType || !ALLOWED_WEBHOOK_EVENTS.has(eventType)) {
      console.log(`[PAYMENTS LOG] Unhandled or non-actionable webhook event received: ${eventType}`);
      return NextResponse.json({ received: true, ignored: true });
    }

    console.log(`[PAYMENTS LOG] Valid Dodo Payments Webhook received: ${eventType}`);

    const webhookHeaderId = req.headers.get("webhook-id") || req.headers.get("x-webhook-id");
    const paymentId = data?.payment_id || data?.id || body?.id;
    const uid = data?.metadata?.uid || data?.customer?.metadata?.uid;
    const plan = data?.metadata?.plan || "single";

    // Enforce strict Idempotency by recording the unique webhook event ID or eventType_paymentId
    const idempotencyKey = webhookHeaderId 
      ? `wh_${webhookHeaderId}` 
      : `${eventType}_${paymentId || Date.now()}`;

    if (idempotencyKey) {
      const processedRef = adminDb.collection("processed_webhooks").doc(String(idempotencyKey));
      
      try {
        // Transactionally check if this payment/event has already been processed
        const isAlreadyProcessed = await adminDb.runTransaction(async (tx) => {
          const docSnap = await tx.get(processedRef);
          if (docSnap.exists) {
            return true; // Already processed
          }
          tx.set(processedRef, {
            processedAt: new Date(),
            eventType,
            plan,
            paymentId: paymentId || null,
            uid: uid || null,
          });
          return false;
        });

        if (isAlreadyProcessed) {
          console.log(`[IDEMPOTENCY DUPLICATE] Webhook event ${idempotencyKey} already processed. Skipping duplicate entitlement.`);
          return NextResponse.json({ received: true, duplicate: true });
        }
      } catch (idempotencyErr: any) {
        console.error("[IDEMPOTENCY CRITICAL FAILURE] Could not verify/record processed webhook ID in Firestore:", idempotencyErr?.message || idempotencyErr);
        // FAIL SAFE: Return 500 so Dodo Payments will safely retry the webhook
        return NextResponse.json(
          { error: "Database transaction error during idempotency check. Retrying." },
          { status: 500 }
        );
      }
    }

    const isRevocationEvent = [
      "subscription.cancelled",
      "subscription.revoked",
      "subscription.expired",
      "payment.refunded"
    ].includes(eventType);

    let entitlementUpdate: Record<string, any> = {
      plan: plan,
      paymentProvider: "dodo_payments",
      lastPaymentId: paymentId || null,
      updatedAt: new Date(),
    };

    if (isRevocationEvent) {
      entitlementUpdate.hasSubscription = false;
      entitlementUpdate.subscription = {
        status: eventType.includes("cancelled") ? "cancelled" : "expired",
        expiresAt: new Date().toISOString(),
      };
      console.log(`[ENTITLEMENT REVOCATION] Revoking subscription/credits access due to event: ${eventType} for plan: ${plan}`);
    } else if (plan === "subscription") {
      entitlementUpdate.hasSubscription = true;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      entitlementUpdate.subscription = {
        status: "active",
        expiresAt: expiresAt.toISOString(),
      };
    } else if (plan === "single") {
      entitlementUpdate.videoCredits = FieldValue.increment(1);
    } else if (plan === "channel") {
      entitlementUpdate.channelCredits = FieldValue.increment(1);
    } else {
      entitlementUpdate.videoCredits = FieldValue.increment(1);
    }

    if (uid) {
      const userRef = adminDb.collection("users").doc(uid);
      if (isRevocationEvent && (plan === "single" || plan === "channel")) {
        await adminDb.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
          if (!userSnap.exists) {
            console.log(`[ENTITLEMENT REVOCATION] User doc ${uid} does not exist, skipping credit decrement.`);
            return;
          }
          const userData = userSnap.data() || {};
          const creditKey = plan === "single" ? "videoCredits" : "channelCredits";
          const currentVal = typeof userData[creditKey] === "number" ? userData[creditKey] : 0;
          const clampedVal = Math.max(0, currentVal - 1);

          tx.set(userRef, {
            ...entitlementUpdate,
            [creditKey]: clampedVal,
          }, { merge: true });
        });
      } else {
        await userRef.set(entitlementUpdate, { merge: true });
      }
      console.log(`[ENTITLEMENT CONFIRMED] User ${uid} updated for event: ${eventType} (plan: ${plan})`);
    } else {
      console.warn(`[SECURITY WARN] Webhook event ${eventType} skipped: Metadata UID missing from payload.`);
      return NextResponse.json({ received: true, warning: "UID metadata missing" });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[SECURITY / SYSTEM ERROR] Dodo Payments Webhook handler error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
