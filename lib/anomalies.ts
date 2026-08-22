// Audience-quality anomaly detection (Phase 2 of COMPETITIVE_ABSORPTION_STRATEGY.md).
// Deterministic, dependency-free signals computed from public YouTube stats —
// our take on HypeAuditor-style AQS anomaly codes. Each code is falsifiable
// from raw numbers alone (no ML yet): cheap, explainable, and safe to show
// alongside AI analysis. Designed to be extended as more sources come online
// (subscriber history, comment quality, follower overlap).

export type AnomalySeverity = "info" | "warning" | "critical";

export interface AnomalySignal {
  code: string;
  severity: AnomalySeverity;
  message: string;
}

export interface VideoStatsInput {
  viewCount: number;
  likeCount?: number | null;
  isShort?: boolean;
}

export interface AudienceMetricsInput {
  subscriberCount: number | null;
  videos: VideoStatsInput[];
}

export function computeAudienceAnomalies(m: AudienceMetricsInput): AnomalySignal[] {
  const signals: AnomalySignal[] = [];
  const vids = m.videos.filter((v) => Number.isFinite(v.viewCount));
  if (vids.length === 0) return signals;

  const views = vids.map((v) => v.viewCount);
  const median = medianOf(views);
  const mean = views.reduce((a, b) => a + b, 0) / views.length;

  // Engagement ratio over videos that report likes.
  const withLikes = vids.filter((v) => typeof v.likeCount === "number" && v.likeCount >= 0 && v.viewCount > 0);
  if (withLikes.length >= 2) {
    const ratios = withLikes.map((v) => v.likeCount! / v.viewCount);
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    if (avgRatio > 0.08) {
      signals.push({
        code: "ENGAGEMENT_RATIO_HIGH",
        severity: "critical",
        message: `Like-to-view ratio averages ${(avgRatio * 100).toFixed(1)}% (organic norm is 2-5%). Consistently extreme engagement is a common sign of engagement pods or purchased interactions.`,
      });
    } else if (avgRatio < 0.005 && mean > 1000) {
      signals.push({
        code: "ENGAGEMENT_RATIO_LOW",
        severity: "warning",
        message: `Like-to-view ratio averages ${(avgRatio * 100).toFixed(2)}% — unusually flat even for passive audiences. Views may be inflated relative to real interest.`,
      });
    }
  }

  // Views vs subscribers reach consistency.
  if (m.subscriberCount && m.subscriberCount >= 10_000 && median > 0) {
    const reach = median / m.subscriberCount;
    if (reach < 0.005) {
      signals.push({
        code: "VIEW_SUBSCRIBER_MISMATCH",
        severity: "warning",
        message: `Median recent views are only ${(reach * 100).toFixed(2)}% of ${m.subscriberCount.toLocaleString()} subscribers. A large share of the audience may be dormant or stale.`,
      });
    }
  }

  // Viral outlier: one video carrying the channel.
  if (vids.length >= 4 && median > 0) {
    const max = Math.max(...views);
    if (max / median >= 8) {
      signals.push({
        code: "VIRAL_OUTLIER",
        severity: "info",
        message: `Top recent video has ${(max / median).toFixed(0)}x the median views (${max.toLocaleString()} vs ${Math.round(median).toLocaleString()}). Average performance may overstate typical reach.`,
      });
    }
  }

  // Shorts-heavy mix can inflate view totals.
  if (m.videos.some((v) => v.isShort)) {
    const shortShare = vids.filter((v) => v.isShort).length / vids.length;
    if (shortShare > 0.5) {
      signals.push({
        code: "SHORTS_VIEW_INFLATION",
        severity: "info",
        message: `${Math.round(shortShare * 100)}% of recent uploads are Shorts. Short-form views typically convert to sponsorships at a lower rate than long-form.`,
      });
    }
  }

  if (vids.length < 3) {
    signals.push({ code: "LOW_SAMPLE", severity: "info", message: `Only ${vids.length} recent video(s) available — treat these signals as provisional.` });
  }

  return signals;
}

function medianOf(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
