import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";

// Shopify integration scaffold (Phase 1 of COMPETITIVE_ABSORPTION_STRATEGY.md
// — "Find creators among your customers" / product seeding). Env-gated:
// requires SHOPIFY_API_KEY + SHOPIFY_API_SECRET + APP_URL. The merchant
// (brand) installs our app on their store via OAuth; we store the offline
// access token server-side under users/{uid}/integrations/shopify.

export function shopifyConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
}

export function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://safesponsor.ai").replace(/\/$/, "");
}

export function buildInstallUrl(shop: string, state: string): string {
  const scopes = "read_customers,read_orders,write_draft_orders";
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY || "",
    scope: scopes,
    redirect_uri: `${appUrl()}/api/shopify/callback`,
    state,
    "grant_options[]": "", // offline token (no expiry)
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function validShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-_]*\.myshopify\.com$/.test(shop);
}

// Per Shopify docs: HMAC-SHA256 over sorted query params minus hmac/signature,
// hex-encoded, compared against the `hmac` param.
export function verifyHmac(query: URLSearchParams): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;
  const hmac = query.get("hmac") || "";
  const filtered = [...query.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .map(([k, v]) => `${encodeURIComponent(k).replace(/%20/g, "+")}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
    .sort()
    .join("&");
  const digest = crypto.createHmac("sha256", secret).update(filtered).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("[SHOPIFY] Token exchange failed:", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    return typeof data.access_token === "string" ? data.access_token : null;
  } catch (err: any) {
    console.error("[SHOPIFY] Token exchange error:", err?.message || err);
    return null;
  }
}

export async function saveIntegration(uid: string, shop: string, accessToken: string): Promise<void> {
  // Access tokens are stored server-side only (Admin SDK path); they are never
  // returned to the client by any API route.
  await adminDb.collection("users").doc(uid).collection("integrations").doc("shopify").set({
    shop,
    accessToken,
    connectedAt: new Date(),
  });
}
