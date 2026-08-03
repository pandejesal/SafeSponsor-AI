import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["single", "channel", "subscription"]),
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
    if (plan === "single") {
      productId = process.env.DODO_PAYMENTS_PRODUCT_ID_SINGLE || "";
    } else if (plan === "channel") {
      productId = process.env.DODO_PAYMENTS_PRODUCT_ID_CHANNEL || "";
    } else if (plan === "subscription") {
      productId = process.env.DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION || "";
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
      productId = plan === "single" ? "p_single_report" : plan === "channel" ? "p_channel_report" : "p_unlimited_sub";
    }

    const isLive = process.env.DODO_PAYMENTS_MODE === "live" || process.env.DODO_PAYMENTS_MODE === "live_mode";
    const baseUrl = isLive ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

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
            quantity: 1,
          }
        ],
        return_url: `${appUrl}/dashboard?dodo_success=true&plan=${plan}`,
        metadata: {
          uid,
          plan,
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
