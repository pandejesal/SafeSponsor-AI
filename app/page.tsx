'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getAppCheckToken } from '@/lib/firebase';
import { Navbar } from '@/components/Navbar';
import { MethodDiagram } from '@/components/MethodDiagram';
import { TestModeBadge } from '@/components/TestModeBadge';
import { useTheme } from '@/components/ThemeProvider';
import { motion, MotionConfig } from 'motion/react';

// Dynamic import — SSR disabled for R3F WebGL
const DynamicRadarGlobe = dynamic(
  () => import('@/components/RadarGlobe').then((m) => m.RadarGlobe),
  { ssr: false, loading: () => <div className="w-full h-[300px] rounded-[16px] animate-pulse" style={{ background: 'var(--paper-100)' }} /> }
);
import { 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  DollarSign, 
  Search, 
  Video, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Users, 
  Lock, 
  ExternalLink, 
  Zap, 
  HelpCircle, 
  ChevronDown, 
  ArrowRight,
  TrendingUp,
  Award,
  Check,
  X,
  Mail
} from 'lucide-react';
function LandingContent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  // P6 — Single Report pack choice: 1 report ($8) or the 3-pack ($19, ~21% off).
  const [singlePack, setSinglePack] = useState<'one' | 'three'>('one');
  const [heroInputUrl, setHeroInputUrl] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [teaser, setTeaser] = useState<{
    status: 'idle' | 'loading' | 'done' | 'used' | 'error';
    score?: number;
    riskLevel?: string;
    flags?: { category: string; description: string }[];
    error?: string;
    target?: string;
  }>({ status: 'idle' });
  // P7 — optional email capture on the teaser result ("Email me the full
  // dossier"). Stored as a retargeting lead; nothing is emailed today.
  const [leadEmail, setLeadEmail] = useState('');
  const [leadState, setLeadState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [leadError, setLeadError] = useState('');
  // Funnel attribution — read UTM params directly from the URL at submit time
  // (they never change mid-session) and attach them to the lead capture so
  // /api/lead can store which campaign brought the user.
  const utmFromUrl = (): Record<string, string> => {
    const params = new URLSearchParams(window.location.search);
    const picked: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = params.get(key)?.trim().slice(0, 100);
      if (v) picked[key] = v;
    }
    return picked;
  };

  const submitLead = async () => {
    const email = leadEmail.trim();
    if (!email || leadState === 'sending') return;
    setLeadState('sending');
    setLeadError('');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          target: teaser.target || heroInputUrl.trim(),
          score: teaser.score,
          riskLevel: teaser.riskLevel,
          ...utmFromUrl(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLeadError(data.error || 'Could not save your email. Please try again.');
        setLeadState('error');
        return;
      }
      setLeadState('done');
    } catch (err) {
      console.error("Lead capture error:", err);
      setLeadError('Failed to connect. Please try again.');
      setLeadState('error');
    }
  };

  const isDark = theme === 'dark';

  // L2 reveal — IntersectionObserver (web-motion-design, 150-220ms, prefers-reduced-motion)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // N1T3 — hero teaser: a free, once-per-device-and-account headline check
  // (score + risk level + top red-flag headers only). Works WITHOUT sign-in
  // (P7); the server gates it on a never-expiring per-IP marker plus the
  // account marker. The result is discarded server-side, so a purchase
  // re-runs the full pipeline.
  const runTeaser = async (targetStr: string) => {
    setTeaser({ status: 'loading' });
    try {
      const token = user ? await user.getIdToken() : null;
      const appCheckToken = await getAppCheckToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
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
        target: targetStr,
      });
    } catch (err) {
      console.error("Teaser error:", err);
      setTeaser({ status: 'error', error: 'Failed to connect. Please try again.' });
    }
  };

  const handleHeroAudit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = heroInputUrl.trim();
    if (t) {
      runTeaser(t);
    } else {
      router.push(user ? '/dashboard' : '/login');
    }
  };

  const teaserScoreColor = (score: number) =>
    score >= 80
      ? (isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
      : score >= 60
        ? (isDark ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200')
        : (isDark ? 'bg-red-500/15 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200');

  // N1T3/N1T5 — teaser upsell: $8 full dossier primary, $149 Pro secondary.
  const renderTeaserUpsell = () => (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={() => handleCheckout('single')}
        className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] ${
          isDark
            ? 'bg-gradient-to-r from-risk to-risk text-white shadow-orange-950/50'
            : 'bg-[var(--risk)] hover:bg-orange-700 text-white shadow-orange-200'
        }`}
      >
        <Lock className="w-4 h-4" />
        $8 — Unlock the Full Dossier
      </button>
      <button
        type="button"
        onClick={() => handleCheckout('subscription')}
        className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border hover:scale-[1.02] ${
          isDark
            ? 'bg-[var(--ink)] text-zinc-200 border-zinc-700 hover:border-[var(--ink)]-500/50'
            : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500'
        }`}
      >
        <ShieldCheck className="w-4 h-4" />
        $149/mo — Go Unlimited Pro
      </button>
    </div>
  );

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

  // Comparison table rows: "yes"/"no" render as check/cross icons.
  const compareFeatures = [
    { label: "Audit scope", values: ["1 video or short", "Full channel / profile", "Unlimited"] },
    { label: "Transcript parsing", values: ["Full video", "Multi-video", "Unlimited"] },
    { label: "Comment toxicity audit", values: ["50 comments", "Deep audit", "Unlimited"] },
    { label: "Competitor conflict check", values: ["yes", "yes", "yes"] },
    { label: "Contract safeguards generator", values: ["no", "yes", "yes"] },
    { label: "Print-ready PDF dossier", values: ["no", "no", "yes"] },
    { label: "Batch multi-URL queue", values: ["no", "no", "yes"] },
  ];

  const faqs = [
    {
      q: "How does SafeSponsor AI perform brand safety vetting?",
      a: "Our multi-pass AI engine extracts full video transcripts, samples the 50 most recent comments via the YouTube Data API to audit audience sentiment/toxicity, searches web press and social media for controversy, and checks for competitor conflicts."
    },
    {
      q: "Can I analyze Instagram creators as well as YouTube videos?",
      a: "Yes! You can input YouTube video/Shorts URLs, YouTube channel handles, or Instagram creator profile links and brand handles to analyze potential risk before signing sponsorship deals."
    },
    {
      q: "What happens if a creator has no controversy or negative press?",
      a: "SafeSponsor AI explicitly verifies clean history and outputs a high Brand Safety Score (90-100/100), along with suggested contractual safeguards to keep your brand protected."
    },
    {
      q: "How are YouTube comments analyzed for toxicity?",
      a: "We fetch the top 50 recent comments directly from YouTube and pass them through Gemini sentiment models to surface recurring toxic themes (e.g. scam complaints, hate speech, bot spam) so you know true audience sentiment."
    },
    {
      q: "Can I export reports for my PR team or clients?",
      a: "Yes! Every generated dossier includes a formatted summary dashboard, a print/PDF-ready layout, and JSON/CSV export for agency client presentations."
    },
    {
      q: "Is there a free trial?",
      a: "Every account gets one free brand safety check: the headline score plus the top red-flag headers, no card required. Full dossiers are available on paid plans."
    },
    {
      q: "Can I cancel my subscription anytime?",
      a: "Yes. Cancel anytime from your dashboard. Your access continues until the end of your current billing period."
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept all major credit and debit cards through our secure payment provider, Dodo Payments."
    }
  ];

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen pb-16 md:pb-0" style={{ background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <Navbar />

        {/* HERO — Ink Auditor: calm auditor + risk radar, serif display, UGC masonry */}
        <section id="hero" className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-20" style={{ background: 'linear-gradient(180deg, var(--paper) 0%, rgba(246,242,239,0.4) 100%)' }}>
          {/* Subtle radial accent behind globe */}
          <div className="absolute right-0 top-0 w-[600px] h-[600px] opacity-[0.04] pointer-events-none" style={{ background: 'radial-gradient(circle at center, var(--line) 0%, transparent 70%)' }} aria-hidden />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-start">
              <div className="lg:col-span-7 text-left">
                {/* Eyebrow — 13px label, no Zap, no Evidence-backed */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6"
                  style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--risk)' }} aria-hidden />
                  <span className="text-[13px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                    Evidence-backed - PII-scrubbed - 90-day cache
                  </span>
                </motion.div>

                {/* Headline — serif display, not font-bold */}
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 }}
                  className="text-[40px] sm:text-[56px] lg:text-[72px] leading-[1.05] max-w-[640px] mb-4"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--ink)' }}
                >
                  Catch the risk
                  <br />
                  <span style={{ color: 'var(--ink-600)', fontStyle: 'italic' }}>before your client does.</span>
                </motion.h1>

                {/* Subtitle — calm auditor, source-linked */}
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="text-[18px] leading-[1.6] max-w-[560px] mb-8"
                  style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}
                >
                  Brand safety checks for agencies. Transcripts, 50 comments via YouTube Data API v3, channel history and web-grounded controversies — scored, cited, and ready for procurement.
                </motion.p>
              </div>

              {/* UGC Masonry — real creator proof, not lucide wallpaper */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="lg:col-span-5 hidden lg:block"
                aria-hidden
              >
                {/* 3D Risk Radar — WebGL globe of creator points + scanning rings */}
                <div className="relative rounded-[16px] overflow-hidden border" style={{ background: 'rgba(246,242,239,0.5)', borderColor: 'rgba(15,27,46,0.06)' }}>
                  <DynamicRadarGlobe isDark={isDark} />
                </div>
                {/* Anonymized score chips */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[
                    { label: 'Gaming', score: 82, tone: 'good' },
                    { label: 'Beauty', score: 64, tone: 'warn' },
                    { label: 'Finance', score: 41, tone: 'risk' },
                    { label: 'Fitness', score: 91, tone: 'good' },
                    { label: 'Comedy', score: 58, tone: 'warn' },
                    { label: 'Tech', score: 77, tone: 'good' },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="rounded-[8px] border p-2 flex items-center justify-between"
                      style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)' }}
                    >
                      <span className="text-[11px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}>{c.label}</span>
                      <span
                        className="text-[12px] font-bold px-1.5 py-0.5 rounded-full border"
                        style={{
                          background: c.tone === 'good' ? 'var(--score-good-bg)' : c.tone === 'warn' ? 'var(--score-warn-bg)' : 'var(--score-risk-bg)',
                          color: c.tone === 'good' ? 'var(--score-good)' : c.tone === 'warn' ? 'var(--score-warn)' : 'var(--score-risk)',
                          borderColor: c.tone === 'good' ? 'rgba(5,150,105,0.18)' : c.tone === 'warn' ? 'rgba(217,119,6,0.18)' : 'rgba(220,38,38,0.18)',
                        }}
                      >
                        {c.score}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] mt-2 text-center" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  Example scores — anonymized, not real reports. Full dossiers are source-cited.
                </p>
              </motion.div>
            </div>
            <div className="mt-2 lg:mt-0">

          {/* INTERACTIVE AUDIT SEARCH BAR */}
          <motion.form
            onSubmit={handleHeroAudit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-2xl mx-auto mb-12"
          >
            <div
              className="p-2 rounded-[8px] border flex flex-col sm:flex-row gap-2 transition-colors"
              style={{ background: 'white', borderColor: 'rgba(15,27,46,0.12)', boxShadow: 'var(--shadow-md)' }}
            >
              <div className="flex items-center gap-3 px-4 py-2 flex-1">
                <Search className="w-5 h-5 shrink-0" style={{ color: 'var(--ink-600)' }} />
                <input
                  type="text"
                  inputMode="url"
                  aria-label="Enter YouTube video, channel, or Instagram creator URL"
                  placeholder="Paste YouTube video, channel, or Instagram link…"
                  value={heroInputUrl}
                  onChange={(e) => setHeroInputUrl(e.target.value)}
                  className="w-full bg-transparent text-[15px] focus:outline-none"
                  style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}
                />
              </div>
              <button
                type="submit"
                disabled={teaser.status === 'loading'}
                className="h-[44px] px-6 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 transition-colors"
                style={{ background: 'var(--risk)', color: 'white', fontFamily: 'var(--font-sans)' }}
              >
                <span className="text-[11px] font-semibold tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>Free</span>
                <span>{teaser.status === 'loading' ? 'Checking…' : 'Run check'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {teaser.status === 'loading' && (
              <div className="max-w-2xl mt-6 p-4 rounded-[8px] border" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.10)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--risk)', borderTopColor: 'transparent' }} />
                  <p className="text-[14px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                    Checking via YouTube Data API + transcript • one free preview per device
                  </p>
                </div>
              </div>
            )}

            {teaser.status === 'done' && teaser.score !== undefined && (
              <div className={`max-w-2xl mx-auto mt-6 p-6 rounded-xl border shadow-xl text-left ${
                isDark ? 'bg-[var(--ink-900)]/90 border-zinc-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Brand Safety Score</p>
                    <div className="flex items-end gap-3 mt-1">
                      <span className="text-5xl font-bold leading-none">{teaser.score}</span>
                      <span className={`text-sm font-bold px-2 py-1 rounded-lg ${teaserScoreColor(teaser.score)}`}>
                        {teaser.riskLevel}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                    isDark ? 'bg-[var(--ink)]-500/15 text-[var(--ink)]-300 border-[var(--ink)]-500/30' : 'bg-blue-50 text-blue-900 border-blue-200'
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
                          isDark ? 'bg-[var(--ink)] border border-zinc-800' : 'bg-slate-50 border border-slate-200'
                        }`}>
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--risk)]" />
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

                {/* P7 — optional email capture: retargeting lead, nothing sent today */}
                <div className={`mt-5 p-4 rounded-xl border ${
                  isDark ? 'bg-[var(--ink)] border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  {leadState === 'done' ? (
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      Saved! We&apos;ll follow up at <span className="font-bold">{leadEmail.trim()}</span> about your full dossier.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-bold">Email me the full dossier — $8</p>
                      <div className="flex flex-col sm:flex-row gap-2 mt-2">
                        <input
                          type="email"
                          value={leadEmail}
                          onChange={(e) => { setLeadEmail(e.target.value); setLeadState('idle'); }}
                          placeholder="you@brand.com"
                          aria-label="Email address for the full dossier"
                          className={`flex-1 px-3.5 py-2.5 rounded-lg text-sm border outline-none focus:ring-2 ${
                            isDark
                              ? 'bg-[var(--ink-900)] border-zinc-700 text-white placeholder:text-zinc-500 focus:ring-risk/40'
                              : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-risk/30'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={submitLead}
                          disabled={leadState === 'sending' || !leadEmail.trim()}
                          className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                            isDark ? 'bg-[var(--risk)] hover:bg-[var(--risk)] text-white' : 'bg-[var(--risk)] hover:bg-orange-700 text-white'
                          }`}
                        >
                          <Mail className="w-4 h-4" />
                          {leadState === 'sending' ? 'Saving…' : 'Get the full dossier'}
                        </button>
                      </div>
                      <p className={`text-[11px] mt-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                        Enter your email and we&apos;ll reach out with your full dossier. No spam, unsubscribe anytime.
                      </p>
                      {leadState === 'error' && (
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-2">{leadError}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-6 pt-5 border-t border-slate-200 dark:border-zinc-800">
                  {renderTeaserUpsell()}
                </div>
              </div>
            )}

            {teaser.status === 'used' && (
              <div className={`max-w-2xl mx-auto mt-6 p-6 rounded-xl border shadow-xl text-center ${
                isDark ? 'bg-[var(--ink-900)]/90 border-zinc-800' : 'bg-white border-slate-200'
              }`}>
                <p className="font-bold text-lg">You&apos;ve already used your free check on this device</p>
                <p className={`text-sm mt-1 mb-5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Unlock the full dossier to see the complete safety breakdown.
                </p>
                {renderTeaserUpsell()}
              </div>
            )}

            {teaser.status === 'error' && (
              <div className={`max-w-2xl mx-auto mt-6 p-5 rounded-xl border shadow-xl text-left ${
                isDark ? 'bg-[var(--ink-900)]/90 border-zinc-800' : 'bg-white border-slate-200'
              }`}>
                <p className="font-bold text-red-600 dark:text-red-400">{teaser.error}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push(user ? '/dashboard' : '/login')}
              className={`text-sm font-medium underline underline-offset-4 ${
                isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              or explore the dashboard
            </button>
            <p className={`text-xs mt-3 flex items-center justify-center gap-4 ${
              isDark ? 'text-zinc-500' : 'text-slate-500'
            }`}>
              <span className="flex items-center gap-1.5"><Video className="w-4 h-4 text-red-500" /> YouTube Videos & Shorts</span>
              <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 text-pink-500" /> Instagram Posts & Handles</span>
            </p>
          </motion.form>

          {/* Source-linked metrics — kills synthetic #7 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl pt-6"
          >
            {[
              { metric: '90-day cache', label: 'Hashed, PII-scrubbed repeat', cite: 'SHA-256 of URL' },
              { metric: '50 comments', label: 'YouTube Data API v3', cite: 'Top recent, not sampled' },
              { metric: 'Web-grounded', label: 'Controversy scan', cite: 'Search + transcript' },
              { metric: '~60 sec', label: 'Dossier generation', cite: 'Gemini → Groq fallback' },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 + idx * 0.06, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="p-4 rounded-[8px] border text-center"
                style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                  {stat.metric}
                </div>
                <div className="text-[12px] font-medium mt-0.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  {stat.label}
                </div>
                <div className="text-[11px] mt-1 font-medium tracking-[0.04em]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
                  {stat.cite}
                </div>
              </motion.div>
            ))}
          </motion.div>
          </div>{/* close mt-2 */}
        </div>{/* close max-w */}
      </section>

      {/* DOSSIER PREVIEW — honest excerpt, no blur (kills #5) */}
      <section id="demo" className="py-20 border-y" style={{ background: 'var(--paper-100)', borderColor: 'rgba(15,27,46,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10">
            <p className="text-[13px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ fontFamily: 'var(--font-sans)', color: 'var(--risk)' }}>An honest preview</p>
            <h2 className="text-[32px] sm:text-[48px] leading-[1.1] mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              A dossier that cites its sources.
            </h2>
            <p className="text-[16px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
              No blurred paywall. Below is an <span style={{ color: 'var(--ink)', fontWeight: 600 }}>anonymized example</span> — real structure, synthetic excerpt — so you can judge the method before you pay.
            </p>
          </div>

          {/* Example dossier card — 8px audit, not 16px marketing */}
          <motion.div
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 16 }}
            viewport={{ once: true }}
            className="rounded-[8px] border p-6 sm:p-7 relative overflow-hidden"
            style={{ background: 'white', borderColor: 'rgba(15,27,46,0.10)', boxShadow: 'var(--shadow-md)' }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6" style={{ borderBottom: '1px solid rgba(15,27,46,0.08)' }}>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold tracking-[0.08em] uppercase px-2 py-1 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'rgba(15,27,46,0.08)', fontFamily: 'var(--font-sans)' }}>Example • Anonymized</span>
                  <span className="text-[12px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Gaming creator • transcript + 50 comments • web-grounded</span>
                </div>
                <h3 className="text-[20px] font-semibold" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Example excerpt — not a real report</h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-3 rounded-[8px] border text-center" style={{ background: 'var(--score-good-bg)', borderColor: 'rgba(5,150,105,0.18)' }}>
                  <div className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--score-good)', fontFamily: 'var(--font-sans)' }}>Brand Safety Score</div>
                  <div className="text-[24px] font-bold" style={{ color: 'var(--score-good)', fontFamily: 'var(--font-sans)' }}>82 / 100</div>
                </div>
                <div className="px-4 py-3 rounded-[8px] border text-center" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)' }}>
                  <div className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--zinc-400)', fontFamily: 'var(--font-sans)' }}>Recommendation</div>
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>Sponsor with terms</div>
                </div>
              </div>
            </div>

            {/* Grid — honest, not blurred */}
            <div className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Box 1: Comment Audit — source-linked */}
              <div className="p-4 rounded-[8px] border space-y-2.5" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-[0.08em] uppercase flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                    <Users className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} /> Comment audit — 50 via API
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: 'var(--score-good-bg)', color: 'var(--score-good)', borderColor: 'rgba(5,150,105,0.18)', fontFamily: 'var(--font-sans)' }}>98% positive</span>
                </div>
                <p className="text-[13px] leading-[1.5]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  50 top comments • PII-scrubbed • toxicity themes extracted via Gemini. Example: authentic technical Q&A, no scam clustering.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'rgba(15,27,46,0.08)', fontFamily: 'var(--font-sans)' }}>YouTube Data API v3</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'rgba(15,27,46,0.08)', fontFamily: 'var(--font-sans)' }}>Top recent</span>
                </div>
              </div>

              {/* Box 2: Transcript — source-linked */}
              <div className="p-4 rounded-[8px] border space-y-2.5" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-[0.08em] uppercase flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                    <FileText className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} /> Transcript • youtube-transcript
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'rgba(15,27,46,0.08)', fontFamily: 'var(--font-sans)' }}>4,200 words</span>
                </div>
                <p className="text-[13px] leading-[1.5]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  Full transcript parsed for profanity, hate, and political risk. Example: no flags in this excerpt.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'rgba(15,27,46,0.08)', fontFamily: 'var(--font-sans)' }}>PG-13 clean</span>
                </div>
              </div>

              {/* Box 3: Exclusivity — source-linked */}
              <div className="p-4 rounded-[8px] border space-y-2.5" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-[0.08em] uppercase flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                    <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} /> Exclusivity • web-grounded
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: 'var(--score-good-bg)', color: 'var(--score-good)', borderColor: 'rgba(5,150,105,0.18)', fontFamily: 'var(--font-sans)' }}>No direct conflicts</span>
                </div>
                <p className="text-[13px] leading-[1.5]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  60-day web search for competitor sponsorships. Example: no direct competitor deals found.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'rgba(15,27,46,0.08)', fontFamily: 'var(--font-sans)' }}>Grounded search</span>
                </div>
              </div>
            </div>

            </div>
            <div className="mt-6 pt-5 flex flex-col sm:flex-row gap-3 items-center justify-between" style={{ borderTop: '1px solid rgba(15,27,46,0.08)' }}>
              <p className="text-[12px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                Full dossier adds PR history, competitor timeline, audience toxicity themes, and contract safeguards — all footnoted.
              </p>
              <a
                href="/login"
                className="h-10 px-5 rounded-[8px] text-[14px] font-semibold inline-flex items-center gap-2 shrink-0"
                style={{ background: 'var(--risk)', color: 'white', fontFamily: 'var(--font-sans)' }}
              >
                Run a free check
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS — calm auditor, serif H2 */}
      <section id="how-it-works" className="py-16 border-t" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <p className="text-[13px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ fontFamily: 'var(--font-sans)', color: 'var(--risk)' }}>
            How it works
          </p>
          <h2 className="text-[32px] sm:text-[44px] leading-[1.1] mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            From URL to dossier in about a minute.
          </h2>
          <p className="text-[16px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
            Paste, scan via APIs, get a cited report — no black-box promises.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {[
            {
              step: "01",
              title: "Input Target Creator",
              desc: "Paste any YouTube video link, Shorts URL, channel handle, or Instagram creator profile.",
              icon: Search,
              color: isDark ? "text-[var(--ink)]-400" : "text-blue-900"
            },
            {
              step: "02",
              title: "Multi-Pass AI Research",
              desc: "We extract transcripts, query 50 recent comments via YouTube Data API, and search grounded web sources.",
              icon: Activity,
              color: "text-[var(--risk)]"
            },
            {
              step: "03",
              title: "Execute & Export Dossier",
              desc: "Get an executive score, community toxicity breakdown, competitor log, and contractual safeguards.",
              icon: FileText,
              color: isDark ? "text-[var(--ink)]-400" : "text-blue-900"
            }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 16 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="p-7 rounded-[16px] border flex flex-col justify-between"
              style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[32px] leading-none" style={{ fontFamily: 'var(--font-display)', color: 'rgba(15,27,46,0.12)', fontWeight: 400 }}>{item.step}</span>
                  <div className="w-10 h-10 rounded-[8px] border grid place-items-center" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)', color: 'var(--ink-600)' }}>
                    <item.icon className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-[18px] font-semibold mb-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{item.title}</h3>
                <p className="text-[14px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      {/* FEATURES — editorial, not lucide wallpaper */}
      <section id="features" className="py-16 border-t" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10">
            <p className="text-[13px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ fontFamily: 'var(--font-sans)', color: 'var(--risk)' }}>Platform</p>
            <h2 className="text-[32px] sm:text-[44px] leading-[1.1] mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              Everything to answer “should we sponsor?”
            </h2>
            <p className="text-[16px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
              For performance marketers, PR, and agencies — same pipeline, cited.
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-4">
            {/* Feature 1 — 8-col */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="p-7 rounded-[16px] border md:col-span-8"
              style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="w-10 h-10 rounded-[8px] border grid place-items-center mb-5" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)', color: 'var(--ink-600)' }}>
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-[20px] font-semibold mb-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Comment audit — 50 via YouTube Data API v3</h3>
              <p className="text-[14px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                Fetches top recent comments, PII-scrubbed. Recurring themes — scam, harassment, bot spam — surfaced with citations.
              </p>
            </motion.div>

            {/* Feature 2 — 4-col */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
              className="p-7 rounded-[16px] border md:col-span-4"
              style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="w-10 h-10 rounded-[8px] border grid place-items-center mb-5" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)', color: 'var(--ink-600)' }}>
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-[18px] font-semibold mb-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Transcript parser</h3>
              <p className="text-[14px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                Full transcript for profanity, hate, or political claims — word-level, cited.
              </p>
            </motion.div>

            {/* Feature 3 — 4-col */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
              className="p-7 rounded-[16px] border md:col-span-4"
              style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="w-10 h-10 rounded-[8px] border grid place-items-center mb-5" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)', color: 'var(--ink-600)' }}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-[18px] font-semibold mb-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Exclusivity check</h3>
              <p className="text-[14px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                60-day web-grounded sweep for rival sponsorships. Verified or flagged, not guessed.
              </p>
            </motion.div>

            {/* Feature 4 — 8-col */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
              className="p-7 rounded-[16px] border md:col-span-8"
              style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="w-10 h-10 rounded-[8px] border grid place-items-center mb-5" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)', color: 'var(--ink-600)' }}>
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-[20px] font-semibold mb-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Contract safeguards, not buzzwords</h3>
              <p className="text-[14px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                Tailored clauses for the flagged risk — procurement-ready, not “bulletproof” boilerplate.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <MethodDiagram />

      {/* PRICING — procurement table, not 4 flashy cards (L2 scroll reveal #4) */}
      <motion.div
        id="pricing"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="py-16 border-t"
        style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10">
          <p className="text-[13px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ fontFamily: 'var(--font-sans)', color: 'var(--risk)' }}>Pricing</p>
          <h2 className="text-[32px] sm:text-[44px] leading-[1.1] mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Predictable. Procurement-ready.
          </h2>
          <p className="text-[16px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
            Pay per report or subscribe for unlimited audits. No “Save 21%” gimmicks — just clear unit economics.
          </p>
          <p className="text-[12px] mt-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
            Via Dodo Payments. Cancel anytime. Free preview before you pay.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
            {[
              { icon: ShieldCheck, label: 'Dodo Payments' },
              { icon: CheckCircle2, label: 'No card for free check' },
              { icon: Lock, label: 'Cancel anytime' },
            ].map((t, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                <t.icon className="w-3.5 h-3.5" style={{ color: 'var(--score-good)' }} />
                {t.label}
              </span>
            ))}
          </div>
          <div className="mt-4"><TestModeBadge /></div>
        </div>

        {checkoutError && (
          <div className={`max-w-md mx-auto mb-8 p-4 rounded-xl border text-sm font-medium text-center ${
            isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {checkoutError}
          </div>
        )}

        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 items-stretch">
          {/* PLAN 1 — Single */}
          <motion.div
            className="rounded-[16px] border p-6 flex flex-col justify-between transition-transform duration-200 ease-out hover:-translate-y-0.5"
            style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div>
              <h3 className="text-[18px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Single video report</h3>
              <p className="text-[13px] leading-[1.5] mb-5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                One video or Short — full audit, cited.
              </p>
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="text-[36px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{singlePack === 'three' ? '$19' : '$8'}</span>
                <span className="text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  {singlePack === 'three' ? '/ 3 reports' : '/ report'}
                </span>
              </div>

              <div className="inline-flex items-center rounded-[8px] border p-1 mb-6 text-[12px] font-semibold" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setSinglePack('one')}
                  aria-pressed={singlePack === 'one'}
                  className="px-3 py-1 rounded-[6px] transition-colors"
                  style={{
                    background: singlePack === 'one' ? 'white' : 'transparent',
                    color: singlePack === 'one' ? 'var(--ink)' : 'var(--ink-600)',
                    boxShadow: singlePack === 'one' ? 'var(--shadow-sm)' : 'none',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  1 report
                </button>
                <button
                  type="button"
                  onClick={() => setSinglePack('three')}
                  aria-pressed={singlePack === 'three'}
                  className="px-3 py-1 rounded-[6px] transition-colors inline-flex items-center gap-1.5"
                  style={{
                    background: singlePack === 'three' ? 'white' : 'transparent',
                    color: singlePack === 'three' ? 'var(--ink)' : 'var(--ink-600)',
                    boxShadow: singlePack === 'three' ? 'var(--shadow-sm)' : 'none',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  3-pack $19
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1 py-0.5 rounded" style={{ background: 'var(--score-good-bg)', color: 'var(--score-good)' }}>Save 21%</span>
                </button>
              </div>
              <ul className="space-y-2.5 mb-6 text-[13px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Transcript parsing</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>50 comments via API</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Competitor check</span></li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout(singlePack === 'three' ? "single_3pack" : "single")}
              disabled={loadingPlan !== null}
              className="w-full h-11 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--ink)', color: 'white', fontFamily: 'var(--font-sans)' }}
            >
              {loadingPlan === "single" || loadingPlan === "single_3pack" ? <Activity className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
              <span>{singlePack === 'three' ? 'Buy 3 ($19)' : 'Buy single ($8)'}</span>
            </button>
          </motion.div>

          {/* PLAN 2 — Channel */}
          <motion.div
            className="rounded-[16px] border p-6 flex flex-col justify-between transition-transform duration-200 ease-out hover:-translate-y-0.5"
            style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div>
              <h3 className="text-[18px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Channel audit</h3>
              <p className="text-[13px] leading-[1.5] mb-5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                Full channel history + audience scan.
              </p>
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="text-[36px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>$19</span>
                <span className="text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>/ channel</span>
              </div>
              <ul className="space-y-2.5 mb-6 text-[13px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Multi-video scan</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Deep comment audit</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Safeguards + PDF</span></li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout("channel")}
              disabled={loadingPlan !== null}
              className="w-full h-11 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--ink)', color: 'white', fontFamily: 'var(--font-sans)' }}
            >
              {loadingPlan === "channel" ? <Activity className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
              <span>Buy channel ($19)</span>
            </button>
          </motion.div>

          {/* PLAN 3 — Pro (risk border only, no gradient) */}
          <motion.div
            className="rounded-[16px] border p-6 flex flex-col justify-between transition-transform duration-200 ease-out hover:-translate-y-0.5 relative"
            style={{ background: 'white', borderColor: 'var(--risk)', boxShadow: 'var(--shadow-md)' }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase border" style={{ background: 'var(--risk)', color: 'white', borderColor: 'var(--risk)', fontFamily: 'var(--font-sans)' }}>
              For agencies
            </div>

            <div>
              <h3 className="text-[18px] font-semibold mb-1.5 mt-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Unlimited Pro</h3>
              <p className="text-[13px] leading-[1.5] mb-5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                For agencies and PR teams. Start with one report — upgrade when needed.
              </p>

              <div className="inline-flex items-center rounded-[8px] border p-1 mb-6 text-[12px] font-semibold" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setBillingCycle('month')}
                  aria-pressed={billingCycle === 'month'}
                  className="px-3 py-1 rounded-[6px] transition-colors"
                  style={{
                    background: billingCycle === 'month' ? 'white' : 'transparent',
                    color: billingCycle === 'month' ? 'var(--ink)' : 'var(--ink-600)',
                    boxShadow: billingCycle === 'month' ? 'var(--shadow-sm)' : 'none',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('year')}
                  aria-pressed={billingCycle === 'year'}
                  className="px-3 py-1 rounded-[6px] transition-colors inline-flex items-center gap-1.5"
                  style={{
                    background: billingCycle === 'year' ? 'white' : 'transparent',
                    color: billingCycle === 'year' ? 'var(--ink)' : 'var(--ink-600)',
                    boxShadow: billingCycle === 'year' ? 'var(--shadow-sm)' : 'none',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Annual
                  <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: 'var(--paper-100)', color: 'var(--ink-600)' }}>Save 17%</span>
                </button>
              </div>

              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="text-[36px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{billingCycle === 'year' ? '$1,490' : '$149'}</span>
                <span className="text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  {billingCycle === 'year' ? '/ year' : '/ month'}
                </span>
                {billingCycle === 'year' && (
                  <span className="ml-2 text-[11px] font-semibold px-2 py-1 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'rgba(15,27,46,0.08)', fontFamily: 'var(--font-sans)' }}>
                    2 months free
                  </span>
                )}
              </div>
              <ul className="space-y-2.5 mb-6 text-[13px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Unlimited audits</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Gemini + Groq research</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>PDF dossiers</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Batch queue (20)</span></li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout(billingCycle === 'year' ? "subscription_annual" : "subscription")}
              disabled={loadingPlan !== null}
              className="w-full h-11 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--risk)', color: 'white', fontFamily: 'var(--font-sans)' }}
            >
              {loadingPlan === "subscription" || loadingPlan === "subscription_annual" ? <Activity className="w-5 h-5 animate-spin" /> : <Award className="w-5 h-5" />}
              <span>Subscribe Pro ({billingCycle === 'year' ? '$1,490/yr' : '$149/mo'})</span>
            </button>
          </motion.div>

          {/* PLAN 4 — Enterprise (dashed, procurement) */}
          <motion.div
            className="rounded-[16px] border border-dashed p-6 flex flex-col justify-between"
            style={{ background: 'var(--paper-100)', borderColor: 'rgba(15,27,46,0.14)' }}
          >
            <div>
              <h3 className="text-[18px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Agency / Enterprise</h3>
              <p className="text-[13px] leading-[1.5] mb-5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                Hundreds of placements, bespoke compliance.
              </p>
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>Custom</span>
              </div>
              <ul className="space-y-2.5 mb-6 text-[13px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Volume & annual pricing</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>White-label & API</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} /><span>Onboarding + SLA</span></li>
              </ul>
            </div>
            <a
              href="mailto:pandejesal@gmail.com?subject=Agency%2FEnterprise%20Plan%20Inquiry%20%E2%80%94%20SafeSponsor%20AI"
              className="w-full h-11 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center gap-2 border"
              style={{ background: 'white', borderColor: 'rgba(15,27,46,0.14)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
            >
              <ExternalLink className="w-5 h-5" />
              <span>Contact sales</span>
            </a>
          </motion.div>
        </div>

        <div className="text-center mt-8">
          <p className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
            Not sure? Start with a single $8 report — upgrade to Unlimited Pro anytime. Cancel whenever.
          </p>
        </div>

        {/* COMPARISON TABLE — structural pricing clarity (L2 scroll reveal #5) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
          className="mt-16 max-w-5xl mx-auto"
        >
          <h3 className="text-xl sm:text-2xl font-bold text-center mb-8">
            Compare Plans at a Glance
          </h3>
          <div className={`overflow-x-auto rounded-xl border ${
            isDark ? 'border-zinc-800' : 'border-slate-200'
          }`}>
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr className={`${isDark ? 'bg-[var(--ink-900)]/80' : 'bg-slate-50'}`}>
                  <th className="text-left px-6 py-4 font-bold">Feature</th>
                  <th className={`px-4 py-4 text-center font-bold border-l ${
                    isDark ? 'border-zinc-800' : 'border-slate-200'
                  }`}>
                    Single
                    <span className={`block text-xs font-semibold mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{singlePack === 'three' ? '$19 / 3 reports' : '$8 / report'}</span>
                  </th>
                  <th className={`px-4 py-4 text-center font-bold border-l ${
                    isDark ? 'border-zinc-800' : 'border-slate-200'
                  }`}>
                    Channel
                    <span className={`block text-xs font-semibold mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>$19 / audit</span>
                  </th>
                  <th className="px-4 py-4 text-center font-bold border-l" style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)' }}>
                    Unlimited Pro
                    <span className="block text-xs font-semibold mt-0.5" style={{ color: 'var(--risk)', fontFamily: 'var(--font-sans)' }}>{billingCycle === 'year' ? '$1,490 / year' : '$149 / month'}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 dark:divide-zinc-800/40">
                {compareFeatures.map((row, i) => (
                  <tr key={i} className={`transition-colors hover:bg-[var(--risk-50)] ${i % 2 === 1 ? 'bg-[var(--paper)]' : ''}`}>
                    <td className={`px-6 py-3.5 font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                      {row.label}
                    </td>
                    {row.values.map((v, j) => (
                      <td
                        key={j}
                        className={`px-4 py-3.5 text-center border-l ${j === 2 ? 'bg-[var(--risk-50)]' : ''}`}
                        style={{ borderColor: 'rgba(15,27,46,0.08)' } as React.CSSProperties}
                      >
                        {v === "yes" ? (
                          <Check className="w-4 h-4 mx-auto text-emerald-500" />
                        ) : v === "no" ? (
                          <X className="w-4 h-4 mx-auto text-zinc-500 dark:text-zinc-600" />
                        ) : (
                          <span className={`font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
        </div>{/* close max-w-7xl */}
      </motion.div>

      <motion.div
        id="faq"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="py-16 border-t"
        style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)' }}
      >
        {/* FAQ - dense, 8px (L2 scroll reveal #6) */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="text-[13px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ fontFamily: 'var(--font-sans)', color: 'var(--risk)' }}>FAQ</p>
            <h2 className="text-[28px] sm:text-[36px] leading-[1.1] mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              Questions, answered with citations.
            </h2>
            <p className="text-[14px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
              No “AI magic” — just the method.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-[8px] border overflow-hidden"
                style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  aria-expanded={openFaq === idx}
                  aria-controls={`faq-answer-${idx}`}
                  className="w-full p-5 text-left font-semibold text-[15px] flex items-center justify-between gap-4"
                  style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown className="w-5 h-5 shrink-0 transition-transform" style={{ color: openFaq === idx ? 'var(--risk)' : 'var(--zinc-400)', transform: openFaq === idx ? 'rotate(180deg)' : 'none' }} />
                </button>
                {openFaq === idx && (
                  <motion.div
                    id={`faq-answer-${idx}`}
                    role="region"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="px-5 pb-5 text-[14px] leading-[1.6] overflow-hidden"
                    style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}
                  >
                    {faq.a}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* FOOTER — ink, minimal */}
      <footer className="py-10 border-t text-[13px]" style={{ background: 'var(--ink)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(246,242,239,0.72)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] grid place-items-center text-[12px]" style={{ background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>ss</div>
            <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--paper)' }}>SafeSponsor</span>
            <span style={{ fontFamily: 'var(--font-sans)' }}>© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-5 font-medium text-[12px] flex-wrap" style={{ fontFamily: 'var(--font-sans)' }}>
            <a href="#features" className="hover:underline" style={{ color: 'rgba(246,242,239,0.85)' }}>Method</a>
            <a href="#pricing" className="hover:underline" style={{ color: 'rgba(246,242,239,0.85)' }}>Pricing</a>
            <a href="#faq" className="hover:underline" style={{ color: 'rgba(246,242,239,0.85)' }}>FAQ</a>
            <a href="/privacy" className="hover:underline" style={{ color: 'rgba(246,242,239,0.85)' }}>Privacy</a>
            <a href="/terms" className="hover:underline" style={{ color: 'rgba(246,242,239,0.85)' }}>Terms</a>
            <a href="mailto:pandejesal@gmail.com" className="hover:underline" style={{ color: 'rgba(246,242,239,0.85)' }}>Support</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[11px] leading-[1.5]" style={{ fontFamily: 'var(--font-sans)', color: 'rgba(246,242,239,0.55)' }}>
            Dossiers cite YouTube Data API v3, transcript, and web search. PII-scrubbed, SHA-256 hashed target, 90-day cache. Example excerpts are anonymized.
          </p>
        </div>
      </footer>

      {/* MOBILE STICKY CTA BAR (GoGoChimp: sticky pricing CTA lifts mobile
          conversion 8-15%). Hidden on md+; root div has pb-16 on mobile so
          content is never obscured. */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t" style={{ background: 'rgba(246,242,239,0.92)', borderColor: 'rgba(15,27,46,0.08)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex-1 h-11 rounded-[8px] text-[14px] font-semibold btn-lift"
            style={{ background: 'var(--risk)', color: 'white', fontFamily: 'var(--font-sans)' }}
          >
            Run check — free
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex-1 h-11 rounded-[8px] text-[14px] font-semibold border btn-lift"
            style={{ background: 'white', borderColor: 'rgba(15,27,46,0.12)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
          >
            See pricing
          </button>
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration mount-guard: SSR must render the pre-hydration state, so the flip to mounted belongs in the effect
    setMounted(true);
  }, []);
  
  if (!mounted) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>Loading SafeSponsor AI…</div>;
  
  return (
    <LandingContent />
  );
}
