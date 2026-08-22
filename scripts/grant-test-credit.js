import { adminDb } from "../lib/firebase-admin.ts";
const uid = process.argv[2];
if (!uid) { console.error("usage: node grant-test-credit.js <uid>"); process.exit(1); }
async function main() {
  const ref = adminDb.collection("users").doc(uid);
  await ref.set({ videoCredits: 1, updatedAt: new Date() }, { merge: true });
  const snap = await ref.get();
  console.log("GRANTED", uid, snap.data());
}
main().catch(e=>{console.error(e);process.exit(1)});
