import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["single", "single_3pack", "channel", "subscription", "subscription_annual"]),
  customerEmail: z.string().email().max(255).optional().or(z.literal("")),
  customerName: z.string().max(100).optional().or(z.literal("")),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const appCheckResult = await verifyAppCheckHeader(req);
    if (!appCheckResult.valid) {
      return NextResponse.json(
        { error: "Unauthorized client request (App Check failed)." },
        { status: 401 }
      );
    }

    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to request checkout." },
        { status: 401 }
      );
    }

    let rawBody: unknown;
    try {
      const rawText = await req.text();
      if (rawText.length > 1024 * 1024) {
        return NextResponse.json({ error: "Payload too large. Maximum allowed request size is 1MB." }, { status: 413 });
      }
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parseResult = checkoutSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed: " + parseResult.error.issues.map(e => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { plan, customerEmail, customerName } = parseResult.data;
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;

    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        console.error("[SECURITY ERROR] Checkout requested but DODO_PAYMENTS_API_KEY is missing in production.");
        return NextResponse.json(
          { error: "Payment gateway is currently unconfigured. Please contact support." },
          { status: 500 }
        );
      }
      
      console.warn("[DEV MODE] DODO_PAYMENTS_API_KEY is missing. Redirecting to dev success simulation.");
      return NextResponse.json({ 
        url: `${appUrl}/dashboard?dev_checkout_sim=true&plan=${plan || 'subscription'}` 
      });
    }

    let productId = "";
    // P6 — the 3-pack is its own $19 product (Dodo quantity multiplies the
    // unit price, so a discounted pack needs a dedicated product). The grant
    // side resolves the credit count via metadata qty.
    const grantQty = plan === "single_3pack" ? 3 : 1;
    const grantPlan = plan === "single_3pack" ? "single" : plan;
    if (plan === "single") {
      productId = process.env.DODO_PAYMENTS_PRODUCT_ID_SINGLE || "";
    } else if (plan === "single_3pack") {
      productId = process.env.DODO_PAYMENTS_PRODUCT_ID_SINGLE_3PACK || "";
    } else if (plan === "channel") {
      productId = process.env.DODO_PAYMENTS_PRODUCT_ID_CHANNEL || "";
    } else if (plan === "subscription") {
      productId = process.env.DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION || "";
    } else if (plan === "subscription_annual") {
      productId = process.env.DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION_ANNUAL || "";
    } else {
      return NextResponse.json({ error: "Invalid plan type specified" }, { status: 400 });
    }

    if (!productId) {
      if (process.env.NODE_ENV === "production") {
        console.error(`[SECURITY ERROR] Missing required Dodo product ID environment variable for '${plan}' plan in production.`);
        return NextResponse.json(
          { error: `Payment gateway product ID unconfigured for ${plan} plan. Please contact support.` },
          { status: 500 }
        );
      }
      // Dev mode fallback
      productId = plan === "single" || plan === "single_3pack" ? "p_single_report" : plan === "channel" ? "p_channel_report" : plan === "subscription" ? "p_unlimited_sub" : "p_unlimited_sub_annual";
    }

    const isLive = process.env.DODO_PAYMENTS_MODE === "live" || process.env.DODO_PAYMENTS_MODE === "live_mode";
    const baseUrl = isLive ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

    // M3T2 — First-purchase Pro intro ($99 vs $149): Dodo supports pre-applied
    // discount codes on checkout sessions (`discount_codes`, applied in order at
    // session creation). We use a flat $50-off code created in the Dodo dashboard
    // instead of a separate intro product. The webhook / verify-payment stamp
    // `introProClaimed` on the user doc after the first successful subscription
    // grant, so the intro applies exactly once per user; a second purchase bills
    // the full $149. If the env var is unset, or the flag read fails, we fail open
    // to the full price (never risk granting the intro twice).
    // T6 — concurrent double-intro window: the read+apply happens inside ONE
    // Firestore transaction that also stamps `introPending`. Two parallel first
    // checkouts can no longer both read introProClaimed=false: the loser sees
    // introPending and pays full price.
    // P-M3 — a stale pending marker (checkout abandoned mid-session) BLOCKS
    // re-application until a grant clears it. The old TTL self-heal let a user
    // open two discounted sessions (abandon one >30 min, complete the other,
    // then complete the first) and get two months at $99.
    let discountCodes: string[] | undefined;
    if (plan === "subscription") {
      const introCode = process.env.DODO_PAYMENTS_DISCOUNT_CODE_PRO_INTRO;
      if (introCode) {
        try {
          const userRef = adminDb.collection("users").doc(uid);
          const introClaimed = await adminDb.runTransaction(async (tx) => {
            const userSnap = await tx.get(userRef);
            const data = userSnap.exists ? userSnap.data() || {} : {};
            if (data.introProClaimed === true) return false;
            if (data.introPending === true) return false;
            tx.set(userRef, {
              introPending: true,
              introPendingAt: new Date().toISOString(),
              updatedAt: new Date(),
            }, { merge: true });
            return true;
          });
          if (introClaimed) {
            discountCodes = [introCode];
            console.log(`[CHECKOUT] Applying Pro intro discount code for uid ${uid.slice(0, 8)} (first purchase).`);
          } else {
            console.log(`[CHECKOUT] Intro already claimed or in flight for uid ${uid.slice(0, 8)}; full price.`);
          }
        } catch (introErr: any) {
          console.warn(`[CHECKOUT] introProClaimed check failed for uid ${uid.slice(0, 8)}; proceeding at full price.`, introErr?.message || introErr);
        }
      }
    }

    const response = await fetch(`${baseUrl}/checkouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: productId,
            // P6 — the 3-pack is a dedicated $19 product (Dodo has no volume
            // discount: quantity would multiply the unit price, 3x$8=$24).
            // Cart quantity is always 1; the credit grant resolves via
            // metadata qty below.
            quantity: 1,
          }
        ],
        ...(discountCodes ? { discount_codes: discountCodes } : {}),
        ...(customerEmail ? { customer: { email: customerEmail, ...(customerName ? { name: customerName } : {}) } } : {}),
        // P6 — the 3-pack lands the user on the same "single" success page so
        // the post-purchase upsell popup appears for both single and 3-pack.
        return_url: `${appUrl}/dashboard?dodo_success=true&plan=${grantPlan}`,
        metadata: {
          uid,
          // Grant-side plan: webhook/verify-payment resolve "single" and read
          // qty for the credit count. The popup decision also reads this value.
          plan: grantPlan,
          ...(grantQty > 1 ? { qty: String(grantQty) } : {}),
          ...(discountCodes ? { introApplied: "true" } : {}),
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[PAYMENT GATEWAY FAILURE] Dodo Payments API creation failed:", response.status, errText);
      return NextResponse.json(
        { error: "Failed to initialize payment session with gateway. Please try again." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const checkoutUrl = data.checkout_url || data.payment_link || data.url;

    if (!checkoutUrl) {
      console.error("[PAYMENT GATEWAY ERROR] Dodo Payments response missing checkout URL:", data);
      return NextResponse.json(
        { error: "Payment gateway returned invalid checkout URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: any) {
    console.error("[SYSTEM ERROR] Checkout endpoint error:", error);
    return NextResponse.json({ error: "Internal checkout error" }, { status: 500 });
  }
}
