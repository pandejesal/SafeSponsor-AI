'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, getAppCheckToken } from "@/lib/firebase";
import { Navbar } from "@/components/Navbar";
import { TestModeBadge } from "@/components/TestModeBadge";
import { useTheme } from "@/components/ThemeProvider";
import { sanitizeUrl } from "@/lib/utils";
import type { AnalysisResult, HistoryItem } from "./dossier-viewer";
import {
  Search, Activity, AlertTriangle, CheckCircle2,
  Building2, ChevronRight, Layers, AlertCircle,
  Ban, Sparkles, DollarSign, Zap,
  Check, Filter, Clock, BarChart2,
  ListOrdered, Play, XCircle, Download, CheckCircle, FileText, Loader2,
  ArrowUpDown, RotateCcw, RefreshCcw, X, Lock, ShieldCheck
} from "lucide-react";

// Heavy dossier/history sections are lazy-loaded so the dashboard's initial
// bundle stays small (they are the largest JSX blocks on the page).
const DossierViewer = dynamic(
  () => import("./dossier-viewer").then((m) => m.DossierViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    ),
  }
);

interface BatchQueueItem {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: AnalysisResult;
  error?: string;
  progressMessage?: string;
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
  const [auditMode, setAuditMode] = useState<'single' | 'batch' | 'free'>('single');
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
  // M3T3 — pre-checkout intro banner ($99 first month). Dismissible, shows once
  // per session: the dismissal is persisted to localStorage so it never re-opens
  // after the user closes it, and it never auto-pops.
  const [introBannerDismissed, setIntroBannerDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("ssa_intro_banner_dismissed") === "1") {
        setIntroBannerDismissed(true);
      }
    } catch {
      // Storage unavailable — keep showing the banner.
    }
  }, []);
  const dismissIntroBanner = () => {
    try {
      localStorage.setItem("ssa_intro_banner_dismissed", "1");
    } catch {
      // Storage unavailable — dismiss for this render only.
    }
    setIntroBannerDismissed(true);
  };
  const [auditComplete, setAuditComplete] = useState(false);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Guards the batch audit loop against setState-after-unmount: the loop is
  // async and may still be awaiting a fetch when the component unmounts, so
  // every state write inside it is gated on this ref.
  const isMountedRef = useRef(true);
  useEffect(() => {
    // Re-assert true on every setup so React StrictMode's dev-only
    // mount -> cleanup -> mount cycle (and HMR remounts) does not leave the
    // flag stuck at false and silently disable the batch loop in dev.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // User credits / subscription state
  const [userCredits, setUserCredits] = useState<{
    videoCredits: number;
    channelCredits: number;
    hasSubscription: boolean;
    subscriptionExpiresAt: string | null;
    cancelAtPeriodEnd: boolean;
    // Server-derived: true only when DODO_PAYMENTS_DISCOUNT_CODE_PRO_INTRO is
    // configured, so the $99 banner never promises a price checkout can't
    // deliver. Falsy when unconfigured OR the field is missing (old server).
    introAvailable: boolean;
    // True once the user has already used the intro (introProClaimed stamped) —
    // the banner must not promise $99 to a user who would be billed $149.
    introClaimed: boolean;
    // N1T2 — 1-per-account teaser cap shared with the homepage hero. True
    // after the free check has been run from either surface.
    freeTeaserUsed: boolean;
    // Billing plan key: "subscription" (monthly) | "subscription_annual" | null
    plan: string | null;
  } | null>(null);
  const [cancellingSub, setCancellingSub] = useState(false);
  const [cancelStep, setCancelStep] = useState<0 | 1 | 2 | 3>(0); // 0=closed, 1=reason, 2=confirm, 3=typing
  const [cancelReason, setCancelReason] = useState("");
  const [cancelTyping, setCancelTyping] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  // P4 — post-purchase Channel Report upsell popup (one-click charge).
  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellState, setUpsellState] = useState<"idle" | "charging" | "success" | "redirect" | "error">("idle");
  const [upsellError, setUpsellError] = useState<string | null>(null);
  const upsellPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (upsellPollRef.current) clearInterval(upsellPollRef.current);
  }, []);

  // Filter, Tab & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'sponsor' | 'caution' | 'blacklist' | 'cached'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'score_high' | 'score_low'>('newest');
  const [copySuccess, setCopySuccess] = useState(false);

  const isDark = theme === 'dark';

  // Read query params from hero search redirect (consume once so later navigations
  // don't clobber whatever the user has typed into the form)
  const consumedTargetRef = useRef(false);
  useEffect(() => {
    const queryTarget = searchParams.get('target');
    if (queryTarget && !consumedTargetRef.current) {
      setTarget(queryTarget);
      consumedTargetRef.current = true;
    }
  }, [searchParams]);

  // Handle payment verification on checkout return
  const [paymentVerified, setPaymentVerified] = useState<boolean | null>(null);
  useEffect(() => {
    const dodoSuccess = searchParams.get('dodo_success');
    const plan = searchParams.get('plan');
    if (dodoSuccess === 'true' && plan && user) {
      // P4 — a Single (or 3-pack, which lands on plan=single) purchase opens
      // the Channel Report upsell popup on this landing. Never on channel /
      // subscription landings, and it can be dismissed.
      if (plan === 'single') {
        setShowUpsell(true);
        setUpsellState('idle');
        setUpsellError(null);
      }
      const verifyPayment = async () => {
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ plan }),
          });
          const data = await res.json();
          setPaymentVerified(data.success === true);
        } catch (err) {
          console.error('Payment verification error:', err);
          setPaymentVerified(false);
        } finally {
          // Strip the ?dodo_success=&plan= params so a refresh doesn't re-verify
          // and the banner can be dismissed cleanly.
          router.replace('/dashboard', { scroll: false });
        }
      };
      verifyPayment();
    }
  }, [searchParams, user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      const targetParam = searchParams.get('target');
      if (targetParam) {
        router.push(`/login?target=${encodeURIComponent(targetParam)}`);
      } else {
        router.push('/login');
      }
    }
  }, [user, authLoading, router, searchParams]);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    const loadHistory = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/history', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        setHistory(Array.isArray(data.history) ? data.history : []);
        setHistoryError(null);
      } catch (err) {
        if (!cancelled) {
          console.error("Audit history load error:", err);
          setHistoryError("Failed to load audit history.");
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };
    loadHistory();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUserCredits({ videoCredits: 0, channelCredits: 0, hasSubscription: false, subscriptionExpiresAt: null, cancelAtPeriodEnd: false, introAvailable: false, introClaimed: false, freeTeaserUsed: false, plan: null });
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
          applyServerCredits(data);
        }
      } catch (err) {
        console.warn("Credits fetch error:", err);
      }
    };
    fetchCredits();
    // Poll credits only while the tab is visible — prevents 6 reads/min per
    // background tab forever. Falls back to the 10s interval on focus regain.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCredits();
      }
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchCredits();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  // P4 — merge a /api/check-credits payload into userCredits. Keeps the
  // optimistic cancelAtPeriodEnd guard from the cancel flow: a stale in-flight
  // poll response must never revert the flag set right after cancelling.
  const applyServerCredits = (data: any) => {
    setUserCredits(prev => {
      const serverCancel = data.cancelAtPeriodEnd === true;
      if (prev?.cancelAtPeriodEnd && !serverCancel) {
        return prev;
      }
      return {
        videoCredits: data.videoCredits || 0,
        channelCredits: data.channelCredits || 0,
        hasSubscription: data.hasSubscription || false,
        subscriptionExpiresAt: data.subscriptionExpiresAt || null,
        cancelAtPeriodEnd: serverCancel,
        // Falsy when unconfigured or absent from an older server — the $99
        // banner stays hidden rather than over-promising.
        introAvailable: data.introAvailable === true,
        introClaimed: data.introClaimed === true,
        freeTeaserUsed: data.freeTeaserUsed === true,
        plan: typeof data.plan === "string" ? data.plan : null,
      };
    });
  };

  // P4 — one-click upsell: /api/upsell charges the saved card (confirm:true)
  // or returns a standard checkout URL. On one-click success, poll credits a
  // few times so the granted Channel Report credit shows up without a reload.
  const handleUpsell = async () => {
    if (!user) return;
    setUpsellState("charging");
    setUpsellError(null);
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
      const res = await fetch('/api/upsell', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan: 'channel' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upsell failed. Please try again.');
      }
      if (data.ok === true) {
        setUpsellState("success");
        let tries = 0;
        upsellPollRef.current = setInterval(async () => {
          tries += 1;
          try {
            const t = await user.getIdToken();
            const r = await fetch('/api/check-credits', { headers: { 'Authorization': `Bearer ${t}` } });
            if (r.ok) {
              const c = await r.json();
              if ((c.channelCredits || 0) > 0 || tries >= 5) {
                applyServerCredits(c);
                if (upsellPollRef.current) clearInterval(upsellPollRef.current);
              }
            } else if (tries >= 5 && upsellPollRef.current) {
              clearInterval(upsellPollRef.current);
            }
          } catch {
            if (tries >= 5 && upsellPollRef.current) clearInterval(upsellPollRef.current);
          }
        }, 2000);
      } else if (data.url) {
        setUpsellState("redirect");
        // Popup blockers can return null from window.open — never leave the
        // user on a dead button; navigate in place instead.
        const win = window.open(data.url, '_blank', 'noopener');
        if (!win) {
          window.location.href = data.url;
        }
      } else {
        throw new Error(data.error || 'Upsell failed. Please try again.');
      }
    } catch (err: any) {
      console.error("Upsell error:", err);
      setUpsellState("error");
      setUpsellError(err?.message || "Failed to start upsell.");
    }
  };

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

  // N1T4 — dashboard teaser tab. Same 1-per-account cap as the homepage hero
  // (server-enforced via freeAnalysisUsed), so using one surface blocks the
  // other. Result is the trimmed headline verdict only.
  const [teaserInput, setTeaserInput] = useState("");
  const [teaserResult, setTeaserResult] = useState<{
    status: 'idle' | 'loading' | 'done' | 'used' | 'error';
    score?: number;
    riskLevel?: string;
    flags?: { category: string; description: string }[];
    error?: string;
  }>({ status: 'idle' });

  const runTeaser = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = teaserInput.trim();
    if (!t || !user) return;
    setTeaserResult({ status: 'loading' });
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
        body: JSON.stringify({ target: t, teaser: true }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setUserCredits(prev => prev ? { ...prev, freeTeaserUsed: true } : prev);
        setTeaserResult({ status: 'used', error: data.error || 'Free teaser already used' });
        return;
      }
      if (!res.ok) {
        setTeaserResult({ status: 'error', error: data.error || 'Failed to run the free check. Please try again.' });
        return;
      }
      setUserCredits(prev => prev ? { ...prev, freeTeaserUsed: true } : prev);
      setTeaserResult({
        status: 'done',
        score: data.brand_safety_score,
        riskLevel: data.risk_level,
        flags: Array.isArray(data.top_red_flags) ? data.top_red_flags : [],
      });
    } catch (err) {
      console.error("Teaser error:", err);
      setTeaserResult({ status: 'error', error: 'Failed to connect. Please try again.' });
    }
  };

  // N1T5 — teaser upsell: $8 full dossier primary, $149 Pro secondary.
  const renderTeaserUpsell = () => (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={() => handleCheckout('single')}
        disabled={!!loadingPlan}
        className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 ${
          isDark
            ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-orange-950/50'
            : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'
        }`}
      >
        <Lock className="w-4 h-4" />
        {loadingPlan === 'single' ? 'Opening checkout…' : '$8 — Unlock the Full Dossier'}
      </button>
      <button
        type="button"
        onClick={() => handleCheckout('subscription')}
        disabled={!!loadingPlan}
        className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 ${
          isDark
            ? 'bg-zinc-950 text-zinc-200 border-zinc-700 hover:border-cyan-500/50'
            : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500'
        }`}
      >
        <ShieldCheck className="w-4 h-4" />
        {loadingPlan === 'subscription' ? 'Opening checkout…' : '$149/mo — Go Unlimited Pro'}
      </button>
    </div>
  );

  const handleCancelSubscription = async () => {
    // Defense-in-depth: re-validate the typed confirmation even if the
    // disabled button guard is bypassed.
    if (cancelTyping !== "CANCEL") {
      return;
    }
    setCancellingSub(true);
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to cancel subscription.");
        return;
      }
      setCancelSuccess(data.expiresAt);
      setCancelStep(0);
      setCancelReason("");
      setCancelTyping("");
      // Update local state — access continues until period end, but mark as cancelled
      setUserCredits(prev => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
    } catch {
      alert("Failed to connect to cancellation service.");
    } finally {
      setCancellingSub(false);
    }
  };

  const [saveSuccess, setSaveSuccess] = useState(false);
  const handleSaveToDossiers = async () => {
    if (!user || !result) return;
    try {
      const token = await user.getIdToken();
      // Normalize Firestore Timestamp createdAt (loaded from history) into an
      // ISO string so the saved copy is consistent with fresh reports, and the
      // save-dossier route stores a string (not a plain object) for createdAt.
      const payload = {
        ...result,
        createdAt: (result.createdAt as any)?.seconds
          ? new Date((result.createdAt as any).seconds * 1000).toISOString()
          : typeof result.createdAt === "string"
            ? result.createdAt
            : new Date().toISOString(),
      };
      const res = await fetch("/api/save-dossier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save dossier.");
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save dossier:", err);
      alert("Failed to save dossier.");
    }
  };

  const handleAnalyze = async (e?: React.FormEvent, isForce: boolean = false, overrides?: { target?: string; brandName?: string; competitorBrands?: string[] }) => {
    if (e) e.preventDefault();
    if (loadingAnalysis || isBatchProcessing) {
      return;
    }
    const effTarget = overrides?.target ?? target;
    const effBrandName = overrides?.brandName ?? brandName;
    const effCompetitors = overrides?.competitorBrands ?? competitorBrands;
    if (!effTarget || !effBrandName) {
      setAnalysisError(!effTarget ? "Please enter a Target Creator handle, video URL, or channel URL." : "Your Brand Name is required to run brand safety analyses.");
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
        target: effTarget,
        brand_name: effBrandName,
        competitor_brands: effCompetitors,
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
      // The "Audit complete!" banner is only meaningful for a live analysis;
      // cached/seeded previews are instant and would make the banner misleading.
      if (!data.is_cached) {
        setAuditComplete(true);
        setTimeout(() => setAuditComplete(false), 5000);
      }
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
    if (isBatchProcessing || loadingAnalysis) {
      return;
    }
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

      // Per-item audit: fetch /api/analyze and update the item's status
      // (processing -> completed/failed). All state writes are gated on
      // isMountedRef so a late-resolving fetch cannot setState after unmount.
      const runItem = async (i: number) => {
        if (!isMountedRef.current) return;
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
          if (!isMountedRef.current) return;

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
          if (!isMountedRef.current) return;
          setBatchItems(prev => prev.map((item, idx) => 
            idx === i 
              ? { ...item, status: 'failed', error: itemErr.message || 'Audit error', progressMessage: undefined }
              : item
          ));
        }
      };

      // Bounded concurrency of exactly 2: two workers pull items off the
      // queue, so at most two /api/analyze calls are in flight at once.
      const workerCount = Math.min(2, items.length);
      let nextIndex = 0;
      const worker = async () => {
        while (isMountedRef.current) {
          const i = nextIndex;
          if (i >= items.length) break;
          nextIndex = i + 1;
          await runItem(i);
        }
      };
      const workers: Promise<void>[] = [];
      for (let w = 0; w < workerCount; w++) {
        workers.push(worker());
      }
      await Promise.all(workers);
    } catch (err: any) {
      if (isMountedRef.current) {
        setAnalysisError(err.message || "Batch process encountered an error.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsBatchProcessing(false);
        setBatchCurrentIndex(-1);
      }
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
      const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return dateB - dateA;
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
          <div className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between gap-3 ${
            paymentVerified
              ? isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <span>
              {paymentVerified
                ? 'Payment verified! Your credits have been applied.'
                : 'Payment received. Credits will appear shortly — if not, contact support.'}
            </span>
            <button
              type="button"
              onClick={() => setPaymentVerified(null)}
              aria-label="Dismiss notification"
              className={`shrink-0 p-1 rounded-lg transition-colors ${
                isDark ? 'hover:bg-emerald-500/20' : 'hover:bg-emerald-100'
              }`}
            >
              <XCircle className="w-4 h-4" />
            </button>
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
                <div className="text-2xl sm:text-3xl font-black text-cyan-400">
                  Pro{userCredits.plan === 'subscription_annual' ? ' · Annual' : ''}
                </div>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-cyan-300/80' : 'text-cyan-900'}`}>
                  {userCredits.cancelAtPeriodEnd ? (
                    <>
                      Cancelled &middot; access until {userCredits.subscriptionExpiresAt ? new Date(userCredits.subscriptionExpiresAt).toLocaleDateString() : "period end"}
                    </>
                  ) : (
                    <>
                      Unlimited audits
                      {userCredits.subscriptionExpiresAt && (
                        <> &middot; renews {new Date(userCredits.subscriptionExpiresAt).toLocaleDateString()}</>
                      )}
                    </>
                  )}
                </p>
                {!userCredits.cancelAtPeriodEnd && (
                  <button
                    onClick={() => setCancelStep(1)}
                    className={`mt-3 text-[11px] font-semibold underline transition-colors ${
                      isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    Cancel subscription
                  </button>
                )}
              </>
            ) : cancelSuccess ? (
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-black text-cyan-400">Pro</div>
                <p className="mt-1 text-[11px] font-semibold text-amber-500">
                  Subscription cancelled. Access until {cancelSuccess && !isNaN(new Date(cancelSuccess).getTime()) ? new Date(cancelSuccess).toLocaleDateString() : "the end of your billing period"}.
                </p>
              </div>
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
                {/* P6 — top-up path when the account is empty */}
                {(userCredits.videoCredits === 0 && userCredits.channelCredits === 0) && (
                  <button
                    onClick={() => handleCheckout("single_3pack")}
                    disabled={loadingPlan !== null}
                    className={`mt-3 w-full px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                      isDark ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Top up — 3 reports for $19 (Save 21%)
                  </button>
                )}
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
                {/* P6 — soft limit: no hard wall, always a purchase path */}
                <h3 className="text-xl font-bold">You&apos;re out of credits — top up or upgrade</h3>
                <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  Top up for more reports or go unlimited with Pro to keep generating comprehensive brand safety dossiers.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <button 
                onClick={() => handleCheckout("single_3pack")}
                disabled={loadingPlan !== null}
                className={`p-4 rounded-lg text-left border transition flex flex-col justify-between space-y-3 ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                }`}
              >
                <div>
                  <h4 className="font-bold text-sm">3 Reports Pack</h4>
                  <p className="text-xs text-orange-500">$19 one-time &middot; Save 21%</p>
                </div>
                <span className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-cyan-400' : 'text-blue-900'}`}>
                  Buy 3 Reports <ChevronRight className="w-3 h-3" />
                </span>
              </button>

              <button 
                onClick={() => handleCheckout("single")}
                disabled={loadingPlan !== null}
                className={`p-4 rounded-lg text-left border transition flex flex-col justify-between space-y-3 ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                }`}
              >
                <div>
                  <h4 className="font-bold text-sm">Single Video Report</h4>
                  <p className="text-xs text-orange-500">$8 one-time</p>
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
                  <p className="text-xs text-orange-600">$19 one-time</p>
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
                  <p className={`text-xs ${isDark ? 'text-orange-300' : 'text-slate-300'}`}>$149 / month</p>
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

              <button
                type="button"
                onClick={() => setAuditMode('free')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
                  auditMode === 'free'
                    ? (isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' : 'bg-emerald-600 text-white shadow-sm')
                    : (isDark ? 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Free Score Preview</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white">
                  FREE
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
                        <span>Researching Creator & Running Brand Safety Checks...</span>
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
            </>) : auditMode === 'free' ? (
            /* N1T4 — Free Score Preview tab: shares the 1-per-account teaser
               cap with the homepage hero (server-enforced via freeAnalysisUsed).
               Output is the trimmed headline verdict; the full dossier requires
               a purchase (N1T5). */
            <div className="space-y-6">
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-sm font-bold">Free creator score preview</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  One free check per account (shared with the homepage). You get the brand safety score, risk level, and top red-flag headers — the full dossier requires a purchase.
                </p>
              </div>

              {teaserResult.status === 'loading' ? (
                <div className={`p-5 rounded-xl border ${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                    <p className={`text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      Running a full AI safety scan of this creator…
                    </p>
                  </div>
                </div>
              ) : teaserResult.status === 'done' && teaserResult.score !== undefined ? (
                <div className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Brand Safety Score</p>
                      <div className="flex items-end gap-3 mt-1">
                        <span className="text-5xl font-black leading-none">{teaserResult.score}</span>
                        <span className={`text-sm font-bold px-2 py-1 rounded-lg ${
                          teaserResult.score >= 80
                            ? (isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                            : teaserResult.score >= 60
                              ? (isDark ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200')
                              : (isDark ? 'bg-red-500/15 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200')
                        }`}>
                          {teaserResult.riskLevel}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                      isDark ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-blue-50 text-blue-900 border-blue-200'
                    }`}>
                      Free preview — full dossier requires a purchase
                    </span>
                  </div>

                  {teaserResult.flags && teaserResult.flags.length > 0 && (
                    <div className="mt-5">
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Top Red Flags</p>
                      <ul className="space-y-2">
                        {teaserResult.flags.map((f, i) => (
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

                  <div className="mt-6 pt-5 border-t border-slate-200 dark:border-zinc-800">
                    {renderTeaserUpsell()}
                  </div>
                </div>
              ) : teaserResult.status === 'used' ? (
                <div className={`p-6 rounded-xl border text-center ${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'}`}>
                  <p className="font-black text-lg">You&apos;ve already used your free check</p>
                  <p className={`text-sm mt-1 mb-5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Unlock the full dossier to see the complete safety breakdown.
                  </p>
                  {renderTeaserUpsell()}
                </div>
              ) : teaserResult.status === 'error' ? (
                <div className={`p-5 rounded-xl border ${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'}`}>
                  <p className="font-bold text-red-600 dark:text-red-400">{teaserResult.error}</p>
                </div>
              ) : userCredits?.freeTeaserUsed ? (
                <div className={`p-6 rounded-xl border text-center ${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'}`}>
                  <p className="font-black text-lg">You&apos;ve already used your free check</p>
                  <p className={`text-sm mt-1 mb-5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Unlock the full dossier to see the complete safety breakdown.
                  </p>
                  {renderTeaserUpsell()}
                </div>
              ) : (
                <form onSubmit={runTeaser} className="space-y-4">
                  <div>
                    <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                      <Zap className="w-4 h-4 text-emerald-500" />
                      Creator Handle, Channel, or Video/Post URL
                    </label>
                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={teaserInput}
                        onChange={(e) => setTeaserInput(e.target.value)}
                        placeholder="e.g. youtube.com/@creator or @handle"
                        className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 transition ${
                          isDark
                            ? 'bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 focus:ring-emerald-500/40'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-emerald-500/30'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={!teaserInput.trim()}
                        className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shrink-0 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 ${
                          isDark
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-950/50'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                        }`}
                      >
                        <Zap className="w-4 h-4" />
                        Run Free Check
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          ) : (
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
                    ? "You're out of credits — top up for more reports or upgrade to Pro for unlimited checks."
                    : `${userCredits.videoCredits} video + ${userCredits.channelCredits} channel credits remaining.`}
                </p>
                <TestModeBadge />
              </div>
            </div>

            {/* M3T3 — inline intro offer banner (non-blocking, no modal, no auto-pop).
                Renders only when the server says the intro is actually configured
                (introAvailable) — an unconfigured deploy must never promise $99. */}
            {!introBannerDismissed && userCredits.introAvailable && !userCredits.introClaimed && !userCredits.hasSubscription && (
              <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                isDark ? "bg-cyan-950/40 border-cyan-500/40" : "bg-cyan-50 border-cyan-300"
              }`}>
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <Sparkles className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${isDark ? "text-cyan-300" : "text-cyan-700"}`} />
                  <p className={`text-sm font-semibold ${isDark ? "text-cyan-100" : "text-cyan-900"}`}>
                    Get Pro for <span className="text-orange-500">$99</span> your first month
                    <span className={`block text-xs font-normal ${isDark ? "text-cyan-300/70" : "text-cyan-700/80"}`}>
                      One-time intro offer for new Pro subscribers &middot; $149/mo after your first month.
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCheckout("subscription")}
                    disabled={loadingPlan !== null}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                      isDark ? "bg-cyan-500 text-zinc-950 hover:bg-cyan-400" : "bg-cyan-600 text-white hover:bg-cyan-700"
                    }`}
                  >
                    {loadingPlan === "subscription" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Pro $99/mo"}
                  </button>
                  <button
                    onClick={dismissIntroBanner}
                    aria-label="Dismiss intro offer"
                    className={`p-1.5 rounded-lg transition-colors ${
                      isDark ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

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
                  <div className={`text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>$8</div>
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
                  <div className={`text-2xl font-black ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>$19</div>
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
                  <div className={`text-2xl font-black ${isDark ? 'text-orange-300' : 'text-white'}`}>$149<small className="text-sm font-medium">/mo</small></div>
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

        {/* Executive Dossier Results View + Saved Dossiers — lazy-loaded */}
        <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>}>
          <DossierViewer
            result={result}
            auditComplete={auditComplete}
            isDark={isDark}
            brandName={brandName}
            target={target}
            userCredits={userCredits}
            loadingAnalysis={loadingAnalysis}
            saveSuccess={saveSuccess}
            copySuccess={copySuccess}
            onReAudit={() => handleAnalyze(undefined, true, { target: result?.target, brandName: result?.brand_name || brandName })}
            onSaveToDossiers={() => handleSaveToDossiers()}
            onCopySummary={() => result && copyDossierSummary(result)}
            onDownloadJson={() => result && downloadJsonDossier(result)}
            getScoreBadgeColor={getScoreBadgeColor}
            getRiskBadgeColor={getRiskBadgeColor}
            getVerdictBadge={getVerdictBadge}
            history={history}
            filteredHistory={filteredHistory}
            loadingHistory={loadingHistory}
            historyError={historyError}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            sortBy={sortBy}
            onSortByChange={(v: any) => setSortBy(v)}
            filterStatus={filterStatus}
            onFilterStatusChange={(v: any) => setFilterStatus(v)}
            onSelectHistoryItem={(item) => {
              setResult(item);
              window.scrollTo({ top: 500, behavior: 'smooth' });
            }}
          />
        </Suspense>

        {/* Cancel Subscription — 3-Step Flow */}
        {cancelStep > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setCancelStep(0); setCancelTyping(""); }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-2xl ${
                isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* STEP 1: Reason */}
              {cancelStep === 1 && (
                <>
                  <div>
                    <h3 className="text-lg font-bold">Before you go...</h3>
                    <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      Help us understand why you&apos;re cancelling so we can improve.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {["Too expensive", "Not using it enough", "Missing features I need", "Found a better alternative", "Just testing / no longer needed"].map((reason) => (
                      <button
                        key={reason}
                        onClick={() => { setCancelReason(reason); setCancelStep(2); }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                          cancelReason === reason
                            ? isDark ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-blue-50 border-blue-300 text-blue-900'
                            : isDark ? 'bg-zinc-800 border-zinc-700 hover:border-zinc-500 text-zinc-300' : 'bg-slate-50 border-slate-200 hover:border-slate-400 text-slate-700'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCancelStep(0)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Never mind, keep subscription
                  </button>
                </>
              )}

              {/* STEP 2: Are you sure? */}
              {cancelStep === 2 && (
                <>
                  <div>
                    <h3 className="text-lg font-bold">You&apos;ll lose access to:</h3>
                  </div>
                  <div className={`space-y-3 text-sm ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-red-400 mt-0.5">✕</span>
                      <span>Unlimited creator brand safety audits</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-red-400 mt-0.5">✕</span>
                      <span>FTC & Legal Compliance deep dives</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-red-400 mt-0.5">✕</span>
                      <span>Competitor Exclusivity Matrix analysis</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-red-400 mt-0.5">✕</span>
                      <span>Batch multi-URL processing</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl text-xs ${isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-blue-50 text-blue-800'}`}>
                    <strong>Pro tip:</strong> You can resubscribe anytime and pick up right where you left off.
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCancelStep(0)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Keep Subscription
                    </button>
                    <button
                      onClick={() => setCancelStep(3)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors"
                    >
                      Continue cancelling
                    </button>
                  </div>
                </>
              )}

              {/* STEP 3: Type to confirm */}
              {cancelStep === 3 && (
                <>
                  <div>
                    <h3 className="text-lg font-bold">Final confirmation</h3>
                    <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      Type <span className="font-mono font-bold text-red-400">CANCEL</span> to confirm cancellation. This action cannot be undone.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={cancelTyping}
                    onChange={(e) => setCancelTyping(e.target.value)}
                    placeholder="Type CANCEL"
                    autoFocus
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-mono outline-none transition-colors ${
                      cancelTyping === "CANCEL"
                        ? 'border-red-500 bg-red-500/10'
                        : isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setCancelStep(0); setCancelTyping(""); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Go back
                    </button>
                    <button
                      onClick={() => { handleCancelSubscription(); setCancelTyping(""); }}
                      disabled={cancellingSub || cancelTyping !== "CANCEL"}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {cancellingSub ? "Cancelling..." : "Confirm cancellation"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* P4 — post-purchase Channel Report upsell popup. Shown only on the
            single/3-pack success landing, dismissible, and suppressed once the
            user already holds Channel Report credits. */}
        {showUpsell && userCredits !== null && (userCredits.channelCredits || 0) <= 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`relative w-full max-w-md rounded-2xl border p-8 shadow-2xl ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setShowUpsell(false)}
                aria-label="Close upsell offer"
                className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>

              {upsellState === "success" ? (
                <div className="text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Channel Report unlocked</h3>
                  <p className={`text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Your payment went through. The Channel Report credit will appear here in a moment.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowUpsell(false)}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : upsellState === "redirect" ? (
                <div className="text-center">
                  <Zap className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Almost there</h3>
                  <p className={`text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    We opened secure checkout in a new tab to finish your Channel Report purchase.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowUpsell(false)}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                  >
                    I&apos;ll complete it there
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-1">Get the full picture</h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    You vetted one video — now audit the whole channel: multi-video toxicity scan, deep comment sentiment audit and a shareable dossier PDF.
                  </p>
                  <div className={`flex items-baseline gap-1 mb-6 ${isDark ? 'text-zinc-300' : 'text-slate-800'}`}>
                    <span className="text-4xl font-extrabold">$19</span>
                    <span className={`text-sm font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>/ channel audit</span>
                  </div>
                  {upsellState === "error" && (
                    <div className={`mb-4 p-3 rounded-xl border text-sm font-medium ${isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                      {upsellError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleUpsell}
                    disabled={upsellState === "charging"}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      isDark
                        ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {upsellState === "charging" ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing payment…
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Unlock Channel Report — $19
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpsell(false)}
                    className={`mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    No thanks
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration mount-guard: SSR must render the pre-hydration state, so the flip to mounted belongs in the effect
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
