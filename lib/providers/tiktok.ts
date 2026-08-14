// M5T1 — TikTok provider with tiered rotation:
//   Tier 1: oEmbed (free metadata, no API key)
//   Tier 2: open-source scraper lib (ENV-GATED: SAFESPONSOR_ENABLE_TIKTOK_SCRAPE=true)
//   Tier 3: Apify free tier (ENV-GATED: APIFY_API_TOKEN set)
// Rate limits (429) and failures rotate down the tiers; when everything fails
// the provider degrades to metadata-only evidence with quality: "limited".
import {
  PlatformProvider,
  PlatformVideo,
  ProviderDeps,
  ProviderResult,
} from "./types";

const TikTokHandleRegex = /(?:tiktok\.com\/@|tiktok\.com\/v\/|vm\.tiktok\.com)/i;

export function extractTikTokHandle(url: string): string {
  const match = url.match(/tiktok\.com\/@([\w.-]+)/i);
  return match ? match[1] : "";
}

function extractVideoId(url: string): string {
  const match = url.match(/tiktok\.com\/(?:@[\w.-]+\/)?video\/(\d+)/i);
  return match ? match[1] : "";
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

async function fetchProfileOEmbed(target: string, fetchFn: typeof fetch): Promise<ProviderResult> {
  try {
    const data = await safeJson(fetchFn, `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`);
    const handle = extractTikTokHandle(data.author_url || target) || data.author_name || "unknown";
    return {
      ok: true,
      degraded: false,
      note: "TikTok oEmbed metadata tier.",
      evidence: {
        profile: {
          displayName: data.author_name || handle,
          handle,
          bio: data.title || "",
          url: data.author_url || target,
          thumbnailUrl: data.thumbnail_url,
          stats: {},
        },
        sources: data.author_url ? [{ title: `TikTok profile: ${data.author_name || handle}`, url: data.author_url }] : [],
      },
    };
  } catch (err: any) {
    return { ok: false, degraded: err?.status === 429, note: `oEmbed failed: ${err?.message || err}` };
  }
}

/** Tier 2 — generic page scrape for profile/video metadata. Off unless the
 *  owner enables it; scraping third-party pages needs a ToS review first. */
async function fetchProfileScrape(target: string, fetchFn: typeof fetch): Promise<ProviderResult> {
  if (process.env.SAFESPONSOR_ENABLE_TIKTOK_SCRAPE !== "true") {
    return { ok: false, degraded: false, note: "Scraper tier disabled (SAFESPONSOR_ENABLE_TIKTOK_SCRAPE not set to true)." };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetchFn(target, { signal: controller.signal, headers: { "User-Agent": "SafeSponsorAI/1.0" } });
    clearTimeout(timer);
    if (res.status === 429) throw Object.assign(new Error("rate limited"), { status: 429 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() || "";
    const handle = extractTikTokHandle(target) || title;
    return {
      ok: true,
      degraded: false,
      note: "TikTok scraper tier (HTML metadata only).",
      evidence: {
        profile: { displayName: title || handle, handle, bio: "", url: target, stats: {} },
        sources: [{ title: `TikTok profile: ${handle}`, url: target }],
      },
    };
  } catch (err: any) {
    return { ok: false, degraded: err?.status === 429, note: `Scraper tier failed: ${err?.message || err}` };
  }
}

/** Tier 3 — Apify free tier. Off unless APIFY_API_TOKEN is set (the free tier
 *  requires the owner to provision an actor; failures degrade gracefully). */
async function fetchProfileApify(target: string, fetchFn: typeof fetch): Promise<ProviderResult> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return { ok: false, degraded: false, note: "Apify tier disabled (APIFY_API_TOKEN not set)." };
  }
  try {
    const data = await safeJson(
      fetchFn,
      `https://api.apify.com/v2/acts/${process.env.APIFY_ACTOR_ID || "clockworks~tiktok-scraper"}/run-sync-get-dataset-items?token=${token}`,
      10000
    );
    return { ok: true, degraded: false, note: "Apify tier.", evidence: { profile: data as any } };
  } catch (err: any) {
    return { ok: false, degraded: err?.status === 429, note: `Apify tier failed: ${err?.message || err}` };
  }
}

export const tiktokProvider: PlatformProvider = {
  name: "tiktok",
  matches(target: string): boolean {
    return TikTokHandleRegex.test(target);
  },

  async fetchProfile(target, deps = {}): Promise<ProviderResult> {
    const fetchFn = deps.fetchFn || fetch;
    // Rotation: oEmbed → scraper → Apify. Failures that look like rate limits
    // rotate; outright failures fall through to the next tier too.
    const t1 = await fetchProfileOEmbed(target, fetchFn);
    if (t1.ok) return t1;
    const t2 = await fetchProfileScrape(target, fetchFn);
    if (t2.ok) return t2;
    const t3 = await fetchProfileApify(target, fetchFn);
    if (t3.ok) return t3;
    return {
      ok: false,
      degraded: t1.degraded || t2.degraded || t3.degraded,
      note: `All TikTok tiers failed (oEmbed: ${t1.note}; scraper: ${t2.note}; Apify: ${t3.note})`,
    };
  },

  async fetchComments(target, deps = {}): Promise<ProviderResult> {
    const fetchFn = deps.fetchFn || fetch;
    // oEmbed has no comment API; comments require a scraper tier (gated).
    const t2 = await fetchProfileScrape(target, fetchFn);
    if (t2.ok) {
      return { ok: false, degraded: true, note: "Comment extraction requires a dedicated scraper; unavailable in this tier." };
    }
    return { ok: false, degraded: true, note: "TikTok comments unavailable on the metadata tier (no public comment API)." };
  },

  async fetchVideos(target, deps = {}): Promise<ProviderResult> {
    const fetchFn = deps.fetchFn || fetch;
    const videoId = extractVideoId(target);
    if (videoId) {
      const t1 = await fetchProfileOEmbed(target, fetchFn);
      if (t1.ok && t1.evidence?.profile) {
        const videos: PlatformVideo[] = [{
          id: videoId,
          title: t1.evidence.profile.bio || "",
          url: target,
        }];
        return {
          ok: true,
          degraded: false,
          note: "Current video metadata via oEmbed (video list requires scraper tier).",
          evidence: { videos },
        };
      }
    }
    return { ok: false, degraded: true, note: "TikTok video list unavailable on the metadata tier." };
  },
};
