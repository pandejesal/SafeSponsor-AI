'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { getAppCheckToken } from '@/lib/firebase';
import { useTheme } from '@/components/ThemeProvider';
import { AlertTriangle, ArrowRight, Lock, Search, ShieldCheck } from 'lucide-react';

// N2T2–N2T4 — shared teaser widget for the platform landing pages. Same
// contract as the homepage hero (N1T3): sign-in required, one free check per
// account, score + risk level + top red-flag headers only, result discarded
// server-side. platformHint pre-fills the placeholder for SEO relevance.
export default function TeaserWidget({ platformHint }: { platformHint?: string }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [teaser, setTeaser] = useState<{
    status: 'idle' | 'loading' | 'done' | 'used' | 'error';
    score?: number;
    riskLevel?: string;
    flags?: { category: string; description: string }[];
    error?: string;
  }>({ status: 'idle' });

  const isDark = theme === 'dark';

  const runTeaser = async (targetStr: string) => {
    if (!user) {
      router.push(`/login?target=${encodeURIComponent(targetStr)}`);
      return;
    }
    setTeaser({ status: 'loading' });
    try {
      const token = await user.getIdToken();
      const appCheckToken = await getAppCheckToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
      }
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ target: targetStr, teaser: true }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setTeaser({ status: 'used', error: data.error || 'Free teaser already used' });
        return;
      }
      if (!res.ok) {
        setTeaser({ status: 'error', error: data.error || 'Failed to run the free check. Please try again.' });
        return;
      }
      setTeaser({
        status: 'done',
        score: data.brand_safety_score,
        riskLevel: data.risk_level,
        flags: Array.isArray(data.top_red_flags) ? data.top_red_flags : [],
      });
    } catch (err) {
      console.error("Teaser error:", err);
      setTeaser({ status: 'error', error: 'Failed to connect. Please try again.' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (t) {
      runTeaser(t);
    }
  };

  const handleCheckout = async (plan: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setLoadingPlan(plan);
    setCheckoutError(null);
    try {
      const token = await user.getIdToken();
      const appCheckToken = await getAppCheckToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
      }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || "Failed to initiate checkout. Please try again.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutError("Failed to connect to checkout service.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const scoreColor = (score: number) =>
    score >= 80
      ? (isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
      : score >= 60
        ? (isDark ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200')
        : (isDark ? 'bg-red-500/15 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200');

  const placeholder = platformHint
    ? `Paste a ${platformHint} video, channel, or profile URL...`
    : 'Paste YouTube Video URL, Channel, or Instagram Link...';

  return (
    <div>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className={`p-2 rounded-lg border shadow-2xl flex flex-col sm:flex-row gap-2 transition-all ${
          isDark
            ? 'bg-zinc-900/90 border-zinc-800 focus-within:border-cyan-500/60 shadow-cyan-950/20'
            : 'bg-white border-slate-300 focus-within:border-orange-500/60 shadow-slate-200'
        }`}>
          <div className="flex items-center gap-3 px-4 py-2 flex-1">
            <Search className={`w-5 h-5 shrink-0 ${isDark ? 'text-cyan-400' : 'text-slate-400'}`} />
            <input
              type="text"
              inputMode="url"
              aria-label={placeholder}
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={`w-full bg-transparent text-sm focus:outline-none font-medium ${
                isDark ? 'text-white placeholder:text-zinc-500' : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={teaser.status === 'loading'}
            className={`py-3.5 px-7 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shrink-0 hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 ${
              isDark
                ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white hover:from-orange-500 hover:to-orange-400 shadow-orange-950/50'
                : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'
            }`}
          >
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-white/20">Free</span>
            <span>{teaser.status === 'loading' ? 'Scanning Creator…' : 'Check Any Creator Free'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {teaser.status === 'loading' && (
        <div className={`max-w-2xl mx-auto mt-6 p-5 rounded-xl border shadow-xl ${
          isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
              Running a full AI safety scan of this creator — one free check per account…
            </p>
          </div>
        </div>
      )}

      {teaser.status === 'done' && teaser.score !== undefined && (
        <div className={`max-w-2xl mx-auto mt-6 p-6 rounded-xl border shadow-xl text-left ${
          isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Brand Safety Score</p>
              <div className="flex items-end gap-3 mt-1">
                <span className="text-5xl font-black leading-none">{teaser.score}</span>
                <span className={`text-sm font-bold px-2 py-1 rounded-lg ${scoreColor(teaser.score)}`}>
                  {teaser.riskLevel}
                </span>
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
              isDark ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}>
              Free preview — full dossier requires a purchase
            </span>
          </div>

          {teaser.flags && teaser.flags.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Top Red Flags</p>
              <ul className="space-y-2">
                {teaser.flags.map((f, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                    isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" />
                    <span>
                      <span className="font-bold">{f.category}</span>
                      {f.description ? (
                        <span className="text-slate-500 dark:text-zinc-400"> — {f.description}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checkoutError && (
            <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{checkoutError}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              type="button"
              onClick={() => handleCheckout('single')}
              disabled={loadingPlan !== null}
              className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] disabled:opacity-60 ${
                isDark
                  ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-orange-950/50'
                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'
              }`}
            >
              <Lock className="w-4 h-4" />
              {loadingPlan === 'single' ? 'Redirecting…' : '$8 — Unlock the Full Dossier'}
            </button>
            <button
              type="button"
              onClick={() => handleCheckout('subscription')}
              disabled={loadingPlan !== null}
              className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border hover:scale-[1.02] disabled:opacity-60 ${
                isDark
                  ? 'bg-zinc-950 text-zinc-200 border-zinc-700 hover:border-cyan-500/50'
                  : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {loadingPlan === 'subscription' ? 'Redirecting…' : '$149/mo — Go Unlimited Pro'}
            </button>
          </div>
        </div>
      )}

      {teaser.status === 'used' && (
        <div className={`max-w-2xl mx-auto mt-6 p-5 rounded-xl border shadow-xl text-left ${
          isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">{teaser.error || 'Free teaser already used'}</p>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            Unlock the full dossier for $8, or go Unlimited Pro for $149/mo.
          </p>
          <button
            type="button"
            onClick={() => handleCheckout('single')}
            className={`mt-4 py-2.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] disabled:opacity-60 ${
              isDark
                ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            <Lock className="w-4 h-4" /> Unlock the Full Dossier
          </button>
        </div>
      )}

      {teaser.status === 'error' && (
        <div className={`max-w-2xl mx-auto mt-6 p-5 rounded-xl border shadow-xl ${
          isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{teaser.error}</p>
        </div>
      )}
    </div>
  );
}