import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 15;

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
    const body = JSON.parse(rawText);
    if (!body || !body.target) {
      return NextResponse.json({ error: "Report data is required." }, { status: 400 });
    }

    // Strip client-only fields
    const { id, ...reportData } = body;

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
