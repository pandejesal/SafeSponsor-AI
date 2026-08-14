// M5 gate: unit tests for cross-platform evidence providers + YouTube depth
// helpers (run: npm run test:m5). No network, no real env secrets — fetch is
// injected as a mock (same pattern as scripts/test_m1.ts / test_m4.ts).
import assert from "node:assert/strict";
import {
  collectPlatformEvidence,
  countCommentSamples,
  detectProviderForTarget,
  detectSponsorPatterns,
} from "../lib/providers";
import { tiktokProvider } from "../lib/providers/tiktok";
import { instagramProvider } from "../lib/providers/instagram";
import { twitchProvider } from "../lib/providers/twitch";
import { xProvider } from "../lib/providers/x";

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (err: any) {
    failures.push(`${name}: ${err?.message || err}`);
    console.error(`  FAIL ${name}: ${err?.message || err}`);
  }
}

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

console.log("M5 — Research Depth (provider rotation + evidence) unit tests");

// ---- M5T1/T3/T4: platform detection ----

test("detectProviderForTarget maps URLs to providers", () => {
  assert.strictEqual(detectProviderForTarget("https://www.tiktok.com/@mrbeast")?.name, "tiktok");
  assert.strictEqual(detectProviderForTarget("https://vm.tiktok.com/abc123")?.name, "tiktok");
  assert.strictEqual(detectProviderForTarget("https://www.instagram.com/mrbeast/")?.name, "instagram");
  assert.strictEqual(detectProviderForTarget("https://www.instagram.com/reel/CxYzAb/")?.name, "instagram");
  assert.strictEqual(detectProviderForTarget("https://www.twitch.tv/mrbeast")?.name, "twitch");
  assert.strictEqual(detectProviderForTarget("https://x.com/mrbeast")?.name, "x");
  assert.strictEqual(detectProviderForTarget("https://twitter.com/mrbeast")?.name, "x");
  assert.strictEqual(detectProviderForTarget("https://www.youtube.com/@mrbeast"), null);
  assert.strictEqual(detectProviderForTarget("@mrbeast"), null);
  assert.strictEqual(detectProviderForTarget(""), null);
});

// ---- M5T1: TikTok tiered rotation ----

test("tiktok: oEmbed success yields a full profile, not degraded", async () => {
  const fetchFn = async (url: RequestInfo | URL): Promise<Response> => {
    if (String(url).includes("/oembed")) {
      return jsonResponse({ author_name: "MrBeast", author_url: "https://www.tiktok.com/@mrbeast", title: "Hi", thumbnail_url: "https://x/t.jpg" });
    }
    return jsonResponse({}, 404);
  };
  const r = await tiktokProvider.fetchProfile("https://www.tiktok.com/@mrbeast", { fetchFn });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.degraded, false);
  assert.strictEqual(r.evidence?.profile?.handle, "mrbeast");
  assert.ok(r.evidence?.sources?.length === 1);
});

test("tiktok: 429 rotates tiers and degrades to limited when gated tiers are off", async () => {
  const fetchFn = async (): Promise<Response> => jsonResponse({}, 429);
  const savedScrape = process.env.SAFESPONSOR_ENABLE_TIKTOK_SCRAPE;
  const savedApify = process.env.APIFY_API_TOKEN;
  delete process.env.SAFESPONSOR_ENABLE_TIKTOK_SCRAPE;
  delete process.env.APIFY_API_TOKEN;
  try {
    const r = await tiktokProvider.fetchProfile("https://www.tiktok.com/@mrbeast", { fetchFn });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.degraded, true);
    assert.ok(r.note.includes("All TikTok tiers failed"), r.note);
    assert.ok(r.note.includes("rate limited"), r.note);
  } finally {
    if (savedScrape !== undefined) process.env.SAFESPONSOR_ENABLE_TIKTOK_SCRAPE = savedScrape;
    if (savedApify !== undefined) process.env.APIFY_API_TOKEN = savedApify;
  }
});

test("tiktok: comments unavailable on metadata tier (graceful)", async () => {
  const r = await tiktokProvider.fetchComments("https://www.tiktok.com/@mrbeast", { fetchFn: async () => jsonResponse({}) });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.degraded, true);
});

// ---- M5T3: Instagram (metadata-only default; scrape gated) ----

test("instagram: oEmbed success yields profile evidence", async () => {
  const fetchFn = async (url: RequestInfo | URL): Promise<Response> => {
    if (String(url).includes("api.instagram.com/oembed")) {
      return jsonResponse({ author_name: "MrBeast", author_url: "https://www.instagram.com/mrbeast/", title: "Reel" });
    }
    return jsonResponse({}, 404);
  };
  const r = await instagramProvider.fetchProfile("https://www.instagram.com/mrbeast/", { fetchFn });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.evidence?.profile?.handle, "mrbeast");
});

test("instagram: scrape tier is hard-gated (legal review) and rotation degrades", async () => {
  const saved = process.env.SAFESPONSOR_ENABLE_IG_SCRAPE;
  delete process.env.SAFESPONSOR_ENABLE_IG_SCRAPE;
  try {
    const fetchFn = async (): Promise<Response> => jsonResponse({}, 429);
    const r = await instagramProvider.fetchProfile("https://www.instagram.com/mrbeast/", { fetchFn });
    assert.strictEqual(r.ok, false);
    assert.ok(r.note.includes("legal review"), r.note);
  } finally {
    if (saved !== undefined) process.env.SAFESPONSOR_ENABLE_IG_SCRAPE = saved;
  }
});

// ---- M5T4: Twitch official API (env-gated) + X (oEmbed only) ----

test("twitch: unconfigured env degrades without crashing", async () => {
  const savedId = process.env.TWITCH_CLIENT_ID;
  const savedSecret = process.env.TWITCH_CLIENT_SECRET;
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;
  try {
    const r = await twitchProvider.fetchProfile("https://www.twitch.tv/mrbeast", { fetchFn: async () => jsonResponse({}) });
    assert.strictEqual(r.ok, false);
    assert.ok(r.note.includes("unconfigured"), r.note);
  } finally {
    if (savedId !== undefined) process.env.TWITCH_CLIENT_ID = savedId;
    if (savedSecret !== undefined) process.env.TWITCH_CLIENT_SECRET = savedSecret;
  }
});

test("twitch: chat sample is honestly unavailable", async () => {
  const r = await twitchProvider.fetchComments("https://www.twitch.tv/mrbeast", { fetchFn: async () => jsonResponse({}) });
  assert.strictEqual(r.ok, false);
});

test("x: oEmbed metadata only; comments tier is web-search-grounded note", async () => {
  const fetchFn = async (url: RequestInfo | URL): Promise<Response> => {
    if (String(url).includes("publish.twitter.com/oembed")) {
      return jsonResponse({ author_name: "MrBeast", author_url: "https://x.com/MrBeast", title: "tweet" });
    }
    return jsonResponse({}, 404);
  };
  const r = await xProvider.fetchProfile("https://x.com/MrBeast", { fetchFn });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.evidence?.profile?.handle, "MrBeast");
  const c = await xProvider.fetchComments("https://x.com/MrBeast", { fetchFn });
  assert.strictEqual(c.ok, false);
  assert.ok(c.note.includes("web-search-grounded"), c.note);
});

// ---- M5T2: collectPlatformEvidence merge + quality tiers ----

test("collect: profile-only evidence is quality limited with an explanatory note", async () => {
  const fetchFn = async (url: RequestInfo | URL): Promise<Response> => {
    if (String(url).includes("/oembed")) {
      return jsonResponse({ author_name: "Tester", author_url: "https://www.tiktok.com/@tester", title: "bio" });
    }
    return jsonResponse({}, 404);
  };
  const collected = await collectPlatformEvidence("https://www.tiktok.com/@tester", { deadlineMs: Date.now() + 60000, deps: { fetchFn } });
  assert.ok(collected, "expected evidence collection to run");
  assert.strictEqual(collected.providerName, "tiktok");
  assert.strictEqual(collected.evidence?.quality, "limited");
  assert.ok(collected.evidence?.profile, "profile should exist");
  assert.strictEqual(collected.evidence?.videos, null);
  assert.ok((collected.evidence?.note || "").length > 0, "note should explain degradation");
});

test("collect: profile + video evidence is quality full", async () => {
  const fetchFn = async (url: RequestInfo | URL): Promise<Response> => {
    if (String(url).includes("/oembed")) {
      return jsonResponse({ author_name: "Tester", author_url: "https://www.tiktok.com/@tester", title: "video title" });
    }
    return jsonResponse({}, 404);
  };
  const collected = await collectPlatformEvidence("https://www.tiktok.com/@tester/video/1234567890123456789", {
    deadlineMs: Date.now() + 60000,
    deps: { fetchFn },
  });
  assert.strictEqual(collected?.evidence?.quality, "full");
  assert.strictEqual(collected?.evidence?.videos?.length, 1);
});

test("collect: unknown platform returns null without touching network", async () => {
  const collected = await collectPlatformEvidence("https://www.youtube.com/@mrbeast", {
    deadlineMs: Date.now() + 60000,
    deps: { fetchFn: async () => { throw new Error("network should not be touched"); } },
  });
  assert.strictEqual(collected, null);
});

// ---- M5T5: YouTube depth helpers ----

test("detectSponsorPatterns finds markers and counts hits", () => {
  const r = detectSponsorPatterns(
    "This video is brought to you by NordVPN. Also use code SAFE10 at checkout. Sponsored by Honey."
  );
  assert.deepStrictEqual(r.patterns.sort(), ["brought to you by", "sponsored by", "use code"].sort());
  assert.strictEqual(r.matchCount, 3);
});

test("detectSponsorPatterns: no markers = empty result", () => {
  const r = detectSponsorPatterns("Just me and my camera. No ads here.");
  assert.deepStrictEqual(r, { patterns: [], matchCount: 0 });
  assert.deepStrictEqual(detectSponsorPatterns(""), { patterns: [], matchCount: 0 });
});

test("countCommentSamples counts formatted comment bullets", () => {
  const text = "\n[YouTube Comments Sample for https://y (3 top/recent comments)]:\n1. first\n2. second\n3. third\n";
  assert.strictEqual(countCommentSamples(text), 3);
  assert.strictEqual(countCommentSamples(""), 0);
  assert.strictEqual(countCommentSamples("no bullets here\nplain text"), 0);
});

console.log(`\nM5 results: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("Failures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
