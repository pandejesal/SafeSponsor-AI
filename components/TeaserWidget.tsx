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
        <div className="p-2 rounded-[8px] border flex flex-col sm:flex-row gap-2" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center gap-3 px-4 py-2 flex-1">
            <Search className="w-5 h-5 shrink-0" style={{ color: 'var(--ink-600)' }} />
            <input
              type="text"
              inputMode="url"
              aria-label={placeholder}
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full bg-transparent text-[15px] focus:outline-none"
              style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}
            />
          </div>
          <button
            type="submit"
            disabled={teaser.status === 'loading'}
            className="h-[44px] px-6 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
            style={{ background: 'var(--risk)', color: 'white', fontFamily: 'var(--font-sans)' }}
          >
            <span className="text-[11px] font-semibold tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>Free</span>
            <span>{teaser.status === 'loading' ? 'Checking…' : 'Run check'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {teaser.status === 'loading' && (
        <div className="max-w-2xl mx-auto mt-6 p-4 rounded-[8px] border" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--risk)', borderTopColor: 'transparent' }} />
            <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
              Checking via YouTube Data API + transcript • one free preview per account
            </p>
          </div>
        </div>
      )}

      {teaser.status === 'done' && teaser.score !== undefined && (
        <div className="max-w-2xl mx-auto mt-6 p-5 rounded-[8px] border text-left" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Brand Safety Score</p>
              <div className="flex items-end gap-3 mt-1">
                <span className="text-[32px] font-bold leading-none" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{teaser.score}</span>
                <span className="text-[12px] font-semibold px-2 py-1 rounded-full border" style={{ background: teaser.score >= 80 ? 'var(--score-good-bg)' : teaser.score >= 60 ? 'var(--score-warn-bg)' : 'var(--score-risk-bg)', color: teaser.score >= 80 ? 'var(--score-good)' : teaser.score >= 60 ? 'var(--score-warn)' : 'var(--score-risk)', borderColor: teaser.score >= 80 ? 'rgba(5,150,105,0.18)' : teaser.score >= 60 ? 'rgba(217,119,6,0.18)' : 'rgba(220,38,38,0.18)', fontFamily: 'var(--font-sans)' }}>
                  {teaser.riskLevel}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'rgba(15,27,46,0.08)', fontFamily: 'var(--font-sans)' }}>
              Free preview — cited
            </span>
          </div>

          {teaser.flags && teaser.flags.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Top red flags</p>
              <ul className="space-y-2">
                {teaser.flags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] rounded-[8px] px-3 py-2 border" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--risk)' }} />
                    <span>
                      <span className="font-semibold">{f.category}</span>
                      {f.description ? (
                        <span style={{ color: 'var(--ink-600)' }}> — {f.description}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checkoutError && (
            <p className="mt-4 text-[13px] font-medium" style={{ color: 'var(--score-risk)', fontFamily: 'var(--font-sans)' }}>{checkoutError}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button
              type="button"
              onClick={() => handleCheckout('single')}
              disabled={loadingPlan !== null}
              className="flex-1 h-11 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--risk)', color: 'white', fontFamily: 'var(--font-sans)' }}
            >
              <Lock className="w-4 h-4" />
              {loadingPlan === 'single' ? 'Redirecting…' : '$8 — Full dossier'}
            </button>
            <button
              type="button"
              onClick={() => handleCheckout('subscription')}
              disabled={loadingPlan !== null}
              className="flex-1 h-11 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2 border"
              style={{ background: 'white', borderColor: 'rgba(15,27,46,0.10)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
            >
              <ShieldCheck className="w-4 h-4" />
              {loadingPlan === 'subscription' ? 'Redirecting…' : '$149/mo — Pro'}
            </button>
          </div>
        </div>
      )}

      {teaser.status === 'used' && (
        <div className="max-w-2xl mx-auto mt-6 p-5 rounded-[8px] border text-left" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>{teaser.error || 'Free preview already used'}</p>
          <p className="text-[13px] mt-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
            Full dossier $8, or Unlimited Pro $149/mo.
          </p>
          <button
            type="button"
            onClick={() => handleCheckout('single')}
            className="mt-4 h-11 px-5 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2"
            style={{ background: 'var(--risk)', color: 'white', fontFamily: 'var(--font-sans)' }}
          >
            <Lock className="w-4 h-4" /> Full dossier $8
          </button>
        </div>
      )}

      {teaser.status === 'error' && (
        <div className="max-w-2xl mx-auto mt-6 p-4 rounded-[8px] border" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-[13px] font-medium" style={{ color: 'var(--score-risk)', fontFamily: 'var(--font-sans)' }}>{teaser.error}</p>
        </div>
      )}
    </div>
  );
}