import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { adminDb } from "../lib/firebase-admin";

// N4T2 — monthly belt-and-braces export of every Firestore collection to
// local JSON (the scheduled GCP backups are the primary protection; this is
// the free, inspectable fallback). Run: npm run export:db
//
// Requires FIREBASE_SERVICE_ACCOUNT (JSON string) in the environment:
//   set FIREBASE_SERVICE_ACCOUNT=<json> && npm run export:db
//
// Writes: backups/firestore-export-<ISO-date>.json  (one object keyed by
// collection name, each value an array of docs with their document ids).
// Subcollections (e.g. users/{uid}/history) are exported under
// "<collection>/<docId>/<subcollection>" keys.

const EXPORT_DIR = join(process.cwd(), "backups");
const MAX_DOCS_PER_COLLECTION = 100000;

const TOP_LEVEL = [
  "users",
  "global_audits",
  "takedown_tombstones",
  "takedown_requests",
  "usage_logs",
  "usage_alerts",
  "usage_daily",
  "rate_limits",
];

const SUBCOLLECTIONS: Record<string, string[]> = {
  users: ["history"],
};

const MAX_USERS_WALKED = 100000;

async function exportCollection(collectionName: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const snapshot = await adminDb.collection(collectionName).limit(MAX_DOCS_PER_COLLECTION).get();
  for (const doc of snapshot.docs) {
    out.push({ _id: doc.id, ...doc.data() });
  }
  console.log(`[EXPORT] ${collectionName}: ${out.length} docs`);
  return out;
}

async function exportSubcollections(docId: string, subNames: string[]): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const sub of subNames) {
    const snapshot = await adminDb
      .collection("users")
      .doc(docId)
      .collection(sub)
      .limit(MAX_DOCS_PER_COLLECTION)
      .get();
    const docs = snapshot.docs.map((d) => ({ _id: d.id, ...d.data() }));
    if (docs.length > 0) {
      result[sub] = docs;
      console.log(`[EXPORT] users/${docId}/${sub}: ${docs.length} docs`);
    }
  }
  return result;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `firestore-export-${stamp}.json`;
  const filePath = join(EXPORT_DIR, fileName);
  mkdirSync(EXPORT_DIR, { recursive: true });

  const exportBundle: {
    exportedAt: string;
    collections: Record<string, unknown>;
  } = {
    exportedAt: new Date().toISOString(),
    collections: {},
  };

  for (const coll of TOP_LEVEL) {
    try {
      exportBundle.collections[coll] = await exportCollection(coll);
    } catch (err: any) {
      console.error(`[EXPORT] FAILED ${coll}:`, err?.message || err);
      exportBundle.collections[coll] = [];
    }
  }

  // users subcollections — walk the users collection once (bounded by the
  // same cap as the top-level exports so no per-collection data is skipped
  // beyond the documented 100k bound).
  const usersSnap = await adminDb.collection("users").limit(MAX_USERS_WALKED).get();
  let subCount = 0;
  for (const userDoc of usersSnap.docs) {
    const subs = await exportSubcollections(userDoc.id, SUBCOLLECTIONS.users);
    for (const [sub, docs] of Object.entries(subs)) {
      const key = `users/${userDoc.id}/${sub}`;
      exportBundle.collections[key] = docs;
      subCount += Array.isArray(docs) ? docs.length : 0;
    }
  }
  console.log(`[EXPORT] user subcollections: ${subCount} docs`);

  writeFileSync(filePath, JSON.stringify(exportBundle, null, 2), "utf8");
  console.log(`[EXPORT] WROTE ${filePath}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("[EXPORT] Fatal:", err?.message || err);
    process.exit(1);
  }
);