"use client";

import { useState } from "react";
import { ShieldAlert, CheckCircle2, Video, DollarSign, Activity, AlertTriangle, Search, Download, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RedFlag {
  category: string;
  description: string;
  timestamp: string;
}

interface AnalysisResult {
  brand_safety_score: number;
  risk_level: string;
  summary_verdict: string;
  red_flags: RedFlag[];
  positive_highlights: string[];
}

export default function Home() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleCheckout = async (plan: "single" | "subscription") => {
    setLoadingPlan(plan);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setCheckoutError(err.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoadingAnalysis(true);
    setAnalysisError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze URL");
      }
      
      setResult(data);
    } catch (err: any) {
      setAnalysisError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const exportReport = () => {
    if (!result) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "brand_safety_report.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const getRiskColor = (risk: string) => {
    const r = risk.toLowerCase();
    if (r === "low") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (r === "medium") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 font-sans flex flex-col">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">SafeSponsor <span className="text-indigo-400">AI</span></h1>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-400">
              <a href="#analysis" className="hover:text-white transition-colors">Analysis</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            </nav>
            <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded border border-indigo-500/20">PRO PLAN</span>
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs border border-slate-600">U</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-6">
        
        {/* HERO SECTION */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto flex flex-col justify-center min-h-[calc(100vh-4rem)]"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-6 ring-1 ring-indigo-500/20">
              <Video className="w-4 h-4" />
              <span>YouTube Creator Vetting</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
              Protect your brand from <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">hidden risks.</span>
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
              Instantly analyze any YouTube creator's content using Gemini AI. Detect profanity, controversies, and competitor mentions before you sign the sponsorship deal.
            </p>
            <div className="flex items-center justify-center gap-4">
              <a href="#analysis" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20">
                Try Analyzer
              </a>
              <a href="#pricing" className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors">
                View Pricing
              </a>
            </div>
          </div>
        </motion.section>

        {/* DASHBOARD/ANALYSIS SECTION */}
        <section id="analysis" className="w-full flex flex-col scroll-mt-24 mb-24">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Live Analysis</h2>
            <p className="text-slate-400">Paste a YouTube URL below to scan for brand safety risks.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30 shadow-2xl">
            {/* Sidebar Controls */}
            <aside className="col-span-1 lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-800 p-6 flex flex-col gap-6 bg-slate-900/50">
              <form onSubmit={handleAnalyze} className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Video Input</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Video className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingAnalysis || !url}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg text-sm transition-colors shadow-lg shadow-indigo-500/10 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loadingAnalysis ? <Activity className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Analyze Report</span>
                </button>
              </form>

              {analysisError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{analysisError}</p>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-slate-800/50 mt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <div className="p-4 border border-dashed border-slate-700 rounded-xl text-center">
                    <p className="text-[11px] text-slate-400">Using Demo Credits</p>
                    <p className="text-xs text-slate-300 mt-1 font-semibold">Upgrade for unlimited</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-4">
                <button 
                  onClick={exportReport}
                  disabled={!result}
                  className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white py-2 disabled:opacity-50 disabled:hover:text-slate-400 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export JSON Report
                </button>
              </div>
            </aside>

            {/* Analysis Results */}
            <div className="col-span-1 lg:col-span-9 p-6 lg:p-8 flex flex-col gap-8 bg-slate-950/50 min-h-[500px]">
              <AnimatePresence mode="wait">
                {!result && !loadingAnalysis && (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full"
                  >
                    <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                    <p>Enter a YouTube URL to generate a brand safety report.</p>
                  </motion.div>
                )}

                {loadingAnalysis && (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-indigo-400 h-full"
                  >
                    <Activity className="w-12 h-12 mb-4 animate-spin" />
                    <p>Analyzing video content and running safety checks...</p>
                  </motion.div>
                )}

                {result && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col gap-8 w-full"
                  >
                    {/* Score Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="col-span-1 bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500/5"></div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 z-10">Safety Score</p>
                        <div className="relative w-32 h-32 flex items-center justify-center z-10">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364" strokeDashoffset={364 - (364 * result.brand_safety_score) / 100} className="text-indigo-500 transition-all duration-1000 ease-out" />
                          </svg>
                          <span className="absolute text-4xl font-black text-white">{result.brand_safety_score}</span>
                        </div>
                        <p className={`mt-4 text-sm font-medium ${getScoreColor(result.brand_safety_score)} z-10`}>
                          {result.brand_safety_score >= 80 ? "Excellent" : result.brand_safety_score >= 50 ? "Moderate" : "Poor"}
                        </p>
                      </div>

                      <div className="col-span-1 md:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getRiskColor(result.risk_level)}`}>
                            {result.risk_level} RISK LEVEL
                          </div>
                          <div className="text-slate-500 text-xs font-mono">ID: #ANALYSIS_{Math.floor(Math.random() * 90000) + 10000}</div>
                        </div>
                        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl h-full flex flex-col">
                          <h3 className="text-sm font-bold text-slate-300 mb-2">Summary Verdict</h3>
                          <p className="text-slate-400 text-sm leading-relaxed flex-1">
                            {result.summary_verdict}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Red Flags Table */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-300">Identified Flags & Warnings</h3>
                        <div className="flex gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase">{result.red_flags.length} Detected</span>
                        </div>
                      </div>
                      
                      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="bg-slate-800/50 text-slate-500 text-[11px] uppercase tracking-wider">
                              <th className="py-3 px-4 font-bold w-32">Category</th>
                              <th className="py-3 px-4 font-bold">Incident Description</th>
                              <th className="py-3 px-4 font-bold text-right w-24">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {result.red_flags.length > 0 ? (
                              result.red_flags.map((flag, idx) => (
                                <tr key={idx}>
                                  <td className="py-4 px-4">
                                    <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase border ${
                                      flag.category.toLowerCase().includes('critical') || flag.category.toLowerCase().includes('nsfw') 
                                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    }`}>
                                      {flag.category}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-slate-300">{flag.description}</td>
                                  <td className="py-4 px-4 text-right font-mono text-xs text-indigo-400">{flag.timestamp}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="py-8 text-center text-slate-500 text-sm">
                                  No red flags detected in this content.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Positive Highlights */}
                    {result.positive_highlights.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {result.positive_highlights.map((highlight, idx) => (
                          <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
                            <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0 mt-0.5">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className="text-[11px] text-slate-400 leading-relaxed">
                              {highlight}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" className="w-full flex flex-col items-center gap-12 scroll-mt-24 border-t border-slate-800/50 pt-24 pb-12">
          <div className="text-center max-w-2xl">
            <h2 className="text-3xl font-bold mb-4">Unlock Full Access</h2>
            <p className="text-slate-400">Choose the plan that fits your brand's vetting volume.</p>
          </div>

          {checkoutError && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2 max-w-md w-full">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{checkoutError}</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
            {/* Single Report Tier */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 flex flex-col"
            >
              <h3 className="text-2xl font-semibold mb-2">Single Report</h3>
              <p className="text-slate-400 mb-6 text-sm">Perfect for vetting a single creator quickly.</p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$10</span>
                <span className="text-slate-500 font-medium">/report</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Deep analysis of one YouTube URL</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Brand Safety Score & Risk Level</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Timestamped Red Flag detection</span>
                </li>
              </ul>
              <button
                onClick={() => handleCheckout("single")}
                disabled={loadingPlan !== null}
                className="w-full py-3 px-4 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingPlan === "single" ? (
                  <Activity className="w-5 h-5 animate-spin" />
                ) : (
                  <DollarSign className="w-5 h-5" />
                )}
                <span>Buy Single Report</span>
              </button>
            </motion.div>

            {/* Subscription Tier */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-8 flex flex-col relative overflow-hidden ring-1 ring-indigo-500/20"
            >
              <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-bl-lg">
                BEST VALUE
              </div>
              <h3 className="text-2xl font-semibold mb-2 text-indigo-50">Unlimited Pro</h3>
              <p className="text-indigo-200/60 mb-6 text-sm">For agencies and large e-commerce brands.</p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$199</span>
                <span className="text-slate-500 font-medium">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Unlimited YouTube URL analyses</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Detailed summary verdicts</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Exportable JSON/Text reports</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Priority processing</span>
                </li>
              </ul>
              <button
                onClick={() => handleCheckout("subscription")}
                disabled={loadingPlan !== null}
                className="w-full py-3 px-4 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                {loadingPlan === "subscription" ? (
                  <Activity className="w-5 h-5 animate-spin" />
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
                <span>Subscribe Unlimited</span>
              </button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-10 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between text-[10px] text-slate-500 font-mono tracking-wider uppercase mt-auto">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            API Connection Stable
          </span>
          <span>Gemini-3.6-Flash</span>
        </div>
        <div className="flex items-center gap-4">
          <span>SafeSponsor AI v1.0.4</span>
        </div>
      </footer>
    </div>
  );
}
