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
let appCheck: AppCheck | undefined;

if (typeof window !== "undefined") {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);

  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || config.recaptchaSiteKey;
  if (recaptchaKey && app) {
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
  } else if (process.env.NODE_ENV === "production") {
    console.warn("[SECURITY WARN] ReCAPTCHA site key is missing in production (NEXT_PUBLIC_RECAPTCHA_SITE_KEY / recaptchaSiteKey). App Check client initialization skipped.");
  }
}

export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    const tokenResult = await getToken(appCheck, false);
    return tokenResult.token;
  } catch (err) {
    console.warn("Failed to retrieve App Check token:", err);
    return null;
  }
}

export { app, auth, db, appCheck };

