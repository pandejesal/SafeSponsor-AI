// M5 — Cross-platform evidence providers (TikTok / Instagram / Twitch / X).
// Every provider follows the same contract: fetchProfile / fetchComments /
// fetchVideos return ProviderResult and NEVER throw — failures surface as
// ok:false + degraded + note so the pipeline can degrade gracefully.

export interface PlatformProfile {
  displayName: string;
  handle: string;
  bio: string;
  url: string;
  stats: Record<string, number | string>;
  thumbnailUrl?: string;
}

export interface PlatformVideo {
  id: string;
  title: string;
  url: string;
  stats?: Record<string, number | string>;
}

export interface PlatformComments {
  sample: string[];
  totalSampled: number;
}

export interface PlatformEvidence {
  provider: string;
  target: string;
  profile: PlatformProfile | null;
  videos: PlatformVideo[] | null;
  comments: PlatformComments | null;
  sources: { title: string; url: string }[];
  quality: "full" | "limited";
  note: string;
  fetchedAt: string;
}

export interface ProviderResult {
  ok: boolean;
  evidence?: Partial<PlatformEvidence>;
  /** True when the provider hit rate limits / failures and rotated tiers or
   *  degraded instead of producing full data. */
  degraded: boolean;
  note: string;
}

export interface ProviderDeps {
  /** Injected for unit tests (rotation, rate-limit simulation); defaults to
   *  the global fetch. */
  fetchFn?: typeof fetch;
  nowMs?: number;
}

export interface PlatformProvider {
  name: string;
  /** True when `target` looks like this platform (URL patterns). */
  matches(target: string): boolean;
  fetchProfile(target: string, deps?: ProviderDeps): Promise<ProviderResult>;
  fetchComments(target: string, deps?: ProviderDeps): Promise<ProviderResult>;
  fetchVideos(target: string, deps?: ProviderDeps): Promise<ProviderResult>;
}
