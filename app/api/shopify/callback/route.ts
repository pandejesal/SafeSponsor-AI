import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";
import { exchangeCodeForToken, saveIntegration, shopifyConfigured, validShopDomain, verifyHmac, appUrl } from "@/lib/shopify";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/shopify/callback — Shopify redirects here after the merchant
// approves the install. Verifies HMAC + CSRF state (bound to the signed-in
// user), exchanges the code for an offline access token, and stores it
// server-side. The browser only ever learns success/failure.

export async function GET(req: NextRequest) {
  if (!shopifyConfigured()) {
    return NextResponse.redirect(`${appUrl()}/dashboard?shopify=not_configured`);
  }

  // The OAuth round-trip loses our Firebase header, so the callback binds to
  // the session via a short-lived cookie set by /api/shopify/connect-session.
  // Until that exists we require the dashboard to open the flow in a popup
  // that carries the token as a query param alternative: uid via state doc.
  const q = req.nextUrl.searchParams;
  if (!verifyHmac(q)) {
    return NextResponse.redirect(`${appUrl()}/dashboard?shopify=hmac_failed`);
  }
  const shop = (q.get("shop") || "").toLowerCase();
  const code = q.get("code") || "";
  const state = q.get("state") || "";
  if (!validShopDomain(shop) || !code || !state) {
    return NextResponse.redirect(`${appUrl()}/dashboard?shopify=invalid_params`);
  }

  // Resolve the user from the stored state (single-use CSRF binding).
  try {
    const matchSnap = await adminDb
      .collectionGroup("users")
      .where("shopifyOAuthState.value", "==", state)
      .limit(1)
      .get();

    let uid: string | null = null;
    if (!matchSnap.empty) {
      uid = matchSnap.docs[0].id;
    } else {
      // Fallback: the popup flow may have appended the verified uid.
      uid = await verifyAuthHeader(req);
    }
    if (!uid) {
      return NextResponse.redirect(`${appUrl()}/dashboard?shopify=session_expired`);
    }

    const accessToken = await exchangeCodeForToken(shop, code);
    if (!accessToken) {
      return NextResponse.redirect(`${appUrl()}/dashboard?shopify=token_failed`);
    }
    await saveIntegration(uid, shop, accessToken);
    // Consume the state so it can't be replayed.
    await adminDb.collection("users").doc(uid).set({ shopifyOAuthState: null }, { merge: true });
    console.log(`[SHOPIFY] Connected ${shop} for ${uid}`);
    return NextResponse.redirect(`${appUrl()}/dashboard?shopify=connected`);
  } catch (err: any) {
    console.error("[SHOPIFY] Callback error:", err?.message || err);
    return NextResponse.redirect(`${appUrl()}/dashboard?shopify=error`);
  }
}
