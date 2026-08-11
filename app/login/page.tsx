'use client';

import { useState, useEffect } from 'react';
import { signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';

function goToDashboard(router: ReturnType<typeof useRouter>) {
  const targetParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("target") : null;
  router.replace(targetParam ? `/dashboard?target=${encodeURIComponent(targetParam)}` : '/dashboard');
}

// A failed signInWithRedirect can leave a stale "pending redirect" marker in
// sessionStorage. The next getRedirectResult call then throws auth/internal-error
// and the user gets stuck in an error loop. Clear any such keys on failure paths.
function clearPendingRedirectState() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('firebase:pendingRedirect:')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch (err) {
    console.warn('Failed to clear pending redirect state:', err);
  }
}

function LoginInner() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const { user, loading } = useAuth();

  const isDark = theme === 'dark';

  // Path 1: Session already restored (e.g. redirect result resolved outside
  // this page, or a previous popup sign-in). Don't keep the user stuck on /login.
  useEffect(() => {
    if (!loading && user) {
      goToDashboard(router);
    }
  }, [loading, user, router]);

  // Path 2: Consume the pending redirect sign-in result after returning from Google.
  useEffect(() => {
    let active = true;
    getRedirectResult(auth!)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          goToDashboard(router);
        }
      })
      .catch((err: any) => {
        console.error('Redirect sign-in error:', err);
        clearPendingRedirectState();
        if (!active) return;
        if (err?.code === 'auth/internal-error') {
          setError('Sign-in failed (auth/internal-error). If this persists after retrying, confirm this domain is in Firebase Auth authorized domains and that App Check enforcement allows this domain.');
        } else {
          setError(err?.message || 'Sign-in failed. Please try again.');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      // Redirect flow is the PRIMARY sign-in path. Full-page navigation to
      // Google avoids the cross-origin popup handshake (vercel.app ->
      // firebaseapp.com) that needs third-party cookies and fails with
      // auth/internal-error when they are blocked. No explicit
      // PopupRedirectResolver is passed: the SDK's default resolver must stay
      // consistent with getRedirectResult or the pending-state match fails.
      //
      // signInWithRedirect waits on the App Check (reCAPTCHA Enterprise) token
      // before it can navigate, and that wait has NO internal timeout: when
      // reCAPTCHA is blocked (ad blocker, privacy extension, hostile network)
      // the button spins for ~30s and then fails with the cryptic
      // auth/network-request-failed. Race it with a timeout so we can surface
      // a clear message and reset the button instead.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('App Check verification timed out')), 18000)
      );
      await Promise.race([signInWithRedirect(auth!, provider), timeout]);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const code = err?.code || '';
      if (err?.message === 'App Check verification timed out') {
        setError('Google sign-in is taking too long. This usually happens when App Check\'s reCAPTCHA is blocked by an ad blocker or privacy extension. Allow google.com and gstatic.com on this site (or disable the blocker), then try again.');
      } else if (code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google sign-in. Add it to Firebase Auth → Settings → Authorized Domains, then try again.');
      } else if (code === 'auth/internal-error') {
        setError('Sign-in failed (auth/internal-error). Please clear this site\u2019s cookies and try again. If it persists, re-verify the Firebase Auth authorized domains.');
      } else if (code === 'auth/network-request-failed') {
        setError('Google sign-in could not be verified (App Check reCAPTCHA failed — often caused by ad blockers or privacy extensions blocking google.com). Allow those domains or disable the blocker, then retry.');
      } else {
        setError(err?.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      // The pending redirect marker is only valid if a redirect is actually
      // underway. On timeout/error the SDK may leave a stale marker behind
      // that breaks the next attempt with auth/internal-error.
      clearPendingRedirectState();
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
      isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Gradients */}
        {isDark ? (
          <>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-orange-600/10 blur-[100px] rounded-full pointer-events-none" />
          </>
        ) : (
          <>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-orange-500/10 blur-[100px] rounded-full pointer-events-none" />
          </>
        )}

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md relative z-10"
        >
          <div className={`backdrop-blur-xl border rounded-xl shadow-sm overflow-hidden ${
            isDark 
              ? 'bg-zinc-900/90 border-zinc-800 ring-1 ring-cyan-500/20' 
              : 'bg-white border-slate-200 ring-1 ring-slate-900/5'
          }`}>
            <div className="p-8 sm:p-10 text-center border-b border-zinc-800/20">
              <Image 
                src="/favicon.svg" 
                alt="SafeSponsor AI" 
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg mx-auto mb-4 shadow-md"
              />

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                Welcome to SafeSponsor AI
              </h1>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Sign in to access creator brand safety dossiers and historical reports.
              </p>
            </div>
            
            <div className="p-8 sm:p-10 space-y-6">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3 text-red-400"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">{error}</p>
                </motion.div>
              )}
              
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className={`w-full py-4 px-6 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 ${
                  isDark
                    ? 'bg-white hover:bg-zinc-100 text-zinc-950'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link 
                  href="/" 
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold hover:underline ${
                    isDark ? 'text-zinc-400 hover:text-cyan-400' : 'text-slate-600 hover:text-orange-600'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Website</span>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return <div className="min-h-screen dark:bg-zinc-950 bg-slate-50 dark:text-zinc-200 text-slate-900 flex items-center justify-center">Loading...</div>;
  
  return (
    <LoginInner />
  );
}
