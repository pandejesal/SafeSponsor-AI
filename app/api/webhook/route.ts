import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const maxDuration = 60;

// Dodo Payments real event catalog (https://docs.dodopayments.com):
// payment.succeeded | refund.succeeded | subscription.active | subscription.renewed
// | subscription.cancelled | subscription.expired (+ many non-actionable ones)
const ALLOWED_WEBHOOK_EVENTS = new Set([
  "payment.succeeded",
  "subscription.active",
  "subscription.renewed",
  "subscription.cancelled",
  "subscription.expired",
  "refund.succeeded",
]);

const REVOCATION_EVENTS = new Set([
  "subscription.cancelled",
  "subscription.expired",
  "refund.succeeded",
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

    const eventType = body?.type;
    const data = body?.data || body;

    // Event Whitelist check
    if (!eventType || !ALLOWED_WEBHOOK_EVENTS.has(eventType)) {
      console.log(`[PAYMENTS LOG] Unhandled or non-actionable webhook event received: ${eventType}`);
      return NextResponse.json({ received: true, ignored: true });
    }

    console.log(`[PAYMENTS LOG] Valid Dodo Payments Webhook received: ${eventType}`);
    console.log(`[PAYMENTS LOG] Headers:`, {
      "webhook-id": req.headers.get("webhook-id") || req.headers.get("x-webhook-id") || "MISSING",
      "webhook-signature": (req.headers.get("webhook-signature") || req.headers.get("x-dodo-signature") || "MISSING").substring(0, 30) + "...",
      "body-keys": Object.keys(body || {}),
      "data-keys": Object.keys(data || {}),
      "metadata": data?.metadata || body?.metadata || "MISSING",
    });

    const webhookHeaderId = req.headers.get("webhook-id") || req.headers.get("x-webhook-id");
    const paymentId = data?.payment_id || data?.id || body?.id || null;
    const subscriptionId = data?.subscription_id || data?.subscription?.id || data?.payment?.subscription_id || null;

    // Resolve plan: any subscription-scoped event or a payment/refund that
    // carries a subscription id is always a subscription grant or revocation,
    // even when the payload lacks the original checkout metadata. This prevents
    // a subscription.cancelled/refund from being misread as a "single" plan
    // and wrongly decrementing a video credit.
    let plan = data?.metadata?.plan || "single";
    const isSubscriptionContextEvent =
      eventType.startsWith("subscription.") ||
      (eventType === "payment.succeeded" && subscriptionId) ||
      (eventType === "refund.succeeded" && subscriptionId);
    if (isSubscriptionContextEvent) {
      plan = "subscription";
    }

    // Resolve UID: direct metadata first, then fall back to the stored
    // subscription->user mapping (renewal and refund payloads may not
    // carry the original checkout metadata).
    let uid: string | null = null;
    const uidCandidates = [
      data?.metadata?.uid,
      data?.customer?.metadata?.uid,
      data?.subscription?.metadata?.uid,
      data?.subscription?.customer?.metadata?.uid,
    ];
    uid = uidCandidates.find((candidate: any) => typeof candidate === "string" && candidate.trim() !== "") || null;

    if (!uid && subscriptionId) {
      try {
        const lookup = await adminDb.collection("users").where("lastSubscriptionId", "==", subscriptionId).limit(1).get();
        if (!lookup.empty) {
          uid = lookup.docs[0].id;
          console.log(`[UID RESOLUTION] Resolved uid ${uid} from subscriptionId ${subscriptionId}.`);
        }
      } catch (lookupErr: any) {
        console.warn(`[UID RESOLUTION] Subscription fallback lookup failed for ${subscriptionId}:`, lookupErr?.message || lookupErr);
      }
    }

    // Enforce strict Idempotency by recording the unique webhook event ID or eventType_paymentId
    const idempotencyKey = webhookHeaderId
      ? `wh_${webhookHeaderId}`
      : `${eventType}_${paymentId || Date.now()}`;

    let idempotencyRefPath: string | null = null;
    if (idempotencyKey) {
      idempotencyRefPath = `processed_webhooks/${String(idempotencyKey)}`;
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

    const isRevocationEvent = REVOCATION_EVENTS.has(eventType);

    let entitlementUpdate: Record<string, any> = {
      plan: plan,
      paymentProvider: "dodo_payments",
      lastPaymentId: paymentId || null,
      updatedAt: new Date(),
    };
    if (subscriptionId) {
      entitlementUpdate.lastSubscriptionId = subscriptionId;
    }

    if (isRevocationEvent) {
      entitlementUpdate.hasSubscription = false;
      if (eventType.includes("cancelled")) {
        // For cancelled subscriptions, keep access until the current period ends
        const currentExpiry = data?.subscription?.current_period_end || data?.current_period_end;
        entitlementUpdate.subscription = {
          status: "cancelled",
          expiresAt: currentExpiry ? new Date(currentExpiry).toISOString() : new Date().toISOString(),
        };
      } else {
        entitlementUpdate.subscription = {
          status: "expired",
          expiresAt: new Date().toISOString(),
        };
      }
      console.log(`[ENTITLEMENT REVOCATION] Revoking subscription/credits access due to event: ${eventType} for plan: ${plan}`);
    } else if (plan === "subscription") {
      entitlementUpdate.hasSubscription = true;
      entitlementUpdate.subscription = { status: "active" };
    } else if (plan === "single") {
      entitlementUpdate.videoCredits = FieldValue.increment(1);
    } else if (plan === "channel") {
      entitlementUpdate.channelCredits = FieldValue.increment(1);
    } else {
      console.warn(`[SECURITY WARN] Webhook event ${eventType} skipped: Unknown plan type "${plan}".`);
      return NextResponse.json({ received: true, warning: "Unknown plan type" });
    }

    if (!uid) {
      console.warn(`[SECURITY WARN] Webhook event ${eventType} skipped: Metadata UID missing from payload and no subscription mapping found.`);
      return NextResponse.json({ received: true, warning: "UID metadata missing" });
    }

    const userRef = adminDb.collection("users").doc(uid);

    try {
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
    } else if (plan === "subscription") {
      // Subscription grants: extend from the latest expiry, but never double-extend
      // when payment.succeeded + subscription.active (or subscription.renewed) arrive
      // for the same billing period.
      await adminDb.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const nowMs = Date.now();

        const existingSub = userData.subscription && typeof userData.subscription === "object" ? userData.subscription : null;
        const existingExpiryMs = existingSub?.expiresAt ? new Date(existingSub.expiresAt).getTime() : NaN;
        const hasValidExpiry = !isNaN(existingExpiryMs) && existingExpiryMs > 0;
        // Treat subscriptions expiring more than 20 days out as already granted
        // for the current billing period (fresh grant or renewal already applied).
        const alreadyActiveForPeriod = existingSub?.status === "active" && hasValidExpiry && existingExpiryMs > nowMs + 20 * 24 * 60 * 60 * 1000;

        let expiresAt: Date;
        if (alreadyActiveForPeriod) {
          expiresAt = new Date(existingExpiryMs);
        } else {
          const baseMs = hasValidExpiry ? Math.max(existingExpiryMs, nowMs) : nowMs;
          expiresAt = new Date(baseMs);
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        tx.set(userRef, {
          ...entitlementUpdate,
          hasSubscription: true,
          subscription: {
            status: "active",
            expiresAt: expiresAt.toISOString(),
          },
        }, { merge: true });
      });
      console.log(`[ENTITLEMENT CONFIRMED] Subscription granted/extended for user ${uid} via event: ${eventType}`);
    } else {
      await userRef.set(entitlementUpdate, { merge: true });
      console.log(`[ENTITLEMENT CONFIRMED] User ${uid} updated for event: ${eventType} (plan: ${plan})`);
    }
    } catch (grantErr: any) {
      // If the entitlement write fails AFTER the idempotency record was created,
      // delete the record so Dodo's retry re-processes the event. Without this,
      // the event would be skipped forever and the customer never gets their
      // credits/subscription.
      console.error(`[ENTITLEMENT WRITE FAILURE] Grant failed for user ${uid} (${eventType}); clearing idempotency record so a retry can reprocess.`, grantErr?.message || grantErr);
      if (idempotencyRefPath) {
        try {
          await adminDb.doc(idempotencyRefPath).delete();
        } catch (cleanupErr: any) {
          console.warn("[ENTITLEMENT WRITE FAILURE] Failed to clear idempotency record; a retry may skip this event.", cleanupErr?.message || cleanupErr);
        }
      }
      throw grantErr;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[SECURITY / SYSTEM ERROR] Dodo Payments Webhook handler error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
