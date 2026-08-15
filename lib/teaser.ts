export interface TeaserFlag {
  category: string;
  description: string;
}

export interface TeaserReport {
  teaser: true;
  brand_safety_score: number;
  risk_level: string;
  top_red_flags: TeaserFlag[];
}

// N1T1 — the teaser shows ONLY the headline verdict: score, risk level, and
// the 2-3 most serious red-flag headers. Every other dossier field (audience
// insights, sponsorship history, verdict details, grounding sources, ...) is
// deliberately stripped so the free check never leaks the full analysis the
// $8 Single Report sells. The result is discarded server-side anyway — this
// shape is the ONLY thing a teaser run ever returns to the client.
export function buildTeaserReport(reportData: unknown): TeaserReport {
  const data = (reportData && typeof reportData === "object" ? reportData : {}) as Record<string, unknown>;

  const rawScore = Number(data.brand_safety_score);
  const score = Number.isFinite(rawScore) ? Math.min(100, Math.max(0, Math.round(rawScore))) : 50;

  const riskLevel = String(data.risk_level || "Unknown");

  const flags = Array.isArray(data.nuanced_red_flags) ? data.nuanced_red_flags : [];
  const top_red_flags: TeaserFlag[] = flags
    .filter(
      (f: any) =>
        f && typeof f === "object" &&
        (String(f.category || "").trim() !== "" || String(f.description || "").trim() !== "")
    )
    .slice(0, 3)
    .map((f: any) => ({
      category: String(f.category || "").trim().slice(0, 200),
      description: String(f.description || "").trim().slice(0, 500),
    }));

  return { teaser: true, brand_safety_score: score, risk_level: riskLevel, top_red_flags };
}