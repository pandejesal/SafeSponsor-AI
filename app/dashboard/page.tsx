'use client';

import { useState, useEffect, useMemo } from "react";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth, getAppCheckToken } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { useTheme } from "@/components/ThemeProvider";
import { sanitizeUrl } from "@/lib/utils";
import { 
  ShieldAlert, Search, Activity, AlertTriangle, CheckCircle2, 
  ExternalLink, Building2, Flame, ChevronRight, Layers, AlertCircle,
  Users, MessageSquare, Scale, Ban, FileCheck, ThumbsUp, Sparkles, Globe, Shield, DollarSign, Zap,
  Printer, Share2, RefreshCw, Copy, Check, Database, Filter, Clock, BarChart2, TrendingUp, Video, Camera,
  ListOrdered, Play, XCircle, Download, CheckCircle, FileText, List, Loader2,
  ArrowUpDown, RotateCcw, SlidersHorizontal, RefreshCcw, Trash2
} from "lucide-react";

interface BatchQueueItem {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: AnalysisResult;
  error?: string;
  progressMessage?: string;
}

interface AudienceInsights {
  authenticity_rating: string;
  demographics_summary: string;
  engagement_quality: string;
  community_sentiment: string;
  toxic_recurring_themes?: string[];
  comment_sentiment_summary?: string;
}

interface PRHistory {
  past_issues_summary: string;
  pr_crisis_handling: string;
  current_community_perception: string;
}

interface CompetitorSponsorship {
  competitor_or_brand: string;
  platform: string;
  details: string;
  source_url?: string;
  verification_status: string;
}

interface NuancedRedFlag {
  category: string;
  description: string;
  context_and_impact: string;
  video_timestamp?: string;
  source_url?: string;
  verification_status: string;
}

interface FinalVerdict {
  recommendation: "Sponsor" | "Proceed with Caution" | "Blacklist" | string;
  justification: string;
  contractual_safeguards: string[];
}

interface AnalysisResult {
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
}

interface HistoryItem extends AnalysisResult {
  id: string;
  target: string;
  createdAt: any;
}

function DashboardInner() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Audit Form States
  const [target, setTarget] = useState("");
  const [brandName, setBrandName] = useState("");
  const [competitorBrands, setCompetitorBrands] = useState("");
  const [additionalUrls, setAdditionalUrls] = useState("");
  const [creatorAliases, setCreatorAliases] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [auditFocus, setAuditFocus] = useState<"standard" | "deep_compliance" | "exclusivity_matrix">("standard");

  // Batch Multi-URL Queue States
  const [auditMode, setAuditMode] = useState<'single' | 'batch'>('single');
  const [batchUrlsInput, setBatchUrlsInput] = useState('');
  const [batchItems, setBatchItems] = useState<BatchQueueItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState<number>(-1);

  // Batch Filter & Sorting States
  const [batchFilterStatus, setBatchFilterStatus] = useState<'all' | 'completed' | 'processing' | 'pending' | 'failed'>('all');
  const [batchSortBy, setBatchSortBy] = useState<'queue_order' | 'status_failed_first' | 'score_low' | 'score_high' | 'url_asc'>('queue_order');
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // User credits / subscription state
  const [userCredits, setUserCredits] = useState<{
    videoCredits: number;
    channelCredits: number;
    hasSubscription: boolean;
    subscriptionExpiresAt: string | null;
  } | null>(null);

  // Filter, Tab & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'sponsor' | 'caution' | 'blacklist' | 'cached'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'score_high' | 'score_low'>('newest');
  const [copySuccess, setCopySuccess] = useState(false);
  const [dossierTab, setDossierTab] = useState<'overview' | 'redflags' | 'competitors' | 'sentiment' | 'safeguards' | 'sources'>('overview');

  const isDark = theme === 'dark';

  // Read query params from hero search redirect
  useEffect(() => {
    const queryTarget = searchParams.get('target');
    if (queryTarget) {
      setTarget(queryTarget);
    }
  }, [searchParams]);

  // Handle payment verification on checkout return
  const [paymentVerified, setPaymentVerified] = useState<boolean | null>(null);
  useEffect(() => {
    const dodoSuccess = searchParams.get('dodo_success');
    const plan = searchParams.get('plan');
    if (dodoSuccess === 'true' && plan && user) {
      const verifyPayment = async () => {
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ plan }),
          });
          const data = await res.json();
          if (data.success) {
            setPaymentVerified(true);
          } else {
            setPaymentVerified(false);
          }
        } catch (err) {
          console.error('Payment verification error:', err);
          setPaymentVerified(false);
        }
      };
      verifyPayment();
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !db) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    const q = query(
      collection(db, "users", user.uid, "history"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hist: HistoryItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        hist.push({ id: docSnap.id, target: data.target || data.url || "Creator Audit", ...data } as HistoryItem);
      });
      setHistory(hist);
      setHistoryError(null);
      setLoadingHistory(false);
    }, (error) => {
      console.error("Firestore history snapshot error:", error);
      setHistoryError("Failed to load audit history.");
      setLoadingHistory(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUserCredits({ videoCredits: 0, channelCredits: 0, hasSubscription: false, subscriptionExpiresAt: null });
      return;
    }
    const fetchCredits = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/check-credits', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserCredits({
            videoCredits: data.videoCredits || 0,
            channelCredits: data.channelCredits || 0,
            hasSubscription: data.hasSubscription || false,
            subscriptionExpiresAt: data.subscriptionExpiresAt || null,
          });
        }
      } catch (err) {
        console.warn("Credits fetch error:", err);
      }
    };
    fetchCredits();
    const interval = setInterval(fetchCredits, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleCheckout = async (plan: string) => {
    if (!user) return;
    setLoadingPlan(plan);
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
        alert(data.error || "Failed to initiate checkout");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      alert("Failed to connect to checkout service.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleAnalyze = async (e?: React.FormEvent, isForce: boolean = false) => {
    if (e) e.preventDefault();
    if (!target || !brandName) {
      setAnalysisError(!target ? "Please enter a Target Creator handle, video URL, or channel URL." : "Your Brand Name is required to run brand safety analyses.");
      return;
    }
    if (!user) {
      setAnalysisError("Please sign in to run brand safety analyses.");
      return;
    }

    setLoadingAnalysis(true);
    setAnalysisError(null);
    setUpgradeRequired(false);
    setResult(null);

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

      const payload = {
        target: target,
        brand_name: brandName,
        competitor_brands: competitorBrands,
        additional_urls: additionalUrls,
        creator_known_aliases: creatorAliases,
        force_refresh: isForce || forceRefresh,
        audit_focus: auditFocus
      };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 402 || res.status === 403) {
          setUpgradeRequired(true);
        }
        throw new Error(errData.error || 'Analysis failed');
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setAnalysisError(err.message || "Failed to execute 360-degree brand safety audit.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const downloadJsonDossier = (res: AnalysisResult) => {
    const fileName = `safesponsor-dossier-${(res.target || 'creator').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    const jsonStr = JSON.stringify(res, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const applyPreset = (presetTarget: string, presetBrand: string, presetCompetitors: string) => {
    setTarget(presetTarget);
    setBrandName(presetBrand);
    setCompetitorBrands(presetCompetitors);
  };

  const loadSampleBatchRoster = () => {
    setBatchUrlsInput(
`youtube.com/@mrbeast
youtube.com/@mkbhd
youtube.com/@GrahamStephan
youtube.com/@DougDeMuro
youtube.com/@ijustine`
    );
    if (!brandName) setBrandName("GamerSupps");
    if (!competitorBrands) setCompetitorBrands("GFuel, Prime Energy, Red Bull");
  };

  const handleProcessBatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!brandName) {
      setAnalysisError("Your Brand Name is required to process batch creator audits.");
      return;
    }
    if (!user) {
      setAnalysisError("Please sign in to process creator audits.");
      return;
    }

    const rawLines = batchUrlsInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    if (rawLines.length === 0) {
      setAnalysisError("Please paste at least one YouTube or Instagram creator URL into the batch queue.");
      return;
    }

    if (rawLines.length > 20) {
      setAnalysisError("Batch queue is limited to 20 creators at a time. The audit engine enforces a rate limit of 10 audits per minute, so run the queue again after it completes.");
      return;
    }

    const items: BatchQueueItem[] = rawLines.map((url, idx) => ({
      id: `batch-${Date.now()}-${idx}`,
      url: url,
      status: 'pending'
    }));

    setBatchItems(items);
    setIsBatchProcessing(true);
    setAnalysisError(null);

    try {
      const token = await user.getIdToken();
      const appCheckToken = await getAppCheckToken();

      for (let i = 0; i < items.length; i++) {
        setBatchCurrentIndex(i);

        setBatchItems(prev => prev.map((item, idx) => 
          idx === i 
            ? { ...item, status: 'processing', progressMessage: 'Evaluating transcripts, FTC disclosures, & sentiment...' }
            : item
        ));

        try {
          const payload = {
            target: items[i].url,
            brand_name: brandName,
            competitor_brands: competitorBrands,
            additional_urls: "",
            creator_known_aliases: creatorAliases,
            force_refresh: forceRefresh,
            audit_focus: auditFocus
          };

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
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Audit failed');
          }

          const data: AnalysisResult = await res.json();

          setBatchItems(prev => prev.map((item, idx) => 
            idx === i 
              ? { ...item, status: 'completed', result: data, progressMessage: undefined }
              : item
          ));

          // Only set as active result if this is the first item
          if (i === 0) {
            setResult(data);
          }

        } catch (itemErr: any) {
          setBatchItems(prev => prev.map((item, idx) => 
            idx === i 
              ? { ...item, status: 'failed', error: itemErr.message || 'Audit error', progressMessage: undefined }
              : item
          ));
        }
      }
    } catch (err: any) {
      setAnalysisError(err.message || "Batch process encountered an error.");
    } finally {
      setIsBatchProcessing(false);
      setBatchCurrentIndex(-1);
    }
  };

  const downloadAllBatchJson = () => {
    const completedResults = batchItems
      .filter(item => item.status === 'completed' && item.result)
      .map(item => item.result);

    if (completedResults.length === 0) return;

    const fileName = `safesponsor-batch-dossiers-${new Date().toISOString().slice(0, 10)}.json`;
    const jsonStr = JSON.stringify(completedResults, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const viewBatchItemDossier = (item: BatchQueueItem) => {
    if (item.result) {
      setResult(item.result);
      const dossierEl = document.getElementById('dossier-results');
      if (dossierEl) {
        dossierEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const runRetry = async (targetItem: BatchQueueItem) => {
    setBatchItems(prev => prev.map(item =>
      item.id === targetItem.id
        ? { ...item, status: 'processing', error: undefined, progressMessage: 'Retrying creator brand safety audit...' }
        : item
    ));

    try {
      const token = await user!.getIdToken();
      const appCheckToken = await getAppCheckToken();

      const payload = {
        target: targetItem.url,
        brand_name: brandName,
        competitor_brands: competitorBrands,
        additional_urls: "",
        creator_known_aliases: creatorAliases,
        force_refresh: true,
        audit_focus: auditFocus
      };

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
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Audit retry failed');
      }

      const data: AnalysisResult = await res.json();

      setBatchItems(prev => prev.map(item =>
        item.id === targetItem.id
          ? { ...item, status: 'completed', result: data, error: undefined, progressMessage: undefined }
          : item
      ));

      setResult(data);
    } catch (err: any) {
      setBatchItems(prev => prev.map(item =>
        item.id === targetItem.id
          ? { ...item, status: 'failed', error: err.message || 'Audit retry failed', progressMessage: undefined }
          : item
      ));
    }
  };

  const retrySingleBatchItem = async (targetItem: BatchQueueItem) => {
    if (isBatchProcessing || !user) return;
    setIsBatchProcessing(true);
    try {
      await runRetry(targetItem);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const retryFailedBatchItems = async () => {
    if (isBatchProcessing || !user) return;
    const failedItems = batchItems.filter(i => i.status === 'failed');
    if (failedItems.length === 0) return;

    setIsBatchProcessing(true);
    try {
      for (const item of failedItems) {
        await runRetry(item);
      }
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const clearCompletedBatchItems = () => {
    setBatchItems(prev => prev.filter(i => i.status !== 'completed'));
  };

  const clearFailedBatchItems = () => {
    setBatchItems(prev => prev.filter(i => i.status !== 'failed'));
  };

  const resetBatchFilters = () => {
    setBatchFilterStatus('all');
    setBatchSortBy('queue_order');
    setBatchSearchQuery('');
  };

  const filteredAndSortedBatchItems = useMemo(() => {
    return batchItems
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (batchFilterStatus !== 'all' && item.status !== batchFilterStatus) {
          return false;
        }
        if (batchSearchQuery.trim()) {
          const q = batchSearchQuery.toLowerCase().trim();
          const urlMatch = item.url.toLowerCase().includes(q);
          const errorMatch = item.error ? item.error.toLowerCase().includes(q) : false;
          const summaryMatch = item.result?.creator_summary ? item.result.creator_summary.toLowerCase().includes(q) : false;
          const riskMatch = item.result?.risk_level ? item.result.risk_level.toLowerCase().includes(q) : false;
          const recMatch = item.result?.final_verdict?.recommendation ? item.result.final_verdict.recommendation.toLowerCase().includes(q) : false;
          if (!urlMatch && !errorMatch && !summaryMatch && !riskMatch && !recMatch) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (batchSortBy === 'status_failed_first') {
          const statusPriority: Record<string, number> = { failed: 0, processing: 1, pending: 2, completed: 3 };
          const pA = statusPriority[a.item.status] ?? 4;
          const pB = statusPriority[b.item.status] ?? 4;
          if (pA !== pB) return pA - pB;
        } else if (batchSortBy === 'score_low') {
          const scoreA = a.item.result?.brand_safety_score ?? 999;
          const scoreB = b.item.result?.brand_safety_score ?? 999;
          if (scoreA !== scoreB) return scoreA - scoreB;
        } else if (batchSortBy === 'score_high') {
          const scoreA = a.item.result?.brand_safety_score ?? -1;
          const scoreB = b.item.result?.brand_safety_score ?? -1;
          if (scoreA !== scoreB) return scoreB - scoreA;
        } else if (batchSortBy === 'url_asc') {
          return a.item.url.localeCompare(b.item.url);
        }
        return a.originalIndex - b.originalIndex;
      });
  }, [batchItems, batchFilterStatus, batchSortBy, batchSearchQuery]);

  const copyDossierSummary = (res: AnalysisResult) => {
    const summaryText = `
=== SAFESPONSOR AI EXECUTIVE DOSSIER ===
Target Creator: ${res.target || "Creator Target"}
Sponsoring Brand: ${res.brand_name || "Sponsoring Brand"}
Safety Score: ${res.brand_safety_score}/100
Risk Level: ${res.risk_level?.toUpperCase()}
Verdict: ${res.final_verdict?.recommendation}

JUSTIFICATION:
${res.final_verdict?.justification}

CREATOR PERSONA OVERVIEW:
${res.creator_summary}

AUDIENCE & COMMUNITY SENTIMENT:
- Authenticity Rating: ${res.audience_insights?.authenticity_rating || "N/A"}
- Engagement Quality: ${res.audience_insights?.engagement_quality || "N/A"}
- Community Sentiment: ${res.audience_insights?.community_sentiment || "N/A"}
${res.audience_insights?.toxic_recurring_themes?.length ? `- Toxic Themes Surfaced: ${res.audience_insights.toxic_recurring_themes.join(', ')}` : '- Toxic Themes: None detected'}

RECOMMENDED CONTRACTUAL SAFEGUARDS:
${res.final_verdict?.contractual_safeguards?.map(s => `- ${s}`).join('\n') || 'None'}

Report Generated via SafeSponsor AI Research Engine
    `.trim();

    navigator.clipboard.writeText(summaryText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) {
      return isDark 
        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" 
        : "text-emerald-700 bg-emerald-50 border-emerald-200";
    }
    if (score >= 50) {
      return isDark 
        ? "text-amber-400 bg-amber-500/10 border-amber-500/30" 
        : "text-amber-700 bg-amber-50 border-amber-200";
    }
    return isDark 
      ? "text-rose-400 bg-rose-500/10 border-rose-500/30" 
      : "text-rose-700 bg-rose-50 border-rose-200";
  };

  const getRiskBadgeColor = (risk: string) => {
    const r = risk?.toLowerCase();
    if (r === 'low') return isDark ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (r === 'medium') return isDark ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-amber-100 text-amber-800 border-amber-300";
    if (r === 'critical') return "bg-rose-600/30 text-rose-200 border-rose-500/50";
    return isDark ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-rose-100 text-rose-800 border-rose-300";
  };

  const getVerdictBadge = (recommendation: string) => {
    const rec = recommendation?.toLowerCase() || '';
    if (rec.includes('sponsor') && !rec.includes('caution')) {
      return (
        <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
          isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Recommended: Sponsor
        </span>
      );
    }
    if (rec.includes('caution')) {
      return (
        <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
          isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-100 text-amber-800 border-amber-300'
        }`}>
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Proceed with Caution
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
        isDark ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-100 text-rose-800 border-rose-300'
      }`}>
        <Ban className="w-4 h-4 text-rose-500" />
        High Risk: Blacklist
      </span>
    );
  };

  // Compute summary stats from history
  const totalAudits = history.length;
  const avgSafetyScore = totalAudits > 0 
    ? Math.round(history.reduce((acc, curr) => acc + (curr.brand_safety_score || 0), 0) / totalAudits)
    : 0;
  const recommendedAudits = history.filter(h => 
    h.final_verdict?.recommendation?.toLowerCase().includes('sponsor') && 
    !h.final_verdict?.recommendation?.toLowerCase().includes('caution')
  ).length;
  const cachedHitCount = history.filter(h => h.is_cached === true).length;

  // Filtered and sorted history
  const filteredHistory = useMemo(() => (history
    .filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchTarget = (item.target || "").toLowerCase().includes(q);
        const matchBrand = (item.brand_name || "").toLowerCase().includes(q);
        const matchSummary = (item.creator_summary || "").toLowerCase().includes(q);
        if (!matchTarget && !matchBrand && !matchSummary) return false;
      }

      if (filterStatus === 'sponsor') {
        return item.final_verdict?.recommendation?.toLowerCase().includes('sponsor') &&
               !item.final_verdict?.recommendation?.toLowerCase().includes('caution');
      }
      if (filterStatus === 'caution') {
        return item.final_verdict?.recommendation?.toLowerCase().includes('caution');
      }
      if (filterStatus === 'blacklist') {
        return item.final_verdict?.recommendation?.toLowerCase().includes('blacklist') ||
               item.risk_level?.toLowerCase() === 'high' ||
               item.risk_level?.toLowerCase() === 'critical';
      }
      if (filterStatus === 'cached') {
        return item.is_cached === true;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score_high') return (b.brand_safety_score || 0) - (a.brand_safety_score || 0);
      if (sortBy === 'score_low') return (a.brand_safety_score || 0) - (b.brand_safety_score || 0);
      return 0;
    })
  ), [history, searchQuery, filterStatus, sortBy]);

  if (authLoading || !user) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans ${
        isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
      }`}>
        <Activity className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Navbar />

      {/* Payment verification banner */}
      {paymentVerified !== null && (
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4`}>
          <div className={`p-4 rounded-xl border text-sm font-medium ${
            paymentVerified
              ? isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {paymentVerified
              ? 'Payment verified! Your credits have been applied.'
              : 'Payment received. Credits will appear shortly — if not, contact support.'}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Analytics Header Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-5 rounded-xl border transition-all ${
            isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Audits</span>
              <Layers className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black">{totalAudits}</div>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              Creator dossiers generated
            </p>
          </div>

          <div className={`p-5 rounded-xl border transition-all ${
            isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Avg Safety Score</span>
              <BarChart2 className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-orange-500">{avgSafetyScore}/100</div>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              Portfolio average risk
            </p>
          </div>

          <div className={`p-5 rounded-xl border transition-all ${
            isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Recommended</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-500">{recommendedAudits}</div>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              Safe for sponsorship
            </p>
          </div>

          <div className={`p-5 rounded-xl border transition-all ${
            isDark ? 'bg-zinc-900/80 border-cyan-500/20' : 'bg-white border-cyan-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Your Plan</span>
              <Zap className="w-4 h-4 text-cyan-500" />
            </div>
            {userCredits === null ? (
              <div className="flex items-center gap-2">
                <div className={`h-8 w-16 rounded-lg animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
              </div>
            ) : userCredits.hasSubscription ? (
              <>
                <div className="text-2xl sm:text-3xl font-black text-cyan-400">Pro</div>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-cyan-300/80' : 'text-cyan-900'}`}>
                  Unlimited audits
                  {userCredits.subscriptionExpiresAt && (
                    <> &middot; renews {new Date(userCredits.subscriptionExpiresAt).toLocaleDateString()}</>
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-xl font-black text-cyan-400">{userCredits.videoCredits}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Video</div>
                  </div>
                  <div className={`w-px h-8 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                  <div className="text-center">
                    <div className="text-xl font-black text-orange-400">{userCredits.channelCredits}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Channel</div>
                  </div>
                </div>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                  Credits remaining
                </p>
              </>
            )}
          </div>
        </div>

        {/* Upgrade Banner */}
        {upgradeRequired && (
          <div className={`p-6 rounded-xl border space-y-4 ${
            isDark ? 'bg-zinc-900/90 border-orange-500/40' : 'bg-white border-orange-300'
          }`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-500 shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold">Analysis Quota Reached</h3>
                <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  Choose a plan to continue generating comprehensive creator brand safety dossiers.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 pt-2">
              <button 
                onClick={() => handleCheckout("single")}
                disabled={loadingPlan !== null}
                className={`p-4 rounded-lg text-left border transition flex flex-col justify-between space-y-3 ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                }`}
              >
                <div>
                  <h4 className="font-bold text-sm">Single Video Report</h4>
                  <p className="text-xs text-orange-500">$10 one-time</p>
                </div>
                <span className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-cyan-400' : 'text-blue-900'}`}>
                  Buy 1 Report <ChevronRight className="w-3 h-3" />
                </span>
              </button>

              <button 
                onClick={() => handleCheckout("channel")}
                disabled={loadingPlan !== null}
                className={`p-4 rounded-lg text-left border transition flex flex-col justify-between space-y-3 ${
                  isDark ? 'bg-zinc-800/90 hover:bg-zinc-800 border-cyan-500/40' : 'bg-orange-50 hover:bg-orange-100 border-orange-300'
                }`}
              >
                <div>
                  <h4 className="font-bold text-sm">Channel Audit</h4>
                  <p className="text-xs text-orange-600">$25 one-time</p>
                </div>
                <span className="text-xs font-bold text-orange-600 flex items-center gap-1">
                  Buy Channel Report <ChevronRight className="w-3 h-3" />
                </span>
              </button>

              <button 
                onClick={() => handleCheckout("subscription")}
                disabled={loadingPlan !== null}
                className={`p-4 rounded-lg text-left border transition flex flex-col justify-between space-y-3 relative overflow-hidden ${
                  isDark ? 'bg-orange-950/40 hover:bg-orange-950/60 border-orange-500/40' : 'bg-blue-900 text-white hover:bg-blue-950 border-blue-950'
                }`}
              >
                <div className="absolute top-0 right-0 bg-orange-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl">PRO</div>
                <div>
                  <h4 className="font-bold text-sm">Unlimited Pro</h4>
                  <p className={`text-xs ${isDark ? 'text-orange-300' : 'text-slate-300'}`}>$199 / month</p>
                </div>
                <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
                  Subscribe Unlimited <ChevronRight className="w-3 h-3" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Audit Form Section */}
        <section className={`p-6 sm:p-8 rounded-xl border relative overflow-hidden transition-colors print:hidden ${
          isDark 
            ? 'bg-zinc-900/80 border-zinc-800 ring-1 ring-cyan-500/10' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h2 className="text-2xl font-black flex items-center gap-2">
                <Building2 className={`w-6 h-6 ${isDark ? 'text-cyan-400' : 'text-blue-900'}`} />
                Sponsorship Safety Audit Engine
              </h2>
              <p className={`text-sm mt-1 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Investigate YouTube video links, channel handles, or Instagram creator profiles individually or in batch queues.
              </p>
            </div>

            {/* Audit Mode Switcher Tabs */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAuditMode('single')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  auditMode === 'single'
                    ? (isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'bg-blue-900 text-white shadow-sm')
                    : (isDark ? 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Single Audit</span>
              </button>

              <button
                type="button"
                onClick={() => setAuditMode('batch')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
                  auditMode === 'batch'
                    ? (isDark ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm' : 'bg-orange-600 text-white shadow-sm')
                    : (isDark ? 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Batch Multi-URL Queue</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500 text-white">
                  NEW
                </span>
              </button>
            </div>
          </div>

          {auditMode === 'single' ? (
            <>
              {/* Single Creator Quick Presets */}
              <div className="mb-6 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Creator Sample Presets:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => applyPreset("youtube.com/@mrbeast", "GamerSupps", "GFuel, Prime Energy, Red Bull")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    }`}
                  >
                    🎮 @MrBeast (Gaming & Energy)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("youtube.com/@mkbhd", "Anker", "Belkin, Mophie, Samsung")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    }`}
                  >
                    📱 @MKBHD (Consumer Tech)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("youtube.com/@markrober", "KiwiCo", "LittleBits, Mel Science")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    }`}
                  >
                    🔬 @MarkRober (STEM & EdTech)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("youtube.com/@GrahamStephan", "Public.com", "Robinhood, Coinbase, Webull")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    }`}
                  >
                    💼 @GrahamStephan (Fintech)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("youtube.com/@DougDeMuro", "Cars & Bids", "Bring a Trailer, Hagerty")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    }`}
                  >
                    🏎️ @DougDeMuro (Automotive)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("youtube.com/@ijustine", "Canon", "Sony, Panasonic, RED")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    }`}
                  >
                    📷 @iJustine (Creator Hardware)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("youtube.com/@loganpaul", "PRIME", "Gatorade, Powerade, BodyArmor")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    }`}
                  >
                    🏋️ @LoganPaul (Fitness)
                  </button>
                </div>
              </div>

              <form onSubmit={(e) => handleAnalyze(e)} className="space-y-5">
                {/* Audit Focus Mode Selector */}
                <div className="space-y-2 pb-2">
                  <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-zinc-300' : 'text-slate-700'
                  }`}>
                    <Zap className="w-4 h-4 text-orange-500" />
                    Select Audit Depth & Research Focus Mode
                  </label>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setAuditFocus("standard")}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between space-y-1 ${
                        auditFocus === "standard"
                          ? (isDark ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/50' : 'bg-blue-50 border-blue-900 text-blue-950 font-bold')
                          : (isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700' : 'bg-slate-50 border-slate-200 text-slate-600')
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>360° Standard Audit</span>
                        {auditFocus === "standard" && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                      <p className="text-[11px] opacity-80 leading-tight">Grounded web search, transcript analysis, & YouTube comment toxicity check.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuditFocus("deep_compliance")}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between space-y-1 ${
                        auditFocus === "deep_compliance"
                          ? (isDark ? 'bg-orange-500/10 border-orange-500 text-orange-300 ring-1 ring-orange-500/50' : 'bg-orange-50 border-orange-600 text-orange-950 font-bold')
                          : (isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700' : 'bg-slate-50 border-slate-200 text-slate-600')
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>FTC & Legal Compliance</span>
                        {auditFocus === "deep_compliance" && <Check className="w-3.5 h-3.5 text-orange-400" />}
                      </div>
                      <p className="text-[11px] opacity-80 leading-tight">Enhanced scrutiny on FTC ad disclosures, regulatory history, & financial claims.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuditFocus("exclusivity_matrix")}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between space-y-1 ${
                        auditFocus === "exclusivity_matrix"
                          ? (isDark ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50' : 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold')
                          : (isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700' : 'bg-slate-50 border-slate-200 text-slate-600')
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>Competitor Exclusivity Matrix</span>
                        {auditFocus === "exclusivity_matrix" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] opacity-80 leading-tight">Deep sweep across past sponsor deals, category overlaps, & lockout windows.</p>
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  {/* Primary Target */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      isDark ? 'text-zinc-300' : 'text-slate-700'
                    }`}>
                      Target Creator Handle / Video URL <span className="text-orange-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="e.g. MrBeast, @creatorhandle, or YouTube/Instagram URL" 
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-cyan-500' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
                      }`}
                      required
                    />
                  </div>

                  {/* Brand Name */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      isDark ? 'text-zinc-300' : 'text-slate-700'
                    }`}>
                      Your Brand Name <span className="text-orange-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Gymshark, GamerSupps, Athletic Greens" 
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-cyan-500' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
                      }`}
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  {/* Competitor Brands */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                      isDark ? 'text-zinc-300' : 'text-slate-700'
                    }`}>
                      <span>Competitor Brands (Comma-separated)</span>
                      <span className="text-[10px] text-orange-500 font-bold">RECOMMENDED</span>
                    </label>
                    <input 
                      type="text" 
                      value={competitorBrands}
                      onChange={(e) => setCompetitorBrands(e.target.value)}
                      placeholder="e.g. Nike, Adidas, Under Armour, Lululemon" 
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-cyan-500' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
                      }`}
                    />
                  </div>

                  {/* Creator Aliases */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'text-zinc-300' : 'text-slate-700'
                    }`}>
                      Creator Aliases / Known Handles (Optional)
                    </label>
                    <input 
                      type="text" 
                      value={creatorAliases}
                      onChange={(e) => setCreatorAliases(e.target.value)}
                      placeholder="e.g. @realcreator, John Doe, CreatorVlogs" 
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-cyan-500' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Additional URLs */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                    isDark ? 'text-zinc-300' : 'text-slate-700'
                  }`}>
                    <span>Additional Links / Posts of Concern (Optional)</span>
                    <span className="text-[10px] text-slate-400 font-medium">One URL per line</span>
                  </label>
                  <textarea 
                    rows={2}
                    value={additionalUrls}
                    onChange={(e) => setAdditionalUrls(e.target.value)}
                    placeholder="https://youtube.com/watch?v=...&#10;https://instagram.com/p/..." 
                    className={`w-full border rounded-xl p-3 text-sm focus:outline-none transition resize-none ${
                      isDark 
                        ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-cyan-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
                    }`}
                  />
                </div>

                {/* Options bar: Force Refresh Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={forceRefresh}
                      onChange={(e) => setForceRefresh(e.target.checked)}
                      className="rounded border-zinc-700 text-orange-600 focus:ring-orange-500 w-4 h-4"
                    />
                    <span className={isDark ? 'text-zinc-300' : 'text-slate-700'}>
                      Force Re-Audit (Bypass Global Database Cache)
                    </span>
                  </label>

                  <button 
                    type="submit" 
                    disabled={loadingAnalysis} 
                    className={`font-bold px-8 py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                      isDark
                        ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                  >
                    {loadingAnalysis ? (
                      <>
                        <Activity className="w-5 h-5 animate-spin" />
                        <span>Checking Cache & Researching Creator...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        <span>Run 360° Safety Audit</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Batch Multi-URL Queue Form */
            <form onSubmit={handleProcessBatch} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-zinc-300' : 'text-slate-700'
                }`}>
                  <ListOrdered className="w-4 h-4 text-orange-500" />
                  Paste Creator Handles or Video/Post URLs (One Per Line)
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadSampleBatchRoster}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                      isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20' : 'bg-orange-50 border-orange-200 text-orange-900 hover:bg-orange-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                    Load Sample Creator Roster (5 Creators)
                  </button>
                  {batchUrlsInput && (
                    <button
                      type="button"
                      onClick={() => setBatchUrlsInput("")}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition ${
                        isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={6}
                value={batchUrlsInput}
                onChange={(e) => setBatchUrlsInput(e.target.value)}
                placeholder={`Paste YouTube channel handles, video links, or Instagram creator profiles here...\n\nExample:\nyoutube.com/@mrbeast\nyoutube.com/@mkbhd\nyoutube.com/@GrahamStephan\nyoutube.com/@DougDeMuro\nyoutube.com/@ijustine`}
                className={`w-full border rounded-lg p-4 text-sm font-mono focus:outline-none transition ${
                  isDark 
                    ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-600 focus:border-orange-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
                }`}
                disabled={isBatchProcessing}
              />

              <div className="grid md:grid-cols-2 gap-5">
                {/* Shared Brand Name */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-zinc-300' : 'text-slate-700'
                  }`}>
                    Your Sponsoring Brand Name <span className="text-orange-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. GamerSupps, Gymshark, Athletic Greens" 
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition ${
                      isDark 
                        ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-orange-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
                    }`}
                    required
                    disabled={isBatchProcessing}
                  />
                </div>

                {/* Shared Competitors */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                    isDark ? 'text-zinc-300' : 'text-slate-700'
                  }`}>
                    <span>Competitor Brands to Exclude</span>
                    <span className="text-[10px] text-orange-500 font-bold">RECOMMENDED</span>
                  </label>
                  <input 
                    type="text" 
                    value={competitorBrands}
                    onChange={(e) => setCompetitorBrands(e.target.value)}
                    placeholder="e.g. GFuel, Prime Energy, Red Bull" 
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition ${
                      isDark 
                        ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-orange-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
                    }`}
                    disabled={isBatchProcessing}
                  />
                </div>
              </div>

              {/* Focus mode for batch */}
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-zinc-300' : 'text-slate-700'
                }`}>
                  <Zap className="w-4 h-4 text-orange-500" />
                  Audit Depth Mode
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setAuditFocus("standard")}
                    disabled={isBatchProcessing}
                    className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                      auditFocus === "standard"
                        ? (isDark ? 'bg-orange-500/10 border-orange-500 text-orange-300' : 'bg-orange-50 border-orange-600 text-orange-950 font-bold')
                        : (isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600')
                    }`}
                  >
                    <span className="text-xs font-bold">360° Standard Audit</span>
                    <span className="text-[11px] opacity-80">Full web research & toxicity sweep</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditFocus("deep_compliance")}
                    disabled={isBatchProcessing}
                    className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                      auditFocus === "deep_compliance"
                        ? (isDark ? 'bg-orange-500/10 border-orange-500 text-orange-300' : 'bg-orange-50 border-orange-600 text-orange-950 font-bold')
                        : (isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600')
                    }`}
                  >
                    <span className="text-xs font-bold">FTC & Legal Focus</span>
                    <span className="text-[11px] opacity-80">Scrutinize disclosures & regulations</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditFocus("exclusivity_matrix")}
                    disabled={isBatchProcessing}
                    className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                      auditFocus === "exclusivity_matrix"
                        ? (isDark ? 'bg-orange-500/10 border-orange-500 text-orange-300' : 'bg-orange-50 border-orange-600 text-orange-950 font-bold')
                        : (isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600')
                    }`}
                  >
                    <span className="text-xs font-bold">Exclusivity Sweep</span>
                    <span className="text-[11px] opacity-80">Past competitor sponsorships focus</span>
                  </button>
                </div>
              </div>

              {/* Submit Row */}
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={forceRefresh}
                    onChange={(e) => setForceRefresh(e.target.checked)}
                    className="rounded border-zinc-700 text-orange-600 focus:ring-orange-500 w-4 h-4"
                    disabled={isBatchProcessing}
                  />
                  <span className={isDark ? 'text-zinc-300' : 'text-slate-700'}>
                    Force Re-Audit (Bypass Database Cache)
                  </span>
                </label>

                <button 
                  type="submit" 
                  disabled={isBatchProcessing || !batchUrlsInput.trim()} 
                  className={`font-bold px-8 py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                    isDark
                      ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  {isBatchProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>Processing Creator Queue ({batchCurrentIndex + 1}/{batchItems.length})...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Start Batch Multi-URL Queue Audit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Batch Processing Queue Live Dashboard Indicators */}
          {batchItems.length > 0 && (
            <div className="mt-8 pt-8 border-t border-slate-200 dark:border-zinc-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <ListOrdered className="w-5 h-5 text-orange-500" />
                    Batch Queue Processing Indicators ({batchItems.length} Total)
                  </h3>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Real-time status tracking for queued creator brand safety audits. Filter or sort queue items below.
                  </p>
                </div>

                {/* Master Export Button */}
                {batchItems.some(i => i.status === 'completed') && (
                  <button
                    onClick={downloadAllBatchJson}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                      isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20' : 'bg-orange-50 border-orange-300 text-orange-900 hover:bg-orange-100'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download All Batch Dossiers (JSON)</span>
                  </button>
                )}
              </div>

              {/* Status Counters Row (Interactive Filter Cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setBatchFilterStatus(prev => prev === 'completed' ? 'all' : 'completed')}
                  className={`p-3 rounded-lg border text-left transition flex items-center gap-3 cursor-pointer ${
                    batchFilterStatus === 'completed'
                      ? (isDark ? 'bg-emerald-950/40 border-emerald-500/60 ring-2 ring-emerald-500/30' : 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300')
                      : (isDark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300')
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Completed</div>
                    <div className="text-lg font-black">{batchItems.filter(i => i.status === 'completed').length}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchFilterStatus(prev => prev === 'processing' ? 'all' : 'processing')}
                  className={`p-3 rounded-lg border text-left transition flex items-center gap-3 cursor-pointer ${
                    batchFilterStatus === 'processing'
                      ? (isDark ? 'bg-blue-950/40 border-blue-500/60 ring-2 ring-blue-500/30' : 'bg-blue-50 border-blue-400 ring-2 ring-blue-300')
                      : (isDark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300')
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <Loader2 className={`w-5 h-5 ${isBatchProcessing ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Processing</div>
                    <div className="text-lg font-black">{batchItems.filter(i => i.status === 'processing').length}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchFilterStatus(prev => prev === 'pending' ? 'all' : 'pending')}
                  className={`p-3 rounded-lg border text-left transition flex items-center gap-3 cursor-pointer ${
                    batchFilterStatus === 'pending'
                      ? (isDark ? 'bg-zinc-800 border-zinc-500 ring-2 ring-zinc-500/30' : 'bg-slate-200 border-slate-400 ring-2 ring-slate-300')
                      : (isDark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300')
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-zinc-500/10 text-zinc-400 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Queued</div>
                    <div className="text-lg font-black">{batchItems.filter(i => i.status === 'pending').length}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchFilterStatus(prev => prev === 'failed' ? 'all' : 'failed')}
                  className={`p-3 rounded-lg border text-left transition flex items-center gap-3 cursor-pointer ${
                    batchFilterStatus === 'failed'
                      ? (isDark ? 'bg-rose-950/40 border-rose-500/60 ring-2 ring-rose-500/30' : 'bg-rose-50 border-rose-400 ring-2 ring-rose-300')
                      : (isDark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300')
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Failed</div>
                    <div className="text-lg font-black">{batchItems.filter(i => i.status === 'failed').length}</div>
                  </div>
                </button>
              </div>

              {/* Animated Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>Queue Completion Progress</span>
                  <span className="text-orange-500">
                    {Math.round(((batchItems.filter(i => i.status === 'completed' || i.status === 'failed').length) / batchItems.length) * 100)}%
                  </span>
                </div>
                <div className={`w-full h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>
                  <div 
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500 rounded-full"
                    style={{ width: `${((batchItems.filter(i => i.status === 'completed' || i.status === 'failed').length) / batchItems.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Batch Queue Controls Toolbar: Status Pills, Search Input, Sort Dropdown & Actions */}
              <div className={`p-4 rounded-lg border space-y-3 ${isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-100/80 border-slate-200'}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  
                  {/* Status Filter Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
                      <Filter className="w-3.5 h-3.5" />
                      Filter:
                    </span>
                    <button
                      type="button"
                      onClick={() => setBatchFilterStatus('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        batchFilterStatus === 'all'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : (isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300')
                      }`}
                    >
                      All ({batchItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchFilterStatus('failed')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        batchFilterStatus === 'failed'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : batchItems.some(i => i.status === 'failed')
                          ? (isDark ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30' : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100')
                          : (isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300')
                      }`}
                    >
                      Failed ({batchItems.filter(i => i.status === 'failed').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchFilterStatus('completed')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        batchFilterStatus === 'completed'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : (isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300')
                      }`}
                    >
                      Completed ({batchItems.filter(i => i.status === 'completed').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchFilterStatus('processing')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        batchFilterStatus === 'processing'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : (isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300')
                      }`}
                    >
                      Processing ({batchItems.filter(i => i.status === 'processing').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchFilterStatus('pending')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        batchFilterStatus === 'pending'
                          ? 'bg-zinc-600 text-white shadow-sm'
                          : (isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300')
                      }`}
                    >
                      Queued ({batchItems.filter(i => i.status === 'pending').length})
                    </button>
                  </div>

                  {/* Actions Right: Retry Failed & Reset Filters */}
                  <div className="flex items-center gap-2">
                    {batchItems.some(i => i.status === 'failed') && (
                      <button
                        type="button"
                        onClick={retryFailedBatchItems}
                        disabled={isBatchProcessing}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                          isDark
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
                            : 'bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200'
                        } disabled:opacity-50`}
                        title="Retry all failed items in the batch queue"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isBatchProcessing ? 'animate-spin' : ''}`} />
                        <span>Retry Failed ({batchItems.filter(i => i.status === 'failed').length})</span>
                      </button>
                    )}

                    {(batchFilterStatus !== 'all' || batchSearchQuery || batchSortBy !== 'queue_order') && (
                      <button
                        type="button"
                        onClick={resetBatchFilters}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border ${
                          isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Filters</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Second Row: Search Input & Sort Dropdown */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                  <div className="relative w-full sm:flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={batchSearchQuery}
                      onChange={(e) => setBatchSearchQuery(e.target.value)}
                      placeholder="Search queue items by URL, error, summary, or recommendation..."
                      className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        isDark ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    {batchSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setBatchSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0">
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      Sort:
                    </span>
                    <select
                      value={batchSortBy}
                      onChange={(e) => setBatchSortBy(e.target.value as any)}
                      className={`w-full sm:w-auto px-3 py-1.5 text-xs font-bold rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="queue_order">Queue Order (#1, #2...)</option>
                      <option value="status_failed_first">Status: Failed First</option>
                      <option value="score_low">Safety Score: Lowest First (High Risk)</option>
                      <option value="score_high">Safety Score: Highest First</option>
                      <option value="url_asc">Creator URL: A to Z</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Items Counter Bar */}
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
                <span>
                  Showing {filteredAndSortedBatchItems.length} of {batchItems.length} items
                  {batchFilterStatus !== 'all' && <span className="ml-1 text-orange-500">({batchFilterStatus} only)</span>}
                  {batchSearchQuery && <span className="ml-1 text-orange-500">(matching &quot;{batchSearchQuery}&quot;)</span>}
                </span>
                {filteredAndSortedBatchItems.length < batchItems.length && (
                  <button
                    onClick={resetBatchFilters}
                    className="text-orange-500 hover:underline flex items-center gap-1"
                  >
                    Clear Filter Constraints
                  </button>
                )}
              </div>

              {/* Batch Queue Items List */}
              {filteredAndSortedBatchItems.length === 0 ? (
                <div className={`p-8 rounded-lg border text-center space-y-3 ${
                  isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <Filter className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                  <p className="text-sm font-bold">No queue items match your active status or search filter.</p>
                  <p className="text-xs text-slate-400">Try adjusting your status filter or search query to locate specific creator items.</p>
                  <button
                    onClick={resetBatchFilters}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Queue Filters</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAndSortedBatchItems.map(({ item, originalIndex }) => {
                    const isCompleted = item.status === 'completed' && item.result;
                    const res = item.result;
                    
                    let recBg = isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-900 border-emerald-200';
                    if (res?.final_verdict?.recommendation === "Proceed with Caution") {
                      recBg = isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-900 border-amber-200';
                    } else if (res?.final_verdict?.recommendation === "Blacklist") {
                      recBg = isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-900 border-rose-200';
                    }

                    return (
                      <div 
                        key={item.id}
                        className={`p-4 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          item.status === 'processing'
                            ? (isDark ? 'bg-cyan-950/20 border-cyan-500/40 ring-1 ring-cyan-500/20' : 'bg-blue-50 border-blue-300')
                            : item.status === 'failed'
                            ? (isDark ? 'bg-rose-950/10 border-rose-500/30' : 'bg-rose-50/50 border-rose-200')
                            : (isDark ? 'bg-zinc-950/80 border-zinc-800/80' : 'bg-slate-50 border-slate-200')
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-400">#{originalIndex + 1}</span>
                            <span className="font-bold text-sm truncate">{item.url}</span>
                          </div>

                          {/* Progress Status Description */}
                          {item.status === 'pending' && (
                            <div className="text-xs text-slate-400 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Queued — Waiting for turn</span>
                            </div>
                          )}

                          {item.status === 'processing' && (
                            <div className="text-xs text-cyan-400 flex items-center gap-1.5 font-medium">
                              <Activity className="w-3.5 h-3.5 animate-spin" />
                              <span>{item.progressMessage || 'Auditing creator transcripts & web disclosures...'}</span>
                            </div>
                          )}

                          {item.status === 'failed' && (
                            <div className="text-xs text-rose-400 flex items-center gap-1.5 font-medium">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Failed: {item.error || 'Audit failure'}</span>
                            </div>
                          )}

                          {isCompleted && res && (
                            <p className={`text-xs line-clamp-1 opacity-80 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                              {res.creator_summary}
                            </p>
                          )}
                        </div>

                        {/* Right Controls / Badges */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {isCompleted && res && (
                            <>
                              {/* Score Pill */}
                              <div className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
                                res.brand_safety_score >= 80 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                  : res.brand_safety_score >= 60 
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}>
                                Score: {res.brand_safety_score}/100
                              </div>

                              {/* Verdict Badge */}
                              <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${recBg}`}>
                                {res.final_verdict?.recommendation || 'Evaluated'}
                              </div>

                              {/* Actions */}
                              <button
                                onClick={() => viewBatchItemDossier(item)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                                  isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-cyan-300' : 'bg-white border-slate-300 hover:bg-slate-100 text-blue-900 shadow-sm'
                                }`}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Dossier</span>
                              </button>

                              <button
                                onClick={() => downloadJsonDossier(res)}
                                className={`p-1.5 rounded-xl border transition ${
                                  isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-orange-400' : 'bg-white border-slate-300 hover:bg-slate-100 text-orange-600'
                                }`}
                                title="Download Individual JSON Dossier"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {item.status === 'failed' && (
                            <button
                              onClick={() => retrySingleBatchItem(item)}
                              disabled={isBatchProcessing}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                                isDark ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30' : 'bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200'
                              } disabled:opacity-50`}
                              title="Retry individual item audit"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retry</span>
                            </button>
                          )}

                          {item.status === 'pending' && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                              Queued
                            </span>
                          )}

                          {item.status === 'processing' && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Auditing
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {analysisError && !upgradeRequired && (
            <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{analysisError}</p>
            </div>
          )}
        </section>

        {/* Always-Visible Pricing & Upgrade Section */}
        {userCredits !== null && !userCredits.hasSubscription && (
          <section className={`p-6 sm:p-8 rounded-xl border space-y-5 print:hidden ${
            isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <DollarSign className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                  Upgrade Your Research Capacity
                </h2>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  {userCredits.videoCredits === 0 && userCredits.channelCredits === 0
                    ? "You have no credits remaining. Purchase a plan to continue generating dossiers."
                    : `${userCredits.videoCredits} video + ${userCredits.channelCredits} channel credits remaining.`}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <button 
                onClick={() => handleCheckout("single")}
                disabled={loadingPlan !== null}
                className={`p-5 rounded-lg text-left border transition-all flex flex-col justify-between space-y-4 ${
                  isDark 
                    ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 hover:border-zinc-600' 
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className={`text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>$10</div>
                  <h4 className="font-bold text-sm">Single Video Report</h4>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    One-time purchase. Analyze a single YouTube video or creator profile with a full 360° brand safety dossier.
                  </p>
                </div>
                <span className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-cyan-400' : 'text-blue-900'}`}>
                  Purchase Report <ChevronRight className="w-3 h-3" />
                </span>
              </button>

              <button 
                onClick={() => handleCheckout("channel")}
                disabled={loadingPlan !== null}
                className={`p-5 rounded-lg text-left border transition-all flex flex-col justify-between space-y-4 ${
                  isDark 
                    ? 'bg-zinc-800/90 hover:bg-zinc-800 border-cyan-500/30 hover:border-cyan-500/50' 
                    : 'bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-300'
                }`}
              >
                <div className="space-y-1">
                  <div className={`text-2xl font-black ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>$25</div>
                  <h4 className="font-bold text-sm">Channel Audit</h4>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    One-time purchase. Deep channel-level brand safety analysis covering audience, competitors, and content history.
                  </p>
                </div>
                <span className="text-xs font-bold text-orange-500 flex items-center gap-1">
                  Purchase Channel Report <ChevronRight className="w-3 h-3" />
                </span>
              </button>

              <button 
                onClick={() => handleCheckout("subscription")}
                disabled={loadingPlan !== null}
                className={`p-5 rounded-lg text-left border transition-all flex flex-col justify-between space-y-4 relative overflow-hidden ${
                  isDark 
                    ? 'bg-orange-950/40 hover:bg-orange-950/60 border-orange-500/40 hover:border-orange-500/60' 
                    : 'bg-blue-900 text-white hover:bg-blue-950 border-blue-800'
                }`}
              >
                <div className="absolute top-0 right-0 bg-orange-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-bl-xl">BEST VALUE</div>
                <div className="space-y-1">
                  <div className={`text-2xl font-black ${isDark ? 'text-orange-300' : 'text-white'}`}>$199<small className="text-sm font-medium">/mo</small></div>
                  <h4 className="font-bold text-sm">Unlimited Pro</h4>
                  <p className={`text-xs ${isDark ? 'text-orange-200/60' : 'text-blue-200'}`}>
                    Monthly subscription. Unlimited creator audits, batch processing, priority analysis, and full export capabilities.
                  </p>
                </div>
                <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
                  Subscribe Unlimited <ChevronRight className="w-3 h-3" />
                </span>
              </button>
            </div>
          </section>
        )}

        {/* Executive Dossier Results View */}
        {result && (
          <section className={`p-6 sm:p-8 rounded-xl border space-y-8 animate-in fade-in duration-300 printable-dossier ${
            isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200'
          }`}>
            {/* Agency Print PDF Report Header */}
            <div className="hidden print:flex flex-col pb-4 border-b-2 border-cyan-600 mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black">
                    <ShieldAlert className="w-6 h-6 text-cyan-400" />
                  </div>
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

            {/* Cache Hit Notice Banner */}
            {result.is_cached && (
              <div className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden ${
                isDark ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
              }`}>
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <span>Instant Database Cache Hit</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        Zero API Cost
                      </span>
                    </h4>
                    <p className="text-xs opacity-80">
                      Retrieved from SafeSponsor AI global database (Last analyzed: {result.cached_at ? new Date(result.cached_at).toLocaleDateString() : 'Recently'}).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAnalyze(undefined, true)}
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
                {/* Copy Markdown Summary */}
                <button
                  onClick={() => copyDossierSummary(result)}
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
                  onClick={() => downloadJsonDossier(result)}
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dossier..."
                  className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none transition ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500' : 'bg-slate-100 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
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
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                filterStatus === 'all'
                  ? (isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-blue-900 text-white')
                  : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              All Dossiers ({history.length})
            </button>
            <button
              onClick={() => setFilterStatus('sponsor')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                filterStatus === 'sponsor'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              Recommended
            </button>
            <button
              onClick={() => setFilterStatus('caution')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                filterStatus === 'caution'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              Caution
            </button>
            <button
              onClick={() => setFilterStatus('blacklist')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                filterStatus === 'blacklist'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              High Risk / Blacklist
            </button>
            <button
              onClick={() => setFilterStatus('cached')}
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
                  onClick={() => {
                    setResult(item);
                    window.scrollTo({ top: 500, behavior: 'smooth' });
                  }}
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
                      {item.brand_safety_score}/100
                    </span>
                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-xl border ${getRiskBadgeColor(item.risk_level)}`}>
                      {item.risk_level}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return (
      <div className="min-h-screen dark:bg-zinc-950 bg-slate-50 dark:text-zinc-200 text-slate-900 flex items-center justify-center font-sans">
        Loading SafeSponsor Research Engine...
      </div>
    );
  }
  
  return (
    <AuthProvider>
      <DashboardInner />
    </AuthProvider>
  );
}
