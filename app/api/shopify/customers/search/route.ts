import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/shopify/customers/search?q=<term> — "Find creators among your
// customers" (Phase 1 of COMPETITIVE_ABSORPTION_STRATEGY.md). Searches the
// connected store's customers by name/email and returns lightweight matches.
// Access tokens never leave the server; results are scoped to the caller's
// own store via their stored integration.

interface ShopifyCustomer {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  orders_count: number;
  total_spent: string;
  state: string;
}

async function getIntegration(uid: string): Promise<{ shop: string; accessToken: string } | null> {
  const snap = await adminDb.collection("users").doc(uid).collection("integrations").doc("shopify").get();
  if (!snap.exists) return null;
  const data = snap.data() as { shop?: string; accessToken?: string };
  return data.shop && data.accessToken ? { shop: data.shop, accessToken: data.accessToken } : null;
}

function shopifyApiFetch(shop: string, accessToken: string, path: string): Promise<Response> {
  return fetch(`https://${shop}/admin/api/2025-01/${path}`, {
    headers: { "X-Shopify-Access-Token": accessToken, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
}

export async function GET(req: NextRequest) {
  const uid = await verifyAuthHeader(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 characters to search." }, { status: 400 });
  }

  const integration = await getIntegration(uid);
  if (!integration) {
    return NextResponse.json({ error: "Connect a Shopify store first.", code: "not_connected" }, { status: 409 });
  }

  try {
    // Search by term across name/email (Shopify search query syntax).
    const res = await shopifyApiFetch(
      integration.shop,
      integration.accessToken,
      `customers/search.json?query=${encodeURIComponent(q)}&limit=25`
    );
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: "Store connection is no longer valid. Reconnect Shopify.", code: "reauth_required" }, { status: 409 });
    }
    if (!res.ok) {
      console.error("[SHOPIFY] Customer search failed:", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ error: "Could not search your store's customers." }, { status: 502 });
    }
    const data = await res.json();
    const customers = ((data.customers || []) as ShopifyCustomer[]).map((c) => ({
      id: c.id,
      email: c.email,
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "(no name)",
      ordersCount: c.orders_count || 0,
      totalSpent: parseFloat(c.total_spent || "0") || 0,
      acceptsMarketing: c.state === "subscribed",
    }));
    return NextResponse.json({ ok: true, customers });
  } catch (err: any) {
    console.error("[SHOPIFY] Customer search error:", err?.message || err);
    return NextResponse.json({ error: "Could not reach your Shopify store." }, { status: 502 });
  }
}
