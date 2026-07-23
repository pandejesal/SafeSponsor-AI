import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is missing");
    }
    stripeClient = new Stripe(key, {
      apiVersion: "2025-01-27.acacia" as any, // latest stable version or fallback
    });
  }
  return stripeClient;
}

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    // Allow mock checkout if Stripe key is missing
    if (!process.env.STRIPE_SECRET_KEY) {
       console.warn("STRIPE_SECRET_KEY is missing. Using mock checkout flow.");
       return NextResponse.json({ url: `${appUrl}/dashboard?mock_success=true` });
    }

    const stripe = getStripe();

    let priceData: any = {};
    if (plan === "single") {
      priceData = {
        currency: "usd",
        product_data: {
          name: "Single Report",
          description: "One-time brand safety analysis",
        },
        unit_amount: 1000, // $10.00
      };
    } else if (plan === "subscription") {
      priceData = {
        currency: "usd",
        product_data: {
          name: "Unlimited Subscription",
          description: "Unlimited brand safety reports",
        },
        unit_amount: 19900, // $199.00
        recurring: {
          interval: "month",
        },
      };
    } else {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: priceData,
          quantity: 1,
        },
      ],
      mode: plan === "subscription" ? "subscription" : "payment",
      success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
