import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { getDodoPayments } from "@/lib/dodopayments";

export const runtime = "nodejs";
export const maxDuration = 60;

// P4 — post-purchase upsell: one-click Channel Report charge against the
// customer's saved card, with a standard checkout session as the fallback.
// Only "channel" is an upsell offer today; the popup gate on the client is
// the UI contract, and this endpoint is the only place a charge can fire.
const UPSELL_PLAN = "channel";

export async function POST(req: NextRequest) {
  try {
    // App Check + auth posture matches /api/checkout and /api/verify-payment:
    // only App-Check-verified clients may trigger a charge side effect.
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

    // Rate limiting (SEC-M3 parity): money-adjacent endpoint. 10/min is
    // generous for a one-click charge but bounds abuse of saved-card charges.
    const rateLimitRef = adminDb.collection("rate_limits").doc(uid);
    const rlNow = Date.now();
    try {
      const rateLimitAllowed = await adminDb.runTransaction(async (tx) => {
        const doc = await tx.get(rateLimitRef);
        const data = doc.exists ? doc.data() : { timestamps: [] };
        const windowStart = rlNow - 60000;
        const validTimestamps = (data?.timestamps || []).filter((ts: number) => typeof ts === "number" && ts > windowStart);
        if (validTimestamps.length >= 10) {
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
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if ((rawBody as any)?.plan !== UPSELL_PLAN) {
      return NextResponse.json({ error: "Invalid upsell plan." }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const channelProductId = process.env.DODO_PAYMENTS_PRODUCT_ID_CHANNEL;
    if (!channelProductId) {
      console.error("[SECURITY ERROR] Upsell requested but DODO_PAYMENTS_PRODUCT_ID_CHANNEL is unconfigured.");
      return NextResponse.json({ error: "Payment gateway is currently unconfigured. Please contact support." }, { status: 500 });
    }

    const dodo = getDodoPayments();
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    // 1) One-click path: charge the saved card on the Dodo customer from the
    //    user's prior purchase(s). confirm:true finalizes immediately.
    const customerId = typeof userData.lastDodoCustomerId === "string" ? userData.lastDodoCustomerId : null;
    if (customerId) {
      try {
        const methodsRes: any = await dodo.customers.retrievePaymentMethods(customerId);
        const rawItems = methodsRes?.items || methodsRes?.data?.items || [];
        const items = Array.isArray(rawItems) ? rawItems : [];
        const method = items.find((m: any) => m?.payment_method === "card" && m?.payment_method_id) || items[0];
        if (method?.payment_method_id) {
          try {
            const sessionRes: any = await dodo.checkoutSessions.create({
              product_cart: [{ product_id: channelProductId, quantity: 1 }],
              customer: { customer_id: customerId },
              payment_method_id: method.payment_method_id,
              confirm: true,
              return_url: `${appUrl}/dashboard?dodo_success=true&plan=${UPSELL_PLAN}`,
              metadata: { uid, plan: UPSELL_PLAN, upsell: "true" },
            });
            const paymentStatus = sessionRes?.payment_status || sessionRes?.payment?.status;
            if (paymentStatus === "succeeded") {
              console.log(`[UPSELL] One-click Channel Report charged for user ${uid.slice(0, 8)} (payment: ${sessionRes?.payment_id || "n/a"}).`);
              return NextResponse.json({ ok: true, plan: UPSELL_PLAN, paymentId: sessionRes?.payment_id || null });
            }
            // requires_customer_action (3DS) / processing / failed / null →
            // the charge did not complete; fall through to standard checkout.
            console.log(`[UPSELL] One-click payment status "${paymentStatus}"; falling back to standard checkout.`);
          } catch (oneClickErr: any) {
            console.warn(`[UPSELL] One-click charge failed for user ${uid.slice(0, 8)} (${oneClickErr?.message || oneClickErr}); falling back to standard checkout.`);
          }
        } else {
          console.log(`[UPSELL] No saved payment method for customer ${customerId}; falling back to standard checkout.`);
        }
      } catch (methodsErr: any) {
        console.warn(`[UPSELL] Payment-method lookup failed for customer ${customerId} (${methodsErr?.message || methodsErr}); falling back to standard checkout.`);
      }
    }

    // 2) Fallback: standard checkout session (same shape as /api/checkout).
    const isLive = process.env.DODO_PAYMENTS_MODE === "live" || process.env.DODO_PAYMENTS_MODE === "live_mode";
    const baseUrl = isLive ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;

    if (!apiKey) {
      console.error("[SECURITY ERROR] Upsell fallback requested but DODO_PAYMENTS_API_KEY is missing.");
      return NextResponse.json({ error: "Payment gateway is currently unconfigured. Please contact support." }, { status: 500 });
    }

    const response = await fetch(`${baseUrl}/checkouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [{ product_id: channelProductId, quantity: 1 }],
        return_url: `${appUrl}/dashboard?dodo_success=true&plan=${UPSELL_PLAN}`,
        metadata: { uid, plan: UPSELL_PLAN, upsell: "true" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[PAYMENT GATEWAY FAILURE] Upsell fallback session creation failed:", response.status, errText);
      return NextResponse.json({ error: "Failed to initialize payment session with gateway. Please try again." }, { status: 502 });
    }

    const data = await response.json();
    const checkoutUrl = data.checkout_url || data.payment_link || data.url;

    if (!checkoutUrl) {
      console.error("[PAYMENT GATEWAY ERROR] Upsell fallback response missing checkout URL:", data);
      return NextResponse.json({ error: "Payment gateway returned invalid checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ ok: false, url: checkoutUrl });
  } catch (error: any) {
    console.error("[SYSTEM ERROR] Upsell endpoint error:", error);
    return NextResponse.json({ error: "Internal upsell error" }, { status: 500 });
  }
}