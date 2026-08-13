import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, AppCheck, getToken } from 'firebase/app-check';
import config from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let appCheck: AppCheck | null = null;

if (typeof window !== "undefined") {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  // The module-level appCheck singleton must not survive sign-out: once the
  // provider is registered, the SDK awaits its token inside signInWithRedirect.
  // A logout->login cycle in the same SPA page lifetime would otherwise
  // re-introduce the reCAPTCHA wait on the next sign-in. Reset on sign-out so
  // a fresh registration happens (gated) on the next signed-in session only.
  auth.onAuthStateChanged((user) => {
    if (!user) appCheck = null;
  });
}

// App Check is registered lazily, NEVER at boot and NEVER while the user is
// signed out. The Firebase SDK awaits the App Check token inside
// signInWithRedirect whenever the provider is registered - if reCAPTCHA is
// refused (ad blocker, privacy extension, hostile network), that wait has no
// internal timeout and sign-in hangs for ~30s before failing with the cryptic
// auth/network-request-failed. Deferring registration until a signed-in user
// exists keeps the sign-in path free of the App Check round-trip (FR-4).
function ensureAppCheck(): AppCheck | null {
  if (appCheck) return appCheck;
  if (!app || !auth || !auth.currentUser) return null;
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || config.recaptchaSiteKey;
  if (!recaptchaKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[SECURITY WARN] ReCAPTCHA site key is missing in production (NEXT_PUBLIC_RECAPTCHA_SITE_KEY / recaptchaSiteKey). App Check client initialization skipped.");
    }
    return null;
  }
  try {
    if (process.env.NODE_ENV === "development") {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn("Firebase App Check initialization failed:", err);
  }
  return appCheck;
}

export async function getAppCheckToken(): Promise<string | null> {
  const check = ensureAppCheck();
  if (!check) return null;
  try {
    // The SDK's public getToken() throws when the mint fails (reCAPTCHA
    // refused, exchange error, etc.) - never resolves with a dummy token.
    const tokenResult = await getToken(check, false);
    return tokenResult.token;
  } catch (err) {
    console.warn("Failed to retrieve App Check token:", err);
    return null;
  }
}

export { app, auth, db, appCheck };

