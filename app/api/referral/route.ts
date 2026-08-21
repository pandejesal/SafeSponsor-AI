import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Minimal referral endpoint — free, no Dodo. Real grant via UTM on /api/lead + manual check.
// Keeps the free lever honest and AI-driven per Q: referral.

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  console.log("[REFERRAL] hit", JSON.stringify(data).slice(0, 500));
  // No entitlement mutation here — grant happens after verified purchase via UTM + webhook.
  return NextResponse.json({ ok: true });
}
