import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { NextRequest } from 'next/server';
import config from '../firebase-applet-config.json';

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId || config.projectId,
      });
    } catch (parseErr) {
      console.error("[FATAL] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", parseErr);
      initializeApp({ projectId: config.projectId });
    }
  } else {
    console.warn("[WARN] FIREBASE_SERVICE_ACCOUNT not set. Falling back to project ID only — Firestore writes will fail in production.");
    initializeApp({ projectId: config.projectId });
  }
}

const adminApp = getApp();
export const adminDb = getFirestore(adminApp, config.firestoreDatabaseId || '(default)');
export const adminAuth = getAuth(adminApp);
export const adminAppCheck = getAppCheck(adminApp);

export async function verifyAppCheckHeader(req: NextRequest): Promise<{ valid: boolean; error?: string }> {
  const appCheckToken = req.headers.get("X-Firebase-AppCheck") || req.headers.get("x-firebase-appcheck");
  // Enforcement is OPT-IN (FR-4): until ENFORCE_APP_CHECK === "true" is set,
  // the server accepts missing tokens so that clients whose reCAPTCHA is
  // blocked can still sign in. A token that is PRESENT but invalid is always
  // rejected (defense in depth - broken or spoofed tokens never pass).
  const isEnforced = process.env.ENFORCE_APP_CHECK === "true";

  if (!appCheckToken) {
    if (isEnforced) {
      return { valid: false, error: "Missing App Check token" };
    }
    console.warn("[SECURITY WARN] Firebase App Check token missing (enforcement is opt-in via ENFORCE_APP_CHECK=true)");
    return { valid: true };
  }

  try {
    await adminAppCheck.verifyToken(appCheckToken);
    return { valid: true };
  } catch (error: any) {
    console.warn("Firebase App Check Token verification failed:", error?.message || error);
    return { valid: false, error: "Invalid App Check token" };
  }
}

export async function verifyAuthHeader(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.substring(7).trim();
    if (!token) return null;

    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.uid || null;
  } catch (error) {
    console.error("Firebase ID Token verification failed:", error);
    return null;
  }
}

