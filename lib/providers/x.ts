// M5T4 — X (Twitter) provider.
// No direct scraping: X's APIs are paid-only. Evidence is metadata-only via
// publish.twitter.com oEmbed, and the backlash scan is explicitly
// web-search-grounded (runs in the research pass when grounded sources exist).
import {
  PlatformProvider,
  ProviderDeps,
  ProviderResult,
} from "./types";

const XRegex = /(?:x\.com|twitter\.com)\/(?:@)?([A-Za-z0-9_]{1,15})(?:[\/?#]|$)/i;

export function extractXHandle(url: string): string {
  const match = url.match(XRegex);
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

export const xProvider: PlatformProvider = {
  name: "x",
  matches(target: string): boolean {
    return XRegex.test(target);
  },

  async fetchProfile(target, deps = {}): Promise<ProviderResult> {
    const fetchFn = deps.fetchFn || fetch;
    const handle = extractXHandle(target);
    try {
      const data = await safeJson(fetchFn, `https://publish.twitter.com/oembed?url=${encodeURIComponent(target)}`);
      const authorUrl = data.author_url || `https://x.com/${handle}`;
      return {
        ok: true,
        degraded: false,
        note: "X oEmbed metadata tier (no direct scraping).",
        evidence: {
          profile: {
            displayName: data.author_name || handle,
            handle,
            bio: data.title || "",
            url: authorUrl,
            thumbnailUrl: data.thumbnail_url,
            stats: {},
          },
          sources: [{ title: `X profile: ${data.author_name || handle}`, url: authorUrl }],
          // The backlash scan is web-search-grounded in the research pass —
          // see note; never performed via direct scraping.
          comments: { sample: [], totalSampled: 0 },
        },
      };
    } catch (err: any) {
      return {
        ok: false,
        degraded: err?.status === 429,
        note: `X oEmbed failed: ${err?.message || err}. Backlash scan remains web-search-grounded only.`,
      };
    }
  },

  async fetchComments(): Promise<ProviderResult> {
    return {
      ok: false,
      degraded: true,
      note: "X post/comment sampling requires paid API or scraping — not used. Backlash scan is web-search-grounded in the research pass.",
    };
  },

  async fetchVideos(): Promise<ProviderResult> {
    return { ok: false, degraded: true, note: "X is text-first; no video evidence tier (embedded media covered by metadata)." };
  },
};
