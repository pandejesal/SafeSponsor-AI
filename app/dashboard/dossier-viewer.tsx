'use client';

import Image from "next/image";
import { sanitizeUrl } from "@/lib/utils";
import {
  Search, Activity, AlertTriangle, CheckCircle2,
  ExternalLink, Flame, ChevronRight, Layers,
  Users, MessageSquare, Scale, FileCheck, ThumbsUp, Sparkles, Globe, Printer, Share2, RefreshCw, Copy, Check, Database, Shield,
} from "lucide-react";

export interface AudienceInsights {
  authenticity_rating: string;
  demographics_summary: string;
  engagement_quality: string;
  community_sentiment: string;
  toxic_recurring_themes?: string[];
  comment_sentiment_summary?: string;
}

export interface PRHistory {
  past_issues_summary: string;
  pr_crisis_handling: string;
  current_community_perception: string;
}

export interface CompetitorSponsorship {
  competitor_or_brand: string;
  platform: string;
  details: string;
  source_url?: string;
  verification_status: string;
}

export interface NuancedRedFlag {
  category: string;
  description: string;
  context_and_impact: string;
  video_timestamp?: string;
  source_url?: string;
  verification_status: string;
}

export interface FinalVerdict {
  recommendation: "Sponsor" | "Proceed with Caution" | "Blacklist" | string;
  justification: string;
  contractual_safeguards: string[];
}

export interface AnalysisResult {
  id?: string;
  creator_summary: string;
  brand_safety_score: number;
  risk_level: string;
  audience_insights: AudienceInsights;
  controversy_and_pr_history: PRHistory;
  competitor_and_sponsorship_history: CompetitorSponsorship[];
  nuanced_red_flags: NuancedRedFlag[];
  positive_highlights: string[];
  final_verdict: FinalVerdict;
  unreachable_urls: string[];
  grounding_sources?: { title: string; url: string }[];
  brand_name?: string;
  competitor_brands?: string[];
  target?: string;
  is_cached?: boolean;
  cached_at?: string;
  data_quality?: "full" | "limited";
  data_quality_note?: string | null;
  createdAt?: string | { seconds: number; nanoseconds?: number };
  persisted?: boolean;
}

export interface HistoryItem extends AnalysisResult {
  id: string;
  target: string;
  createdAt: any;
}

interface DossierViewerProps {
  result: AnalysisResult | null;
  auditComplete: boolean;
  isDark: boolean;
  brandName: string;
  target: string;
  userCredits: {
    hasSubscription: boolean;
    videoCredits: number;
    channelCredits: number;
  } | null;
  loadingAnalysis: boolean;
  saveSuccess: boolean;
  copySuccess: boolean;
  onReAudit: () => void;
  onSaveToDossiers: () => void;
  onCopySummary: () => void;
  onDownloadJson: () => void;
  getScoreBadgeColor: (score: number) => string;
  getRiskBadgeColor: (risk: string) => string;
  getVerdictBadge: (recommendation: string) => React.ReactNode;
  history: HistoryItem[];
  filteredHistory: HistoryItem[];
  loadingHistory: boolean;
  historyError: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  onSelectHistoryItem: (item: HistoryItem) => void;
}

export function DossierViewer({
  result,
  auditComplete,
  isDark,
  brandName,
  target,
  userCredits,
  loadingAnalysis,
  saveSuccess,
  copySuccess,
  onReAudit,
  onSaveToDossiers,
  onCopySummary,
  onDownloadJson,
  getScoreBadgeColor,
  getRiskBadgeColor,
  getVerdictBadge,
  history,
  filteredHistory,
  loadingHistory,
  historyError,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  filterStatus,
  onFilterStatusChange,
  onSelectHistoryItem,
}: DossierViewerProps) {
  return (
    <>
      {/* Executive Dossier Results View */}
      {result && (
        <section className={`p-6 sm:p-8 rounded-xl border space-y-8 animate-in fade-in duration-300 printable-dossier ${
          isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          {/* Audit Complete Banner */}
          {auditComplete && (
            <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Audit complete! Report generated successfully.</span>
            </div>
          )}
          {/* Agency Print PDF Report Header */}
          <div className="hidden print:flex flex-col pb-4 border-b-2 border-cyan-600 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/favicon.svg"
                  alt="SafeSponsor AI"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-xl"
                />
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1">
                    SafeSponsor <span className="text-cyan-600">AI</span>
                  </h1>
                  <p className="text-[10px] font-extrabold tracking-widest text-cyan-700 uppercase">
                    Executive Creator Brand Safety Intelligence Report
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-slate-700 space-y-0.5 font-medium">
                <p><strong className="text-slate-900">Audit Reference:</strong> dossier-{(result.target || 'creator').replace(/[^a-z0-9]/gi, '_').toLowerCase()}</p>
                <p><strong className="text-slate-900">Report Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><strong className="text-slate-900">Brand Partner:</strong> {result.brand_name || brandName}</p>
              </div>
            </div>
          </div>

          {/* Cache Hit Notice Banner — only "Free Preview" for genuinely free
              users; a paying user viewing an old cached dossier must not see
              an upsell to purchase the product they already pay for. */}
          {result.is_cached && !(userCredits?.hasSubscription || (userCredits?.videoCredits || 0) > 0 || (userCredits?.channelCredits || 0) > 0) && (
            <div className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden ${
              isDark ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
            }`}>
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <span>Free Preview</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                      Try SafeSponsor Free
                    </span>
                  </h4>
                  <p className="text-xs opacity-80">
                    This is a sample audit from our database. Sign up and purchase credits to analyze any creator.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onReAudit}
                disabled={loadingAnalysis}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border ${
                  isDark
                    ? 'bg-zinc-900 hover:bg-zinc-800 border-cyan-500/40 text-cyan-300'
                    : 'bg-white hover:bg-slate-50 border-cyan-300 text-cyan-900 shadow-sm'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalysis ? 'animate-spin' : ''}`} />
                <span>Force Re-Audit Live</span>
              </button>
            </div>
          )}

          {/* Limited Data Warning Banner */}
          {result.data_quality === 'limited' && (
            <div className={`p-4 rounded-lg border flex items-center gap-3 ${
              isDark ? 'bg-amber-950/30 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Limited Data Available</h4>
                <p className="text-xs opacity-80">
                  {result.data_quality_note || "This analysis had limited data. Try providing a specific video URL for a more accurate report."}
                </p>
              </div>
            </div>
          )}

          {/* Header / Score Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800/20">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-blue-100 text-blue-900'
                }`}>
                  Target: {result.target || target}
                </span>
                <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Evaluating for <strong className={isDark ? 'text-zinc-200' : 'text-slate-900'}>{result.brand_name || brandName}</strong>
                </span>
              </div>
              <h2 className="text-3xl font-black tracking-tight">
                Executive Risk Dossier
              </h2>
              <div className="pt-1">{getVerdictBadge(result.final_verdict?.recommendation)}</div>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              {/* Save to Dossiers */}
              <button
                onClick={onSaveToDossiers}
                className={`px-4 py-3 rounded-lg border transition text-xs font-bold flex items-center gap-2 print:hidden ${
                  saveSuccess
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : (isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-emerald-400' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-emerald-600')
                }`}
                title="Save this report to your personal dossier database"
              >
                {saveSuccess ? <Check className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                <span>{saveSuccess ? 'Saved!' : 'Save to Dossiers'}</span>
              </button>

              {/* Copy Markdown Summary */}
              <button
                onClick={onCopySummary}
                className={`px-4 py-3 rounded-lg border transition text-xs font-bold flex items-center gap-2 print:hidden ${
                  copySuccess
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : (isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-slate-100 border-slate-300 hover:bg-slate-200')
                }`}
                title="Copy Executive Summary to Clipboard"
              >
                {copySuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                <span>{copySuccess ? 'Summary Copied!' : 'Copy Summary'}</span>
              </button>

              {/* Download JSON Dossier */}
              <button
                onClick={onDownloadJson}
                className={`p-3 rounded-lg border transition text-xs font-bold flex items-center gap-1.5 print:hidden ${
                  isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-orange-400' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-orange-600'
                }`}
                title="Download Raw JSON Dossier Artifact"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">JSON</span>
              </button>

              {/* Print/Export Action */}
              <button
                onClick={() => window.print()}
                className={`p-3 rounded-lg border transition text-xs font-bold flex items-center gap-1.5 print:hidden ${
                  isDark ? 'bg-cyan-500/20 border-cyan-500/40 hover:bg-cyan-500/30 text-cyan-300' : 'bg-blue-900 hover:bg-blue-950 text-white'
                }`}
                title="Print or Save as PDF"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print to PDF</span>
              </button>

              {/* Score */}
              <div className={`px-6 py-3.5 rounded-lg border flex flex-col items-center justify-center ${getScoreBadgeColor(result.brand_safety_score)}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Safety Score</span>
                <span className="text-3xl font-black">{result.brand_safety_score}/100</span>
              </div>

              {/* Risk Badge */}
              <div className={`px-6 py-3.5 rounded-lg border flex flex-col items-center justify-center ${getRiskBadgeColor(result.risk_level)}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Risk Level</span>
                <span className="text-xl font-bold uppercase">{result.risk_level}</span>
              </div>
            </div>
          </div>

          {/* 1. Creator Summary */}
          <div className={`p-6 rounded-lg border space-y-2 ${
            isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
              isDark ? 'text-cyan-400' : 'text-blue-900'
            }`}>
              <Globe className="w-4 h-4" />
              1. Persona Overview & Digital Footprint
            </h3>
            <p className={`text-sm leading-relaxed font-normal ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
              {result.creator_summary}
            </p>
          </div>

          {/* 2. Final Verdict & Contractual Safeguards */}
          <div className={`p-6 rounded-lg border space-y-4 ${
            isDark
              ? 'bg-zinc-950 border-cyan-500/20'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between border-b border-zinc-800/20 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Scale className={`w-5 h-5 ${isDark ? 'text-orange-500' : 'text-orange-600'}`} />
                Executive Recommendation & Legal Safeguards
              </h3>
              {getVerdictBadge(result.final_verdict?.recommendation)}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Justification</p>
              <p className={`text-sm font-medium leading-relaxed ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                {result.final_verdict?.justification}
              </p>
            </div>

            {result.final_verdict?.contractual_safeguards && result.final_verdict.contractual_safeguards.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-800/20">
                <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-cyan-400' : 'text-blue-900'
                }`}>
                  <FileCheck className="w-4 h-4" />
                  Recommended Contractual Safeguards
                </p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {result.final_verdict.contractual_safeguards.map((sg, i) => (
                    <li key={i} className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                      isDark ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}>
                      <Shield className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <span>{sg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 3. Audience Quality & YouTube Comments Audit */}
          {result.audience_insights && (
            <div className="space-y-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Users className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-blue-900'}`} />
                Audience Quality & YouTube Comments Sentiment
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className={`p-4 rounded-lg border space-y-1 ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Authenticity Rating</span>
                  <p className="text-xs font-semibold text-emerald-500">{result.audience_insights.authenticity_rating}</p>
                </div>
                <div className={`p-4 rounded-lg border space-y-1 ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demographics</span>
                  <p className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{result.audience_insights.demographics_summary}</p>
                </div>
                <div className={`p-4 rounded-lg border space-y-1 ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Engagement Quality</span>
                  <p className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{result.audience_insights.engagement_quality}</p>
                </div>
                <div className={`p-4 rounded-lg border space-y-1 ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Community Sentiment</span>
                  <p className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{result.audience_insights.community_sentiment}</p>
                </div>
              </div>

              {/* YouTube Comment Toxicity Breakdown */}
              {(result.audience_insights.comment_sentiment_summary || (result.audience_insights.toxic_recurring_themes && result.audience_insights.toxic_recurring_themes.length > 0)) && (
                <div className={`p-4 rounded-lg border space-y-3 mt-3 ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">YouTube Comments Sentiment & Toxicity Breakdown (50 Sampled)</span>
                  </div>
                  {result.audience_insights.comment_sentiment_summary && (
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                      {result.audience_insights.comment_sentiment_summary}
                    </p>
                  )}
                  {result.audience_insights.toxic_recurring_themes && result.audience_insights.toxic_recurring_themes.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Surfaced Toxic Themes in Community Comments:
                      </span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {result.audience_insights.toxic_recurring_themes.map((theme, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. PR History */}
          {result.controversy_and_pr_history && (
            <div className="space-y-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500" />
                Public Perception & PR Controversy History
              </h3>
              <div className={`p-5 rounded-lg border space-y-4 ${
                isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Historical Scandals / Issues</h4>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{result.controversy_and_pr_history.past_issues_summary}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-800/20">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Crisis Handling & Accountability</h4>
                    <p className={`text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{result.controversy_and_pr_history.pr_crisis_handling}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Community Perception</h4>
                    <p className={`text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{result.controversy_and_pr_history.current_community_perception}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Competitor Sponsorship History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                Competitor Endorsements & Exclusivity History
              </h3>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isDark ? 'bg-zinc-950 text-zinc-300 border-zinc-800' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {result.competitor_and_sponsorship_history?.length || 0} Competitors Audited
              </span>
            </div>

            {(!result.competitor_and_sponsorship_history || result.competitor_and_sponsorship_history.length === 0) ? (
              <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 ${
                isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>No direct competitor endorsement conflicts detected.</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {result.competitor_and_sponsorship_history.map((spons, idx) => {
                  const isCleanNoConflict = spons.verification_status === 'not_verifiable' && spons.details?.toLowerCase().includes('no');
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg space-y-2 border ${
                        isCleanNoConflict
                          ? (isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200')
                          : (isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200')
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs ${
                            isCleanNoConflict ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-600'
                          }`}>
                            {spons.competitor_or_brand}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            on {spons.platform}
                          </span>
                        </div>
                        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                          isCleanNoConflict ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {isCleanNoConflict ? 'Checked — Clean' : spons.verification_status}
                        </span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-zinc-300' : 'text-slate-800'}`}>{spons.details}</p>
                      {spons.source_url && spons.source_url !== 'N/A' && (
                        <a
                          href={sanitizeUrl(spons.source_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-cyan-500 hover:underline pt-1"
                        >
                          <span>Evidence Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Contextualized Red Flags */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Behavioral & Content Red Flags
              </h3>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isDark ? 'bg-zinc-950 text-zinc-300 border-zinc-800' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {result.nuanced_red_flags?.length || 0} Flags
              </span>
            </div>

            {(!result.nuanced_red_flags || result.nuanced_red_flags.length === 0) ? (
              <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 ${
                isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>No major behavioral or content red flags detected.</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {result.nuanced_red_flags.map((flag, idx) => (
                  <div key={idx} className={`p-4 rounded-lg space-y-2 border ${
                    isDark ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50 border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-rose-500 uppercase tracking-wide">
                        {flag.category}
                      </span>
                      {flag.video_timestamp && flag.video_timestamp !== 'N/A' && (
                        <span className="text-xs font-mono bg-rose-500/20 text-rose-600 px-2 py-0.5 rounded">
                          {flag.video_timestamp}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs font-semibold ${isDark ? 'text-zinc-200' : 'text-slate-900'}`}>{flag.description}</p>
                    <p className={`text-xs italic p-2.5 rounded-xl border ${
                      isDark ? 'bg-zinc-950/60 text-zinc-400 border-zinc-800' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                      <strong>Context & Impact:</strong> {flag.context_and_impact}
                    </p>
                    {flag.source_url && flag.source_url !== 'N/A' && (
                      <a
                        href={sanitizeUrl(flag.source_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-cyan-500 hover:underline pt-1"
                      >
                        <span>Reference Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7. Positive Highlights */}
          {result.positive_highlights && result.positive_highlights.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                Brand Alignment Strengths
              </h3>
              <ul className="grid sm:grid-cols-2 gap-2">
                {result.positive_highlights.map((highlight, idx) => (
                  <li key={idx} className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <ThumbsUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grounding Web Citations */}
          {result.grounding_sources && result.grounding_sources.length > 0 && (
            <div className="pt-4 border-t border-zinc-800/20 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-500" />
                Grounded Evidence Web Citations ({result.grounding_sources.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.grounding_sources.map((src, i) => (
                  <a
                    key={i}
                    href={sanitizeUrl(src.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-[11px] px-3 py-1 rounded-lg border transition flex items-center gap-1.5 truncate max-w-xs ${
                      isDark
                        ? 'bg-zinc-950 hover:bg-zinc-800 text-cyan-300 border-zinc-800'
                        : 'bg-slate-100 hover:bg-slate-200 text-blue-900 border-slate-300'
                    }`}
                  >
                    <span className="truncate">{src.title || src.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {/* Agency Print PDF Report Footer Watermark */}
          <div className="hidden print:flex items-center justify-between pt-6 border-t-2 border-slate-300 text-[10px] text-slate-600 font-semibold mt-8">
            <p>Confidential Brand Safety Report • Prepared by SafeSponsor AI (https://safe-sponsor-ai.vercel.app)</p>
            <p>Verified Grounded Research Dossier</p>
          </div>
        </section>
      )}

      {/* Audit History & Saved Dossiers Section */}
      <section className={`p-6 sm:p-8 rounded-xl border space-y-5 print:hidden ${
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Layers className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-blue-900'}`} />
              Saved Creator Risk Dossiers
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {history.length} creator audits saved in your personal database
            </p>
          </div>

          {/* Controls: Search, Filters & Sorting */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search dossier..."
                className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none transition ${
                  isDark ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500' : 'bg-slate-100 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Sort selector */}
            <select
              value={sortBy}
              onChange={(e: any) => onSortByChange(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none transition font-medium ${
                isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="score_high">Sort: Highest Safety Score</option>
              <option value="score_low">Sort: Lowest Safety Score</option>
            </select>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-zinc-800/20">
          <button
            onClick={() => onFilterStatusChange('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
              filterStatus === 'all'
                ? (isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-blue-900 text-white')
                : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            All Dossiers ({history.length})
          </button>
          <button
            onClick={() => onFilterStatusChange('sponsor')}
            className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
              filterStatus === 'sponsor'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            Recommended
          </button>
          <button
            onClick={() => onFilterStatusChange('caution')}
            className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
              filterStatus === 'caution'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            Caution
          </button>
          <button
            onClick={() => onFilterStatusChange('blacklist')}
            className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
              filterStatus === 'blacklist'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            High Risk / Blacklist
          </button>
          <button
            onClick={() => onFilterStatusChange('cached')}
            className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1 ${
              filterStatus === 'cached'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            <Database className="w-3 h-3 text-cyan-400" />
            <span>DB Cache Hits</span>
          </button>
        </div>

        {/* Dossiers List */}
        {loadingHistory ? (
          <div className="flex justify-center p-8">
            <Activity className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : historyError ? (
          <div className={`p-4 rounded-xl border text-sm text-center ${
            isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {historyError}
          </div>
        ) : filteredHistory.length === 0 ? (
          <p className="text-slate-400 text-center py-8 text-sm">
            {searchQuery || filterStatus !== 'all' ? 'No dossiers match your search or filter.' : 'No saved sponsorship audits yet. Run your first audit above!'}
          </p>
        ) : (
          <div className="grid gap-3">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectHistoryItem(item)}
                className={`p-4 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
                  isDark
                    ? 'bg-zinc-950/60 hover:bg-zinc-950 border-zinc-800 hover:border-cyan-500/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 shadow-sm'
                }`}
              >
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-blue-100 text-blue-900'
                    }`}>
                      {item.brand_name || "Brand Audit"}
                    </span>
                    {item.is_cached && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                        <Database className="w-2.5 h-2.5" /> DB Cache
                      </span>
                    )}
                    <span className="text-xs font-bold truncate max-w-md">
                      {item.target}
                    </span>
                  </div>
                  <p className={`text-xs line-clamp-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {item.creator_summary || item.final_verdict?.justification}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${getScoreBadgeColor(item.brand_safety_score)}`}>
                    {item.brand_safety_score ?? "—"}/100
                  </span>
                  <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-xl border ${getRiskBadgeColor(item.risk_level)}`}>
                    {item.risk_level || "Unknown"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}