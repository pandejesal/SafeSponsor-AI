// M5 — Provider registry, platform detection, evidence collection, and the
// code-side YouTube depth helpers (sponsor-pattern scan, comment counter).
// collectPlatformEvidence NEVER throws: a provider failure degrades to
// limited evidence or a null result, never a crashed audit.
import {
  PlatformEvidence,
  PlatformProvider,
  ProviderDeps,
  ProviderResult,
} from "./types";
import { tiktokProvider } from "./tiktok";
import { instagramProvider } from "./instagram";
import { twitchProvider } from "./twitch";
import { xProvider } from "./x";

export * from "./types";

export const ALL_PROVIDERS: PlatformProvider[] = [
  tiktokProvider,
  instagramProvider,
  twitchProvider,
  xProvider,
];

export function detectProviderForTarget(target: string): PlatformProvider | null {
  if (!target || typeof target !== "string") return null;
  for (const provider of ALL_PROVIDERS) {
    if (provider.matches(target)) return provider;
  }
  return null;
}

export interface CollectedPlatformEvidence {
  providerName: string;
  evidence: PlatformEvidence | null;
  degraded: boolean;
  note: string;
}

async function runWithTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Collect structured evidence for a platform target. Runs the provider's three
 * fetches concurrently (each bounded), merges the results into one evidence
 * object, and degrades gracefully:
 *   quality "full"   → profile + (videos or comments) available
 *   quality "limited" → metadata-only or partial (note explains why)
 * Returns null only when the provider itself has no matching target.
 */
export async function collectPlatformEvidence(
  target: string,
  opts: { deadlineMs: number; deps?: ProviderDeps }
): Promise<CollectedPlatformEvidence | null> {
  const provider = detectProviderForTarget(target);
  if (!provider) return null;

  const deps = opts.deps || {};

  const [profileRes, commentsRes, videosRes] = await Promise.all([
    runWithTimeout(provider.fetchProfile(target, deps), 12000, `${provider.name} profile`).catch((err: any): ProviderResult => ({
      ok: false, degraded: true, note: err?.message || "profile fetch failed",
    })),
    runWithTimeout(provider.fetchComments(target, deps), 12000, `${provider.name} comments`).catch((err: any): ProviderResult => ({
      ok: false, degraded: true, note: err?.message || "comments fetch failed",
    })),
    runWithTimeout(provider.fetchVideos(target, deps), 12000, `${provider.name} videos`).catch((err: any): ProviderResult => ({
      ok: false, degraded: true, note: err?.message || "videos fetch failed",
    })),
  ]);

  const sources = new Map<string, { title: string; url: string }>();
  const pushSources = (maybeSources?: { title: string; url: string }[]) => {
    for (const src of maybeSources || []) {
      if (src && src.url && !sources.has(src.url)) sources.set(src.url, src);
    }
  };
  pushSources(profileRes.evidence?.sources);
  pushSources(commentsRes.evidence?.sources);
  pushSources(videosRes.evidence?.sources);

  const profile = profileRes.ok ? profileRes.evidence?.profile ?? null : null;
  const videos = videosRes.ok ? videosRes.evidence?.videos ?? null : null;
  const comments = commentsRes.ok ? commentsRes.evidence?.comments ?? null : null;

  const degraded = profileRes.degraded || commentsRes.degraded || videosRes.degraded;
  const hasProfile = !!profile;
  const hasSubstance = (videos && videos.length > 0) || (comments && comments.totalSampled > 0);
  const quality: "full" | "limited" = hasProfile && hasSubstance ? "full" : "limited";

  const notes: string[] = [];
  if (profileRes.ok && profileRes.note) notes.push(profileRes.note);
  if (quality === "limited") {
    if (!hasProfile) notes.push(profileRes.note || "profile metadata unavailable");
    else if (!hasSubstance) notes.push("metadata only (no video/comment substance available on this tier).");
  }

  const evidence: PlatformEvidence = {
    provider: provider.name,
    target,
    profile,
    videos,
    comments,
    sources: Array.from(sources.values()),
    quality,
    note: notes.join(" ").slice(0, 1000),
    fetchedAt: new Date(deps.nowMs ?? Date.now()).toISOString(),
  };

  return {
    providerName: provider.name,
    evidence,
    degraded,
    note: evidence.note,
  };
}

// ---- M5T5: code-side YouTube depth helpers (pure, unit-testable) ----

const SPONSOR_MARKERS = [
  "sponsored by",
  "this video is sponsored",
  "sponsor this video",
  "brought to you by",
  "our sponsor",
  "use code",
  "check out our sponsor",
  "in partnership with",
  "affiliate link",
  "ad read",
];

/** Scan transcript text for sponsorship markers; returns which patterns
 *  appeared and how many total hits (case-insensitive). Code-derived signal
 *  for the dossier — the LLM still does the semantic interpretation. */
export function detectSponsorPatterns(transcriptText: string): {
  patterns: string[];
  matchCount: number;
} {
  if (!transcriptText || typeof transcriptText !== "string") {
    return { patterns: [], matchCount: 0 };
  }
  const haystack = transcriptText.toLowerCase();
  let matchCount = 0;
  const patterns: string[] = [];
  for (const marker of SPONSOR_MARKERS) {
    const count = haystack.split(marker).length - 1;
    if (count > 0) {
      patterns.push(marker);
      matchCount += count;
    }
  }
  return { patterns, matchCount };
}

/** Count the sampled-comment bullets in the assembled comments text (the
 *  pipeline formats them as "N. <comment>"). */
export function countCommentSamples(commentsText: string): number {
  if (!commentsText) return 0;
  const matches = commentsText.match(/^\s*\d+\.\s/gm);
  return matches ? matches.length : 0;
}
