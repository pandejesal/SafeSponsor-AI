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

export interface AnomalySignal {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
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
  anomaly_signals?: AnomalySignal[];
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
        <section className="p-6 rounded-[8px] border space-y-6 printable-dossier" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
          {/* Audit Complete — subtle, not emerald 500 */}
          {auditComplete && (
            <div className="flex items-center gap-3 p-3 rounded-[8px] border text-[13px] font-medium" style={{ background: 'var(--score-good-bg)', borderColor: 'rgba(5,150,105,0.18)', color: 'var(--score-good)', fontFamily: 'var(--font-sans)' }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Audit complete — cited and cached (SHA-256).</span>
            </div>
          )}
          {/* Print header — ink, not ink */}
          <div className="hidden print:flex flex-col pb-4 mb-6 space-y-3" style={{ borderBottom: '2px solid var(--ink)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] grid place-items-center text-[15px]" style={{ background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-display)' }}>ss</div>
                <div>
                  <h1 className="text-[20px] tracking-[-0.02em] flex items-baseline gap-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
                    SafeSponsor <span style={{ color: 'var(--risk)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '12px' }} className="uppercase tracking-[0.08em]">Audit</span>
                  </h1>
                  <p className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                    Creator Brand Safety Report — cited
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] space-y-0.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                <p><strong style={{ color: 'var(--ink)' }}>Ref:</strong> dossier-{(result.target || 'creator').replace(/[^a-z0-9]/gi, '_').toLowerCase()}</p>
                <p><strong style={{ color: 'var(--ink)' }}>Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><strong style={{ color: 'var(--ink)' }}>Brand:</strong> {result.brand_name || brandName}</p>
              </div>
            </div>
          </div>

          {/* Cache Hit Notice Banner — only "Free Preview" for genuinely free
              users; a paying user viewing an old cached dossier must not see
              an upsell to purchase the product they already pay for. */}
          {result.is_cached && !(userCredits?.hasSubscription || (userCredits?.videoCredits || 0) > 0 || (userCredits?.channelCredits || 0) > 0) && (
            <div className="p-4 rounded-[8px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden" style={{ background: 'var(--paper)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 shrink-0" style={{ color: 'var(--ink-600)' }} />
                <div>
                  <h4 className="font-semibold text-[13px] flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                    <span>Cached preview — hashed (SHA-256)</span>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ background: 'var(--card-bg)', color: 'var(--ink-600)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}>
                      90-day cache
                    </span>
                  </h4>
                  <p className="text-[12px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                    PII-scrubbed cached dossier. Re-audit live for a fresh cited report.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onReAudit}
                disabled={loadingAnalysis}
                className="px-4 py-2 rounded-[8px] text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0 border"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalysis ? 'animate-spin' : ''}`} />
                <span>Re-audit live</span>
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

          {/* Header — dense audit, 8px, cited */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-[0.08em] border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}>
                  Target: {result.target || target}
                </span>
                <span className="text-[12px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  For <strong style={{ color: 'var(--ink)' }}>{result.brand_name || brandName}</strong> • <span style={{ color: 'var(--zinc-400)' }}>SHA-256 hashed target • 90-day cache</span>
                </span>
              </div>
              <h2 className="text-[28px] leading-[1.1]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                Risk dossier — cited
              </h2>
              <div className="pt-1">{getVerdictBadge(result.final_verdict?.recommendation)}</div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={onSaveToDossiers}
                className="px-3 py-2.5 rounded-[8px] border text-[12px] font-semibold inline-flex items-center gap-2 print:hidden"
                style={{
                  background: saveSuccess ? 'var(--score-good-bg)' : 'white',
                  color: saveSuccess ? 'var(--score-good)' : 'var(--ink)',
                  borderColor: saveSuccess ? 'rgba(5,150,105,0.18)' : 'var(--border-strong)',
                  fontFamily: 'var(--font-sans)',
                }}
                title="Save this report to your personal dossier database"
              >
                {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} />}
                <span>{saveSuccess ? 'Saved' : 'Save'}</span>
              </button>

              <button
                onClick={onCopySummary}
                className="px-3 py-2.5 rounded-[8px] border text-[12px] font-semibold inline-flex items-center gap-2 print:hidden"
                style={{
                  background: copySuccess ? 'var(--score-good-bg)' : 'white',
                  color: copySuccess ? 'var(--score-good)' : 'var(--ink)',
                  borderColor: copySuccess ? 'rgba(5,150,105,0.18)' : 'var(--border-strong)',
                  fontFamily: 'var(--font-sans)',
                }}
                title="Copy Executive Summary to Clipboard"
              >
                {copySuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} />}
                <span>{copySuccess ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={onDownloadJson}
                className="p-2.5 rounded-[8px] border print:hidden"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink-600)' }}
                title="Download Raw JSON Dossier Artifact"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => window.print()}
                className="p-2.5 rounded-[8px] border print:hidden"
                style={{ background: 'var(--ink)', borderColor: 'var(--ink)', color: 'var(--paper)' }}
                title="Print or Save as PDF"
              >
                <Printer className="w-4 h-4" />
              </button>

              {/* Score — semantic, 8px */}
              <div className="px-5 py-3 rounded-[8px] border flex flex-col items-center justify-center" style={{ background: result.brand_safety_score >= 80 ? 'var(--score-good-bg)' : result.brand_safety_score >= 60 ? 'var(--score-warn-bg)' : 'var(--score-risk-bg)', borderColor: result.brand_safety_score >= 80 ? 'rgba(5,150,105,0.18)' : result.brand_safety_score >= 60 ? 'rgba(217,119,6,0.18)' : 'rgba(220,38,38,0.18)' }}>
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>Safety Score</span>
                <span className="text-[28px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-sans)', color: result.brand_safety_score >= 80 ? 'var(--score-good)' : result.brand_safety_score >= 60 ? 'var(--score-warn)' : 'var(--score-risk)' }}>{result.brand_safety_score}/100</span>
              </div>

              {/* Risk Badge */}
              <div className={`px-6 py-3.5 rounded-lg border flex flex-col items-center justify-center ${getRiskBadgeColor(result.risk_level)}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Risk Level</span>
                <span className="text-xl font-bold uppercase">{result.risk_level}</span>
              </div>
            </div>
          </div>

          {/* Audience quality signals — deterministic, computed from public stats */}
          {result.anomaly_signals && result.anomaly_signals.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                Audience signals
              </span>
              {result.anomaly_signals.map((sig, i) => (
                <span
                  key={`${sig.code}-${i}`}
                  title={sig.message}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border text-[11px] font-semibold cursor-help max-w-full"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: sig.severity === 'critical' ? '#E07A5F' : sig.severity === 'warning' ? '#D9A441' : 'var(--ink-600)' }}
                  />
                  <span className="truncate">{sig.code}</span>
                </span>
              ))}
            </div>
          )}

          {/* 1. Creator Summary */}
          <div className="p-5 rounded-[8px] border space-y-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="text-[11px] font-semibold tracking-[0.08em] uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
              <Globe className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} />
              1. Persona — digital footprint
            </h3>
            <p className="text-[13px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
              {result.creator_summary}
            </p>
          </div>

          {/* 2. Verdict — 8px audit, cited */}
          <div className="p-5 rounded-[8px] border space-y-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-[12px] font-semibold tracking-[0.06em] uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                <Scale className="w-4 h-4" style={{ color: 'var(--ink-600)' }} />
                Recommendation & safeguards
              </h3>
              {getVerdictBadge(result.final_verdict?.recommendation)}
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Justification</p>
              <p className="text-[13px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                {result.final_verdict?.justification}
              </p>
            </div>

            {result.final_verdict?.contractual_safeguards && result.final_verdict.contractual_safeguards.length > 0 && (
              <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                  <FileCheck className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} />
                  Contractual safeguards
                </p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {result.final_verdict.contractual_safeguards.map((sg, i) => (
                    <li key={i} className="p-3 rounded-[8px] text-[12px] leading-[1.5] flex items-start gap-2 border" style={{ background: 'var(--paper)', borderColor: 'var(--card-border)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
                      <Shield className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--risk)' }} />
                      <span>{sg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 3. Audience — 8px audit, cited */}
          {result.audience_insights && (
            <div className="space-y-3">
              <h3 className="text-[12px] font-semibold tracking-[0.06em] uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                <Users className="w-4 h-4" style={{ color: 'var(--ink-600)' }} />
                Audience — 50 comments via API
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-[8px] border space-y-1" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Authenticity</span>
                  <p className="text-[12px] font-semibold" style={{ fontFamily: 'var(--font-sans)', color: 'var(--score-good)' }}>{result.audience_insights.authenticity_rating}</p>
                </div>
                <div className="p-4 rounded-[8px] border space-y-1" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Demographics</span>
                  <p className="text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{result.audience_insights.demographics_summary}</p>
                </div>
                <div className="p-4 rounded-[8px] border space-y-1" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Engagement</span>
                  <p className="text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{result.audience_insights.engagement_quality}</p>
                </div>
                <div className="p-4 rounded-[8px] border space-y-1" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Sentiment</span>
                  <p className="text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{result.audience_insights.community_sentiment}</p>
                </div>
              </div>

              {(result.audience_insights.comment_sentiment_summary || (result.audience_insights.toxic_recurring_themes && result.audience_insights.toxic_recurring_themes.length > 0)) && (
                <div className="p-4 rounded-[8px] border space-y-3 mt-1" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" style={{ color: 'var(--ink-600)' }} />
                    <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Comment sentiment — 50 sampled, PII-scrubbed</span>
                  </div>
                  {result.audience_insights.comment_sentiment_summary && (
                    <p className="text-[12px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                      {result.audience_insights.comment_sentiment_summary}
                    </p>
                  )}
                  {result.audience_insights.toxic_recurring_themes && result.audience_insights.toxic_recurring_themes.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold flex items-center gap-1" style={{ fontFamily: 'var(--font-sans)', color: 'var(--score-risk)' }}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Toxic themes surfaced
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {result.audience_insights.toxic_recurring_themes.map((theme, idx) => (
                          <span key={idx} className="px-2 py-1 rounded-full border text-[11px] font-medium" style={{ background: 'var(--score-risk-bg)', color: 'var(--score-risk)', borderColor: 'rgba(220,38,38,0.15)', fontFamily: 'var(--font-sans)' }}>
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

          {/* 4. PR — 8px */}
          {result.controversy_and_pr_history && (
            <div className="space-y-3">
              <h3 className="text-[12px] font-semibold tracking-[0.06em] uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                <MessageSquare className="w-4 h-4" style={{ color: 'var(--ink-600)' }} />
                PR history — web-grounded
              </h3>
              <div className="p-5 rounded-[8px] border space-y-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                <div>
                  <h4 className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-1" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Past issues</h4>
                  <p className="text-[12px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{result.controversy_and_pr_history.past_issues_summary}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div>
                    <h4 className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-1" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Crisis handling</h4>
                    <p className="text-[12px] leading-[1.5]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{result.controversy_and_pr_history.pr_crisis_handling}</p>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-1" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Current perception</h4>
                    <p className="text-[12px] leading-[1.5]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{result.controversy_and_pr_history.current_community_perception}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Competitor — 8px */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold tracking-[0.06em] uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                <Flame className="w-4 h-4" style={{ color: 'var(--ink-600)' }} />
                Competitor — exclusivity history
              </h3>
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}>
                {result.competitor_and_sponsorship_history?.length || 0} checked
              </span>
            </div>

            {(!result.competitor_and_sponsorship_history || result.competitor_and_sponsorship_history.length === 0) ? (
              <div className="p-4 rounded-[8px] border flex items-center gap-2 text-[13px]" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink-600)', fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-sm)' }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} />
                <span>No direct competitor conflicts detected.</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {result.competitor_and_sponsorship_history.map((spons, idx) => {
                  const isCleanNoConflict = spons.verification_status === 'not_verifiable' && spons.details?.toLowerCase().includes('no');
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-[8px] space-y-2 border"
                      style={{
                        background: isCleanNoConflict ? 'var(--score-good-bg)' : 'var(--score-warn-bg)',
                        borderColor: isCleanNoConflict ? 'rgba(5,150,105,0.18)' : 'rgba(217,119,6,0.18)',
                      }}
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
                          className="inline-flex items-center gap-1 text-xs text-[var(--ink)]-500 hover:underline pt-1"
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

          {/* 6. Red flags — 8px, cited */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold tracking-[0.06em] uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--score-risk)' }} />
                Red flags — cited
              </h3>
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}>
                {result.nuanced_red_flags?.length || 0} flags
              </span>
            </div>

            {(!result.nuanced_red_flags || result.nuanced_red_flags.length === 0) ? (
              <div className="p-4 rounded-[8px] border flex items-center gap-2 text-[13px]" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink-600)', fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-sm)' }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--score-good)' }} />
                <span>No major red flags detected.</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {result.nuanced_red_flags.map((flag, idx) => (
                  <div key={idx} className="p-4 rounded-[8px] space-y-2 border" style={{ background: 'var(--card-bg)', borderColor: 'rgba(220,38,38,0.15)', boxShadow: 'var(--shadow-sm)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--score-risk)' }}>
                        {flag.category}
                      </span>
                      {flag.video_timestamp && flag.video_timestamp !== 'N/A' && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}>
                          {flag.video_timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-semibold" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{flag.description}</p>
                    <p className="text-[12px] italic p-3 rounded-[8px] border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}>
                      <strong style={{ color: 'var(--ink)' }}>Context & impact:</strong> {flag.context_and_impact}
                    </p>
                    {flag.source_url && flag.source_url !== 'N/A' && (
                      <a
                        href={sanitizeUrl(flag.source_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] hover:underline pt-1"
                        style={{ color: 'var(--line)', fontFamily: 'var(--font-sans)' }}
                      >
                        <span>Reference source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7. Highlights — 8px */}
          {result.positive_highlights && result.positive_highlights.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[12px] font-semibold tracking-[0.06em] uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--score-good)' }} />
                Strengths
              </h3>
              <ul className="grid sm:grid-cols-2 gap-2">
                {result.positive_highlights.map((highlight, idx) => (
                  <li key={idx} className="p-3 rounded-[8px] text-[12px] leading-[1.5] flex items-start gap-2 border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-sm)' }}>
                    <ThumbsUp className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--score-good)' }} />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Citations — footnoted */}
          {result.grounding_sources && result.grounding_sources.length > 0 && (
            <div className="pt-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
              <h4 className="text-[11px] font-semibold tracking-[0.08em] uppercase flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
                <Layers className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} />
                Citations — web-grounded ({result.grounding_sources.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.grounding_sources.map((src, i) => (
                  <a
                    key={i}
                    href={sanitizeUrl(src.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1 truncate max-w-xs"
                    style={{ background: 'var(--paper)', color: 'var(--line)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}
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

      {/* History — 8px audit */}
      <section className="p-6 rounded-[8px] border space-y-5 print:hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
              <Layers className="w-5 h-5" style={{ color: 'var(--ink-600)' }} />
              Saved dossiers
            </h2>
            <p className="text-[12px] mt-0.5" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
              {history.length} audits • PII-scrubbed, hashed
            </p>
          </div>

          {/* Controls: Search, Filters & Sorting */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--zinc-400)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search dossiers…"
                className="pl-8 pr-3 py-1.5 text-xs rounded-[8px] border focus:outline-none"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
              />
            </div>

            <select
              value={sortBy}
              onChange={(e: any) => onSortByChange(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-[8px] border focus:outline-none font-medium"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
            >
              <option value="newest">Newest first</option>
              <option value="score_high">Highest score</option>
              <option value="score_low">Lowest score</option>
            </select>
          </div>
        </div>

        {/* Filter tabs — 8px, semantic */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-[12px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => onFilterStatusChange('all')}
            className="px-3 py-1.5 rounded-full font-semibold shrink-0 border"
            style={{
              background: filterStatus === 'all' ? 'var(--ink)' : 'transparent',
              color: filterStatus === 'all' ? 'var(--paper)' : 'var(--ink-600)',
              borderColor: filterStatus === 'all' ? 'var(--ink)' : 'transparent',
              fontFamily: 'var(--font-sans)',
            }}
          >
            All ({history.length})
          </button>
          <button
            onClick={() => onFilterStatusChange('sponsor')}
            className="px-3 py-1.5 rounded-full font-semibold shrink-0 border"
            style={{
              background: filterStatus === 'sponsor' ? 'var(--score-good-bg)' : 'transparent',
              color: filterStatus === 'sponsor' ? 'var(--score-good)' : 'var(--ink-600)',
              borderColor: filterStatus === 'sponsor' ? 'rgba(5,150,105,0.18)' : 'transparent',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Recommended
          </button>
          <button
            onClick={() => onFilterStatusChange('caution')}
            className="px-3 py-1.5 rounded-full font-semibold shrink-0 border"
            style={{
              background: filterStatus === 'caution' ? 'var(--score-warn-bg)' : 'transparent',
              color: filterStatus === 'caution' ? 'var(--score-warn)' : 'var(--ink-600)',
              borderColor: filterStatus === 'caution' ? 'rgba(217,119,6,0.18)' : 'transparent',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Caution
          </button>
          <button
            onClick={() => onFilterStatusChange('blacklist')}
            className="px-3 py-1.5 rounded-full font-semibold shrink-0 border"
            style={{
              background: filterStatus === 'blacklist' ? 'var(--score-risk-bg)' : 'transparent',
              color: filterStatus === 'blacklist' ? 'var(--score-risk)' : 'var(--ink-600)',
              borderColor: filterStatus === 'blacklist' ? 'rgba(220,38,38,0.18)' : 'transparent',
              fontFamily: 'var(--font-sans)',
            }}
          >
            High risk
          </button>
          <button
            onClick={() => onFilterStatusChange('cached')}
            className="px-3 py-1.5 rounded-full font-semibold shrink-0 border inline-flex items-center gap-1"
            style={{
              background: filterStatus === 'cached' ? 'var(--paper)' : 'transparent',
              color: filterStatus === 'cached' ? 'var(--ink)' : 'var(--ink-600)',
              borderColor: filterStatus === 'cached' ? 'var(--border)' : 'transparent',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Database className="w-3 h-3" style={{ color: 'var(--ink-600)' }} />
            <span>Cached</span>
          </button>
        </div>

        {/* Dossiers List */}
        {loadingHistory ? (
          <div className="flex justify-center p-8">
            <Activity className="w-6 h-6 animate-spin text-[var(--risk)]" />
          </div>
        ) : historyError ? (
          <div className="p-4 rounded-[8px] border text-[13px] text-center" style={{ background: 'var(--score-risk-bg)', borderColor: 'rgba(220,38,38,0.15)', color: 'var(--score-risk)', fontFamily: 'var(--font-sans)' }}>
            {historyError}
          </div>
        ) : filteredHistory.length === 0 ? (
          <p className="text-center py-8 text-[13px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
            {searchQuery || filterStatus !== 'all' ? 'No dossiers match your search or filter.' : 'No saved audits yet. Run your first check above.'}
          </p>
        ) : (
          <div className="grid gap-3">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectHistoryItem(item)}
                className="p-4 rounded-[8px] border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}>
                      {item.brand_name || "Brand Audit"}
                    </span>
                    {item.is_cached && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1" style={{ background: 'var(--card-bg)', color: 'var(--ink-600)', borderColor: 'var(--card-border)', fontFamily: 'var(--font-sans)' }}>
                        <Database className="w-2.5 h-2.5" /> Cached
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