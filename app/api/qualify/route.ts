import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { verifyAuthHeader } from "@/lib/firebase-admin";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/qualify — "CreatorGPT pre-search qualification" (Phase 1 of
// COMPETITIVE_ABSORPTION_STRATEGY.md). Auth-required; converts a free-text
// campaign brief into structured collab fields that prefill /marketplace/new.
// Output is suggestions only — the user reviews and edits before publishing.

const qualifySchema = z.object({ brief: z.string().trim().min(20).max(4000) });

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short listing title, max 120 chars" },
    description: { type: Type.STRING, description: "Listing description for creators, 2-4 sentences" },
    niche: { type: Type.STRING, description: "One of: gaming, beauty, fitness, tech, finance, comedy, food, travel, fashion, education, lifestyle, other" },
    platforms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Best-fit platforms from: youtube, instagram, tiktok, twitch" },
    minFollowers: { type: Type.INTEGER, description: "Suggested minimum follower count" },
    compensationType: { type: Type.STRING, description: "One of: paid, gifted, affiliate, mixed" },
    suggestedAmountUsd: { type: Type.NUMBER, description: "Fair-market cash compensation in USD for this niche/reach; 0 if none" },
    deliverables: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Concrete deliverables, one string each, max 5" },
    rationale: { type: Type.STRING, description: "1-2 sentences on why these choices fit the brief" },
  },
  required: ["title", "description", "niche", "platforms", "minFollowers", "compensationType", "deliverables", "rationale"],
} as const;

const VALID_NICHES = new Set(["gaming", "beauty", "fitness", "tech", "finance", "comedy", "food", "travel", "fashion", "education", "lifestyle", "other"]);
const VALID_PLATFORMS = new Set(["youtube", "instagram", "tiktok", "twitch"]);
const VALID_COMP = new Set(["paid", "gifted", "affiliate", "mixed"]);

export async function POST(req: NextRequest) {
  const uid = await verifyAuthHeader(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 16 * 1024) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const parsed = qualifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Describe your campaign in at least 20 characters." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI qualification is not configured." }, { status: 503 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents:
        `You are a creator-partnerships strategist. Convert this brand brief into a collab listing ` +
        `that creators would want to apply to. Be realistic about follower minimums and fair compensation.\n\n` +
        `BRAND BRIEF:\n${parsed.data.brief}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    });
    const text = result.text || "{}";
    const raw = JSON.parse(text);

    // Sanitize against our enums before returning (never trust model output).
    const suggestion = {
      title: String(raw.title || "").slice(0, 120),
      description: String(raw.description || "").slice(0, 2000),
      niche: VALID_NICHES.has(String(raw.niche)) ? String(raw.niche) : "other",
      platforms: Array.isArray(raw.platforms)
        ? raw.platforms.map(String).filter((p: string) => VALID_PLATFORMS.has(p)).slice(0, 4)
        : ["youtube"],
      minFollowers: Math.max(0, Math.min(Number(raw.minFollowers) || 1000, 100_000_000)),
      compensationType: VALID_COMP.has(String(raw.compensationType)) ? String(raw.compensationType) : "paid",
      suggestedAmountUsd: Math.max(0, Math.min(Number(raw.suggestedAmountUsd) || 0, 1_000_000)),
      deliverables: Array.isArray(raw.deliverables)
        ? raw.deliverables.map((d: unknown) => String(d).slice(0, 140)).filter(Boolean).slice(0, 10)
        : [],
      rationale: String(raw.rationale || "").slice(0, 500),
    };
    if (!suggestion.platforms.length) suggestion.platforms = ["youtube"];
    if (!suggestion.deliverables.length) suggestion.deliverables = ["1 dedicated video"];

    return NextResponse.json({ ok: true, suggestion });
  } catch (err: any) {
    console.error("[QUALIFY] Gemini failed:", err?.message || err);
    return NextResponse.json({ error: "Could not generate a suggestion. Try rewording your brief." }, { status: 502 });
  }
}
