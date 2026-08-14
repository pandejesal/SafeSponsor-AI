// M5T3 — Instagram provider.
//
// LEGAL REVIEW REQUIRED before scrape-based IG ships: scraping Instagram pages
// against their ToS is a legal/compliance risk (same review milestone as the
// M4 takedown feature). This build therefore ships the SAFE DEFAULT:
//   - metadata-only via the public oEmbed endpoint + og: meta fallback
//   - web-search-backed backlash scan (grounded in the research pass, never a
//     direct scrape)
// The scrape tier exists but is HARD-GATED behind SAFESPONSOR_ENABLE_IG_SCRAPE
// (default false) and must not be enabled until the legal review is signed off.
// Decision recorded in the M5 task output; see README "Data Lifecycle" notes.
import {
  PlatformProvider,
  PlatformVideo,
  ProviderDeps,
  ProviderResult,
} from "./types";

const InstagramRegex = /(?:instagram\.com\/(?:p|reel|reels|tv|stories)\/|instagram\.com\/@?[A-Za-z0-9._]{1,30})/i;

export function extractInstagramHandle(url: string): string {
  const match = url.match(/instagram\.com\/(?:@)?([A-Za-z0-9._]{1,30})(?:[\/?#]|$)/i);
  return match && match[1].toLowerCase() !== "p" && match[1].toLowerCase() !== "reel"
    ? match[1]
    : "";
}

async function safeJson(fetchFn: typeof fetch, url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal, headers: { "User-Agent": "SafeSponsorAI/1.0" } });
    if (res.status === 429) throw Object.assign(new Error("rate limited"), { status: 429 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Public oEmbed endpoint (no token needed for public posts/profiles). */
async function fetchMetadataOEmbed(target: string, fetchFn: typeof fetch): Promise<ProviderResult> {
  try {
    const data = await safeJson(fetchFn, `https://api.instagram.com/oembed?url=${encodeURIComponent(target)}`);
    const handle = extractInstagramHandle(data.author_url || target) || data.author_name?.toLowerCase().replace(/\s+/g, "_") || "unknown";
    return {
      ok: true,
      degraded: false,
      note: "Instagram oEmbed metadata tier.",
      evidence: {
        profile: {
          displayName: data.author_name || handle,
          handle,
          bio: data.title || "",
          url: data.author_url || target,
          thumbnailUrl: data.thumbnail_url,
          stats: {},
        },
        sources: data.author_url ? [{ title: `Instagram profile: ${data.author_name || handle}`, url: data.author_url }] : [],
      },
    };
  } catch (err: any) {
    return { ok: false, degraded: err?.status === 429, note: `Instagram oEmbed failed: ${err?.message || err}` };
  }
}

/** Gated scrape tier — see module header (legal review required). */
async function fetchProfileScrape(target: string, fetchFn: typeof fetch): Promise<ProviderResult> {
  if (process.env.SAFESPONSOR_ENABLE_IG_SCRAPE !== "true") {
    return { ok: false, degraded: false, note: "Scrape tier disabled pending legal review (SAFESPONSOR_ENABLE_IG_SCRAPE not set)." };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetchFn(target, { signal: controller.signal, headers: { "User-Agent": "SafeSponsorAI/1.0" } });
    clearTimeout(timer);
    if (res.status === 429) throw Object.assign(new Error("rate limited"), { status: 429 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const ogTitle = html.match(/<meta property="og:title" content="([^"]{1,300})"/i)?.[1] || "";
    const ogDesc = html.match(/<meta property="og:description" content="([^"]{1,1000})"/i)?.[1] || "";
    const handle = extractInstagramHandle(target) || "unknown";
    return {
      ok: true,
      degraded: false,
      note: "Instagram metadata tier (og: meta extraction).",
      evidence: {
        profile: { displayName: ogTitle || handle, handle, bio: ogDesc, url: target, stats: {} },
        sources: [{ title: `Instagram profile: ${handle}`, url: target }],
      },
    };
  } catch (err: any) {
    return { ok: false, degraded: err?.status === 429, note: `Instagram scrape tier failed: ${err?.message || err}` };
  }
}

export const instagramProvider: PlatformProvider = {
  name: "instagram",
  matches(target: string): boolean {
    return InstagramRegex.test(target);
  },

  async fetchProfile(target, deps = {}): Promise<ProviderResult> {
    const fetchFn = deps.fetchFn || fetch;
    const t1 = await fetchMetadataOEmbed(target, fetchFn);
    if (t1.ok) return t1;
    // Rotation into the gated scrape tier — off until legal review signs off.
    const t2 = await fetchProfileScrape(target, fetchFn);
    if (t2.ok) return t2;
    return { ok: false, degraded: t1.degraded || t2.degraded, note: `All Instagram tiers failed (oEmbed: ${t1.note}; scrape: ${t2.note})` };
  },

  async fetchComments(): Promise<ProviderResult> {
    // Backlash scan is web-search-grounded in the research pass, never scraped.
    return { ok: false, degraded: true, note: "Instagram comments require the gated scrape tier; backlash scan runs via web-search grounding in the research pass." };
  },

  async fetchVideos(target, deps = {}): Promise<ProviderResult> {
    const fetchFn = deps.fetchFn || fetch;
    const postMatch = target.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    if (postMatch) {
      const t1 = await fetchMetadataOEmbed(target, fetchFn);
      if (t1.ok && t1.evidence?.profile) {
        const videos: PlatformVideo[] = [{
          id: postMatch[1],
          title: t1.evidence.profile.bio || "",
          url: target,
        }];
        return { ok: true, degraded: false, note: "Post/reel metadata via oEmbed.", evidence: { videos } };
      }
    }
    return { ok: false, degraded: true, note: "Instagram video list unavailable on the metadata tier." };
  },
};
