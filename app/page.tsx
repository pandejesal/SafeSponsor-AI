'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getAppCheckToken } from '@/lib/firebase';
import { Navbar } from '@/components/Navbar';
import { useTheme } from '@/components/ThemeProvider';
import { motion } from 'motion/react';
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
  Award
} from 'lucide-react';

function LandingContent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [heroInputUrl, setHeroInputUrl] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const isDark = theme === 'dark';

  const handleHeroAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroInputUrl.trim()) {
      if (user) {
        router.push(`/dashboard?target=${encodeURIComponent(heroInputUrl.trim())}`);
      } else {
        router.push(`/login?target=${encodeURIComponent(heroInputUrl.trim())}`);
      }
    } else {
      router.push(user ? '/dashboard' : '/login');
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
      a: "You can run a free demo audit on select seeded creator profiles before purchasing. Each paid plan includes credits to analyze real creators."
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
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-24 md:pt-20 md:pb-32">
        {/* Background decoration removed for clean design */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Eyebrow Badge */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-8 border shadow-sm ${
              isDark 
                ? 'bg-zinc-900/90 border-cyan-500/30 text-cyan-400 shadow-cyan-950/20' 
                : 'bg-white border-orange-200 text-orange-700 shadow-orange-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>AI-POWERED CREATOR BRAND SAFETY & SPONSORSHIP ENGINE</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] max-w-5xl mx-auto mb-6"
          >
            Vet Creator Sponsorships <br className="hidden sm:inline" />
            <span className="text-orange-500">
              Before You Risk Your Brand
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed mb-10 font-medium ${
              isDark ? 'text-zinc-400' : 'text-slate-600'
            }`}
          >
            Instantly score creator brand safety, extract video transcripts, audit comment toxicity via YouTube Data API, detect competitor conflicts, and generate bulletproof contract safeguards.
          </motion.p>

          {/* INTERACTIVE AUDIT SEARCH BAR */}
          <motion.form
            onSubmit={handleHeroAudit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-2xl mx-auto mb-12"
          >
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
                  aria-label="Enter YouTube video, channel, or Instagram creator URL"
                  placeholder="Paste YouTube Video URL, Channel, or Instagram Link..."
                  value={heroInputUrl}
                  onChange={(e) => setHeroInputUrl(e.target.value)}
                  className={`w-full bg-transparent text-sm focus:outline-none font-medium ${
                    isDark ? 'text-white placeholder:text-zinc-500' : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
              <button
                type="submit"
                className={`py-3.5 px-7 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shrink-0 hover:scale-[1.02] ${
                  isDark
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white hover:from-orange-500 hover:to-orange-400 shadow-orange-950/50'
                    : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'
                }`}
              >
                <span>Run Instant Audit</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
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

          {/* KEY METRICS / TRUST BAR */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6"
          >
            {[
              { metric: "7-Day Cache", label: "Zero-Cost Repeat Audits" },
              { metric: "50 Comments", label: "Toxicity Audit / Video" },
              { metric: "360° Grounding", label: "Web Search Verification" },
              { metric: "60-Second", label: "Executive Dossier Turnaround" },
            ].map((stat, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-lg border text-center transition-transform hover:-translate-y-1 ${
                  isDark 
                    ? 'bg-zinc-900/50 border-zinc-800/80' 
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className={`text-2xl font-black ${
                  isDark ? 'text-cyan-400' : 'text-blue-900'
                }`}>
                  {stat.metric}
                </div>
                <div className={`text-xs font-semibold mt-1 ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}>
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SAMPLE INTERACTIVE REPORT SHOWCASE (#demo) */}
      <section id="demo" className={`py-20 border-y transition-colors ${
        isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-slate-100/70 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Comprehensive 360° Safety Dossiers
            </h2>
            <p className={`text-base sm:text-lg font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Every audit delivers deep, verifiable intelligence from transcripts, comment sentiment analysis, PR history, and competitor conflicts.
            </p>
          </div>

          {/* MOCK REPORT CARD */}
          <motion.div 
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 30 }}
            viewport={{ once: true }}
            className={`rounded-xl border p-6 sm:p-8 shadow-2xl relative overflow-hidden ${
              isDark 
                ? 'bg-zinc-950 border-zinc-800 ring-1 ring-cyan-500/20' 
                : 'bg-white border-slate-300 ring-1 ring-blue-900/10'
            }`}
          >
            {/* Header Mock */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                    isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-blue-100 text-blue-900'
                  }`}>SAMPLE DOSSIER</span>
                  <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Target: YouTube Video Audit</span>
                </div>
                <h3 className="text-2xl font-bold">TechVision Review - &quot;My Honest Setup 2026&quot;</h3>
              </div>

              <div className="flex items-center gap-4">
                <div className={`px-5 py-3 rounded-lg border text-center ${
                  isDark ? 'bg-zinc-900 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300'
                }`}>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-emerald-500">Brand Safety Score</div>
                  <div className="text-2xl font-black text-emerald-400">92 / 100</div>
                </div>
                <div className={`px-4 py-3 rounded-lg border text-center ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Recommendation</div>
                  <div className={`text-sm font-bold ${isDark ? 'text-cyan-400' : 'text-blue-900'}`}>SPONSOR WITH TERMS</div>
                </div>
              </div>
            </div>

            {/* Grid Breakdown Mock */}
            <div className="grid md:grid-cols-3 gap-6 pt-6">
              {/* Box 1: Comment Sentiment Audit */}
              <div className={`p-5 rounded-lg border space-y-3 ${
                isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> YouTube Comment Audit (50 Sampled)
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">98% Positive</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Sampled 50 top comments. Audience engagement is highly authentic with technical setup questions. Zero toxic harassment or scam themes detected.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    isDark ? 'bg-zinc-800 text-cyan-300' : 'bg-blue-50 text-blue-800'
                  }`}>#AuthenticFeedback</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    isDark ? 'bg-zinc-800 text-orange-300' : 'bg-orange-50 text-orange-800'
                  }`}>#NoBotSpam</span>
                </div>
              </div>

              {/* Box 2: Transcript Analysis */}
              <div className={`p-5 rounded-lg border space-y-3 ${
                isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Transcript Safety Check
                  </span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded">Scanned 4,200 Words</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Full transcript parsed. No profanity, hate speech, or political controversy found in video content audio.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">PG-13 Clean</span>
                </div>
              </div>

              {/* Box 3: Competitor Conflicts */}
              <div className={`p-5 rounded-lg border space-y-3 ${
                isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Exclusivity Check
                  </span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-300 font-bold px-2 py-0.5 rounded">No Direct Conflicts</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Verified no active sponsorship deals with direct competitors in the past 60 days based on grounded search results.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-medium">Exclusivity Verified</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION (#how-it-works) */}
      <section id="how-it-works" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2 block">
            Automated 3-Step Process
          </span>
          <h2 className="text-3xl sm:text-5xl font-black mb-4">
            How SafeSponsor AI Works
          </h2>
          <p className={`text-base sm:text-lg font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            From URL input to executive-ready brand protection dossier in under a minute.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {[
            {
              step: "01",
              title: "Input Target Creator",
              desc: "Paste any YouTube video link, Shorts URL, channel handle, or Instagram creator profile.",
              icon: Search,
              color: isDark ? "text-cyan-400" : "text-blue-900"
            },
            {
              step: "02",
              title: "Multi-Pass AI Research",
              desc: "We extract transcripts, query 50 recent comments via YouTube Data API, and search grounded web sources.",
              icon: Activity,
              color: "text-orange-500"
            },
            {
              step: "03",
              title: "Execute & Export Dossier",
              desc: "Get an executive score, community toxicity breakdown, competitor log, and contractual safeguards.",
              icon: FileText,
              color: isDark ? "text-cyan-400" : "text-blue-900"
            }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className={`p-8 rounded-xl border relative flex flex-col justify-between ${
                isDark 
                  ? 'bg-zinc-900/60 border-zinc-800 hover:border-cyan-500/40' 
                  : 'bg-white border-slate-200 shadow-sm hover:border-orange-500/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className={`text-4xl font-black opacity-30 ${item.color}`}>{item.step}</span>
                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-100 border-slate-200'
                  }`}>
                    <item.icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES BENTO GRID (#features) */}
      <section id="features" className={`py-16 border-t ${
        isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-100/60 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-5xl font-black mb-4">
              Everything Needed to Protect Your Brand
            </h2>
            <p className={`text-base sm:text-lg font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Built specifically for performance marketers, PR directors, and influencer talent agencies.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className={`p-8 rounded-xl border md:col-span-2 ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="w-12 h-12 rounded-lg bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-orange-500 mb-6">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-3">YouTube Comment Toxicity & Sentiment Audit</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Integrates directly with YouTube Data API v3 to fetch 50 top/recent comments per video. Automatically parses for recurring toxic themes like scam allegations, harassment, hate speech, bot spam, or community backlash.
              </p>
            </div>

            {/* Feature 2 */}
            <div className={`p-8 rounded-xl border ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Transcript Safety Parser</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Extracts complete audio transcripts from YouTube videos and Shorts to analyze spoken dialogue for profanity, hate speech, or sensitive political claims.
              </p>
            </div>

            {/* Feature 3 */}
            <div className={`p-8 rounded-xl border ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Competitor Conflict Audit</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Verifies past endorsements with rival brands. Explicitly flags active exclusivity violations or outputs verified clean history.
              </p>
            </div>

            {/* Feature 4 */}
            <div className={`p-8 rounded-xl border md:col-span-2 ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="w-12 h-12 rounded-lg bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-orange-500 mb-6">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Automated Legal Contract Safeguards</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Generates actionable contractual safeguards and clawback clauses tailored to the creator&apos;s specific risk profile, helping legal teams finalize sponsorship agreements safely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING SECTION (#pricing) */}
      <section id="pricing" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2 block">
            Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-5xl font-black mb-4">
            Simple, Predictable Plans
          </h2>
          <p className={`text-base sm:text-lg font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            Pay per report or subscribe for unlimited agency creator vetting.
          </p>
          <p className={`text-xs font-medium mt-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
            Secure payment via Dodo Payments. Cancel anytime.
          </p>
        </div>

        {checkoutError && (
          <div className={`max-w-md mx-auto mb-8 p-4 rounded-xl border text-sm font-medium text-center ${
            isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {checkoutError}
          </div>
        )}

        <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8 items-stretch">
          {/* PLAN 1 */}
          <motion.div 
            whileHover={{ y: -4 }}
            className={`rounded-xl border p-8 flex flex-col justify-between ${
              isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div>
              <h3 className="text-2xl font-bold mb-2">Single Video Report</h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Perfect for vetting a single creator&apos;s video or short before publishing.
              </p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold">$10</span>
                <span className={`text-sm font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>/ single report</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Full Video Transcript Parsing</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>50 YouTube Comments Sentiment Sample</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Competitor Conflict Check</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout("single")}
              disabled={loadingPlan !== null}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                isDark 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {loadingPlan === "single" ? <Activity className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
              <span>Buy Single Report ($10)</span>
            </button>
          </motion.div>

          {/* PLAN 2 (HIGHLIGHTED) */}
          <motion.div 
            whileHover={{ y: -4 }}
            className={`rounded-xl border p-8 flex flex-col justify-between relative shadow-2xl ${
              isDark 
                ? 'bg-gradient-to-b from-zinc-900 to-zinc-950 border-cyan-500/50 ring-1 ring-cyan-500/30' 
                : 'bg-white border-orange-500/50 ring-2 ring-orange-500/20'
            }`}
          >
            <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isDark ? 'bg-cyan-500 text-zinc-950' : 'bg-orange-600 text-white'
            }`}>
              POPULAR FOR BRANDS
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-2">Channel / Profile Report</h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Analyze a creator&apos;s full channel history and audience toxicity across top videos.
              </p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold">$25</span>
                <span className={`text-sm font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>/ channel audit</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Multi-Video Transcript Safety Scan</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Deep YouTube Comments Toxicity Audit</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Contractual Safeguards Generator</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Exportable Shareable Dossier PDF</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout("channel")}
              disabled={loadingPlan !== null}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                isDark 
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'
              }`}
            >
              {loadingPlan === "channel" ? <Activity className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
              <span>Buy Channel Report ($25)</span>
            </button>
          </motion.div>

          {/* PLAN 3 */}
          <motion.div 
            whileHover={{ y: -4 }}
            className={`rounded-xl border p-8 flex flex-col justify-between ${
              isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div>
              <h3 className="text-2xl font-bold mb-2">Unlimited Pro</h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Designed for influencer marketing agencies and e-commerce PR teams.
              </p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold">$199</span>
                <span className={`text-sm font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>/ month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Unlimited Video & Channel Audits</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Gemini + Groq Multi-Model Research Engine</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Print-Ready Executive PDF Dossiers</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Batch Multi-URL Queue Auditing</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout("subscription")}
              disabled={loadingPlan !== null}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                isDark 
                  ? 'bg-orange-600 hover:bg-orange-500 text-white' 
                  : 'bg-blue-900 hover:bg-blue-950 text-white'
              }`}
            >
              {loadingPlan === "subscription" ? <Activity className="w-5 h-5 animate-spin" /> : <Award className="w-5 h-5" />}
              <span>Subscribe Unlimited Pro ($199)</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* FAQ SECTION (#faq) */}
      <section id="faq" className={`py-16 border-t ${
        isDark ? 'bg-zinc-900/30 border-zinc-800' : 'bg-slate-100/50 border-slate-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              Frequently Asked Questions
            </h2>
            <p className={`text-base font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Everything you need to know about SafeSponsor AI analysis and pricing.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx}
                className={`rounded-lg border transition-colors overflow-hidden ${
                  isDark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-white border-slate-200'
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  aria-expanded={openFaq === idx}
                  aria-controls={`faq-answer-${idx}`}
                  className="w-full p-6 text-left font-bold text-base sm:text-lg flex items-center justify-between gap-4"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${
                    openFaq === idx ? 'rotate-180 text-orange-500' : 'text-slate-400'
                  }`} />
                </button>
                {openFaq === idx && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    className={`px-6 pb-6 text-sm leading-relaxed ${
                      isDark ? 'text-zinc-400' : 'text-slate-600'
                    }`}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={`py-12 border-t text-sm ${
        isDark ? 'bg-zinc-950 border-zinc-900 text-zinc-500' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/favicon.svg" alt="SafeSponsor AI" width={20} height={20} className="w-5 h-5" />
            <span className="font-bold text-slate-200 dark:text-zinc-200">SafeSponsor AI</span>
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-medium text-xs">
            <a href="#features" className="hover:underline">Features</a>
            <a href="#pricing" className="hover:underline">Pricing</a>
            <a href="#faq" className="hover:underline">FAQ</a>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/terms" className="hover:underline">Terms</a>
            <button onClick={() => router.push('/login')} className="hover:underline">Sign In</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return <div className="min-h-screen dark:bg-zinc-950 bg-slate-50 dark:text-zinc-200 text-slate-900 flex items-center justify-center">Loading SafeSponsor AI...</div>;
  
  return (
    <LandingContent />
  );
}
