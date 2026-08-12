import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 15;

// Server-side schema for the dossier report body. Core fields are type-checked
// and length-bounded; unknown keys are preserved (.passthrough()) so report
// evolution does not silently drop data, but garbage payloads are rejected.
const sourceSchema = z.object({ title: z.string().max(500), url: z.string().max(1000) });

const saveDossierSchema = z
  .object({
    id: z.string().max(200).optional(),
    target: z.string().min(1).max(500),
    creator_summary: z.string().max(200000),
    brand_safety_score: z.number().min(-1).max(100),
    risk_level: z.string().max(50),
    audience_insights: z.record(z.string(), z.unknown()).optional(),
    controversy_and_pr_history: z.record(z.string(), z.unknown()).optional(),
    competitor_and_sponsorship_history: z.array(z.unknown()).optional(),
    nuanced_red_flags: z.array(z.unknown()).optional(),
    positive_highlights: z.array(z.string()).optional(),
    final_verdict: z.record(z.string(), z.unknown()).optional(),
    unreachable_urls: z.array(z.string()).optional(),
    brand_name: z.string().max(300).optional(),
    competitor_brands: z.array(z.string()).optional(),
    grounding_sources: z.array(sourceSchema).optional(),
    is_cached: z.boolean().optional(),
    cached_at: z.string().max(40).optional(),
    data_quality: z.enum(["full", "limited"]).optional(),
    data_quality_note: z.string().max(2000).nullable().optional(),
    createdAt: z.string().max(40).optional(),
    persisted: z.boolean().optional(),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyAuthHeader(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large. Maximum allowed request size is 1MB." }, { status: 413 });
    }

    const rawText = await request.text();
    if (rawText.length > 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large. Maximum allowed request size is 1MB." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = saveDossierSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ")
        .slice(0, 500);
      console.warn("[SAVE DOSSIER] Validation failed:", details);
      return NextResponse.json({ error: `Report data is invalid (${details}).` }, { status: 400 });
    }

    // Strip client-only fields; always stamp a fresh server-side createdAt.
    const { id, ...reportData } = parsed.data;

    const historyRef = await adminDb.collection("users").doc(uid).collection("history").add({
      ...reportData,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: historyRef.id });
  } catch (error: any) {
    console.error("[SAVE DOSSIER] Error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to save dossier." },
      { status: 500 }
    );
  }
}
