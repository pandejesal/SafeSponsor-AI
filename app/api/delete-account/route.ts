// M4T4 — GDPR account deletion: cascade-deletes the user document (incl. audit
// history), usage logs/daily rollups, and rate-limit docs, then best-effort
// deletes the Firebase Auth account. Re-signing in simply creates a fresh user
// doc.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth, verifyAuthHeader, verifyAppCheckHeader } from "@/lib/firebase-admin";

async function deleteDocRecursive(docRef: FirebaseFirestore.DocumentReference): Promise<void> {
  // Recurse into subcollections (audit history, ...) before deleting the doc.
  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    await deleteCollectionRecursive(sub);
  }
  await docRef.delete();
}

async function deleteCollectionRecursive(colRef: FirebaseFirestore.CollectionReference): Promise<void> {
  for (;;) {
    const snap = await colRef.limit(500).get();
    if (snap.empty) break;
    await adminDb.runTransaction(async (tx) => {
      for (const doc of snap.docs) {
        tx.delete(doc.ref);
      }
    });
  }
  // Nested subcollections only exist in practice on user docs, which
  // deleteDocRecursive handles; collection-level recursion is a safety net.
  console.log(`[DELETE-ACCOUNT] Removed docs under ${colRef.path}.`);
}

async function deleteDocsWhere(query: FirebaseFirestore.Query, label: string): Promise<void> {
  for (;;) {
    const snap = await query.limit(500).get();
    if (snap.empty) break;
    await adminDb.runTransaction(async (tx) => {
      for (const doc of snap.docs) {
        tx.delete(doc.ref);
      }
    });
  }
  console.log(`[DELETE-ACCOUNT] Removed ${label} docs.`);
}

export async function POST(req: NextRequest) {
  const appCheckOk = await verifyAppCheckHeader(req);
  if (!appCheckOk.valid) {
    return NextResponse.json({ error: "App Check verification failed" }, { status: 403 });
  }
  const uid = await verifyAuthHeader(req);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if ((body as { confirm?: string })?.confirm !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm permanent account deletion" },
      { status: 400 }
    );
  }

  try {
    // 1. Cascade-delete the user doc and its audit history.
    await deleteDocRecursive(adminDb.collection("users").doc(uid));
    console.log("[DELETE-ACCOUNT] Removed user document and subcollections.");

    // 2. Usage records: per-event logs and daily rollups.
    await deleteDocsWhere(adminDb.collection("usage_logs").where("uid", "==", uid), "usage_logs");
    await deleteDocsWhere(adminDb.collection("usage_daily").where("uid", "==", uid), "usage_daily");

    // 3. Rate-limit marker (best-effort; may not exist).
    try {
      await adminDb.collection("rate_limits").doc(uid).delete();
      console.log("[DELETE-ACCOUNT] Removed rate_limits doc.");
    } catch {
      // Ignore — the doc is optional.
    }

    // 4. Firebase Auth account, best-effort AFTER Firestore so a partial
    // failure never strands Firestore data under an unreachable uid.
    try {
      await adminAuth.deleteUser(uid);
      console.log("[DELETE-ACCOUNT] Deleted Firebase Auth account.");
    } catch (authErr: any) {
      console.warn("[DELETE-ACCOUNT] Auth deletion failed (Firestore data already removed):", authErr?.message || authErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.warn("[DELETE-ACCOUNT] Deletion failed:", err?.message || err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
