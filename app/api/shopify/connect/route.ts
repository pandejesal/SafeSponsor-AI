import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyAuthHeader } from "@/lib/firebase-admin";
import { buildInstallUrl, shopifyConfigured, validShopDomain } from "@/lib/shopify";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/shopify/connect?shop=<store>.myshopify.com — starts the Shopify
// OAuth install flow for the signed-in brand. CSRF-protected with a random
// state stored on the user doc and verified in the callback.

export async function GET(req: NextRequest) {
  const uid = await verifyAuthHeader(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!shopifyConfigured()) {
    return NextResponse.json(
      { error: "Shopify integration is not configured yet. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET." },
      { status: 503 }
    );
  }

  const shop = (req.nextUrl.searchParams.get("shop") || "").trim().toLowerCase();
  if (!validShopDomain(shop)) {
    return NextResponse.json({ error: "Provide a valid <store>.myshopify.com domain." }, { status: 400 });
  }

  const state = crypto.randomBytes(24).toString("hex");
  const { adminDb } = await import("@/lib/firebase-admin");
  await adminDb.collection("users").doc(uid).set(
    { shopifyOAuthState: { value: state, createdAt: new Date() } },
    { merge: true }
  );

  // JSON response (not a redirect): browser navigation cannot attach the
  // Firebase bearer header, so the client fetches this with auth, then
  // navigates itself to installUrl.
  return NextResponse.json({ ok: true, installUrl: buildInstallUrl(shop, state) });
}
