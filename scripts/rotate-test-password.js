// rotate-test-password.js — one-off ops script (audit-2026-08-16 open item 5).
// Rotates the E2E test account password and cleans its prod test records.
// Prints status, counts, and the new password ONLY — never secrets or data.
// Run: node scripts/rotate-test-password.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const EMAIL = "pandejesal@gmail.com";
const UID_FALLBACK = "BawpZULCjAOko5NEdIEGrustnYm1";

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  let serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      JSON.parse(serviceAccountJson);
    } catch (e) {
      console.log("[WARN] .env.local FIREBASE_SERVICE_ACCOUNT is not JSON — falling back to .env.local.pulled");
      serviceAccountJson = null;
    }
  }
  if (!serviceAccountJson) {
    const pulled = loadEnv(path.join(__dirname, "..", ".env.local.pulled"));
    serviceAccountJson = pulled.FIREBASE_SERVICE_ACCOUNT;
  }
  if (!serviceAccountJson) {
    console.error("[FAIL] FIREBASE_SERVICE_ACCOUNT not found in .env.local or .env.local.pulled — cannot authenticate as admin.");
    process.exit(1);
  }

  let admin;
  try {
    admin = require("firebase-admin");
  } catch (e) {
    console.error("[FAIL] firebase-admin not installed:", e.message);
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    console.error("[FAIL] FIREBASE_SERVICE_ACCOUNT is not valid JSON:", e.message);
    process.exit(1);
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }
  const db = admin.firestore();
  const auth = admin.auth();
  console.log("[OK] Admin SDK initialized (project: " + serviceAccount.projectId + ")");

  // 1. Resolve the test user.
  let uid = null;
  try {
    const user = await auth.getUserByEmail(EMAIL);
    uid = user.uid;
    console.log("[OK] User resolved by email: " + EMAIL + " -> " + uid);
  } catch (e) {
    if (e && e.code === "auth/user-not-found") {
      console.log("[WARN] No user with email " + EMAIL + "; trying uid fallback...");
      try {
        const u = await auth.getUser(UID_FALLBACK);
        uid = u.uid;
        console.log("[OK] User resolved by uid fallback: " + uid);
      } catch (e2) {
        console.error("[FAIL] Fallback uid lookup also failed:", e2 && e2.message);
        process.exit(1);
      }
    } else {
      console.error("[FAIL] getUserByEmail error:", e && e.message);
      process.exit(1);
    }
  }

  // 2. Rotate the password.
  const newPassword = crypto.randomBytes(18).toString("base64url");
  try {
    await auth.updateUser(uid, { password: newPassword });
    console.log("[OK] Password rotated for uid " + uid);
    console.log("NEW_TEST_PASSWORD=" + newPassword);
  } catch (e) {
    console.error("[FAIL] Password rotation failed:", e.message);
    process.exit(1);
  }

  // 3. Clean prod test records (documented scope: teaser flag + history).
  const userDocRef = db.collection("users").doc(uid);
  const userDoc = await userDocRef.get();
  if (userDoc.exists) {
    const data = userDoc.data() || {};
    const fieldNames = Object.keys(data);
    console.log("[INFO] users/" + uid + " fields: " + fieldNames.join(", "));
    if ("freeTeaserUsed" in data) {
      await userDocRef.update({ freeTeaserUsed: false });
      console.log("[OK] freeTeaserUsed reset true -> false");
    }
  } else {
    console.log("[INFO] users/" + uid + " doc does not exist.");
  }

  const historyRef = db.collection("users").doc(uid).collection("history");
  const snap = await historyRef.get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log("[OK] Deleted " + snap.size + " history document(s).");
  } else {
    console.log("[INFO] No history documents to clean.");
  }

  console.log("[DONE] Test-account hygiene complete. Keep NEW_TEST_PASSWORD for future E2E runs.");
}

main().catch((e) => {
  console.error("[FATAL]", e && e.message ? e.message : e);
  process.exit(1);
});
