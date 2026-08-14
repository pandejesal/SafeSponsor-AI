// M5T4 — Twitch provider via the official Helix API (app-access token flow).
// Requires TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET; without them the provider
// degrades to limited evidence so an unconfigured env never crashes the audit.
import {
  PlatformProfile,
  PlatformProvider,
  PlatformVideo,
  ProviderDeps,
  ProviderResult,
} from "./types";

const TwitchRegex = /twitch\.tv\/([A-Za-z0-9_]{2,25})/i;

export function extractTwitchLogin(url: string): string {
  const match = url.match(TwitchRegex);
  return match ? match[1].toLowerCase() : "";
}

interface TwitchTokenCache {
  token: string;
  expiresAtMs: number;
}

let tokenCache: TwitchTokenCache | null = null;

/** App-access token (client_credentials). Tokens live ~60 days; we cache them. */
async function getAppToken(fetchFn: typeof fetch): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAtMs) {
    return tokenCache.token;
  }
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET not configured");
  }
  const res = await fetchFn("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (res.status === 429) throw Object.assign(new Error("rate limited"), { status: 429 });
  if (!res.ok) throw new Error(`Token HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAtMs: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

async function helixGet(fetchFn: typeof fetch, path: string): Promise<any> {
  const token = await getAppToken(fetchFn);
  const res = await fetchFn(`https://api.twitch.tv/helix${path}`, {
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID as string,
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 429) throw Object.assign(new Error("rate limited"), { status: 429 });
  if (!res.ok) throw new Error(`Helix HTTP ${res.status}`);
  return res.json();
}

async function fetchUser(target: string, fetchFn: typeof fetch): Promise<{ profile: PlatformProfile }> {
  const login = extractTwitchLogin(target);
  if (!login) throw new Error("not a Twitch URL");
  const data = await helixGet(fetchFn, `/users?login=${encodeURIComponent(login)}`);
  const user = data?.data?.[0];
  if (!user) throw new Error("Twitch user not found");
  return {
    profile: {
      displayName: user.display_name || login,
      handle: login,
      bio: user.description || "",
      url: `https://www.twitch.tv/${login}`,
      stats: { view_count: user.view_count ?? "unknown", created_at: user.created_at || "" },
      thumbnailUrl: user.profile_image_url,
    },
  };
}

export const twitchProvider: PlatformProvider = {
  name: "twitch",
  matches(target: string): boolean {
    return TwitchRegex.test(target);
  },

  async fetchProfile(target, deps = {}): Promise<ProviderResult> {
    const fetchFn = deps.fetchFn || fetch;
    try {
      const { profile } = await fetchUser(target, fetchFn);
      return {
        ok: true,
        degraded: false,
        note: "Twitch Helix API (official).",
        evidence: {
          profile,
          sources: [{ title: `Twitch profile: ${profile.handle}`, url: profile.url }],
        },
      };
    } catch (err: any) {
      const unconfigured = /not configured/.test(err?.message || "");
      return {
        ok: false,
        degraded: !unconfigured,
        note: unconfigured
          ? "Twitch provider unconfigured (TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET) — metadata unavailable."
          : `Twitch profile failed: ${err?.message || err}`,
      };
    }
  },

  async fetchComments(): Promise<ProviderResult> {
    return { ok: false, degraded: true, note: "Twitch chat sample unavailable (no public chat-log API; live chat is ephemeral)." };
  },

  async fetchVideos(target, deps = {}): Promise<ProviderResult> {
    const fetchFn = deps.fetchFn || fetch;
    try {
      const users = await helixGet(fetchFn, `/users?login=${encodeURIComponent(extractTwitchLogin(target))}`);
      const userId = users?.data?.[0]?.id;
      if (!userId) throw new Error("Twitch user not found for video listing");
      const vids = await helixGet(fetchFn, `/videos?user_id=${userId}&first=5`);
      const videos: PlatformVideo[] = (vids?.data || []).map((v: any) => ({
        id: v.id,
        title: v.title || "",
        url: v.url || `https://www.twitch.tv/videos/${v.id}`,
        stats: { view_count: v.view_count ?? "unknown", published_at: v.published_at || "" },
      }));
      if (videos.length === 0) {
        return { ok: false, degraded: true, note: "No recent Twitch VODs found." };
      }
      return {
        ok: true,
        degraded: false,
        note: "Recent Twitch VOD metadata (official Helix API).",
        evidence: { videos },
      };
    } catch (err: any) {
      return { ok: false, degraded: true, note: `Twitch videos failed: ${err?.message || err}` };
    }
  },
};
