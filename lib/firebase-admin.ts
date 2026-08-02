import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { NextRequest } from 'next/server';
import config from '../firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    projectId: config.projectId,
  });
}

const adminApp = getApp();
export const adminDb = getFirestore(adminApp, config.firestoreDatabaseId || '(default)');
export const adminAuth = getAuth(adminApp);
export const adminAppCheck = getAppCheck(adminApp);

export async function verifyAppCheckHeader(req: NextRequest): Promise<{ valid: boolean; error?: string }> {
  const appCheckToken = req.headers.get("X-Firebase-AppCheck") || req.headers.get("x-firebase-appcheck");
  const isProduction = process.env.NODE_ENV === "production";
  const isOptedOut = process.env.ENFORCE_APP_CHECK === "false";
  const isEnforced = isProduction && !isOptedOut;

  if (!appCheckToken) {
    if (isEnforced) {
      return { valid: false, error: "Missing App Check token" };
    }
    console.warn("[SECURITY WARN] Firebase App Check token missing (non-production / dev mode permitted)");
    return { valid: true };
  }

  try {
    await adminAppCheck.verifyToken(appCheckToken);
    return { valid: true };
  } catch (error: any) {
    console.warn("Firebase App Check Token verification failed:", error?.message || error);
    if (isEnforced) {
      return { valid: false, error: "Invalid App Check token" };
    }
    console.warn("[SECURITY WARN] Invalid App Check token permitted in non-production / dev mode");
    return { valid: true };
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

