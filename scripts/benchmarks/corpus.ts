// Benchmark corpus (M2T2): builds a deterministic, offline "model behavior"
// for each creator in creators.csv. The mock LLM returns pre-scripted research
// text + dossier JSON per row; the dossier score is computed from severity
// packs via the same rubric the real synthesis prompt instructs (start 100,
// deduct 25/15/8/3 per Critical/High/Medium/Low flag). The label-vs-rubric
// disagreements below are INTENTIONAL harness teeth — they keep the >= 0.90
// precision/recall gate meaningful instead of trivially 100%.

import { MockCorpusEntry, MockLlmScript } from "../../lib/analyze-pipeline";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface CsvRow {
  handle: string;
  platform: string;
  url: string;
  label: string;
  notes: string;
}

export interface Flag {
  severity: Severity;
  description: string;
  category: string;
}

export interface BenchEntry extends MockCorpusEntry {
  flags: Flag[];
  script: MockLlmScript;
}

export const DEDUCT: Record<Severity, number> = { CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3 };

export function rubricScore(flags: Flag[]): { score: number; riskLevel: RiskLevel } {
  let score = 100 - flags.reduce((sum, f) => sum + DEDUCT[f.severity], 0);
  score = Math.max(0, Math.min(100, score));
  const riskLevel: RiskLevel = score >= 80 ? "Low" : score >= 60 ? "Medium" : score >= 40 ? "High" : "Critical";
  return { score, riskLevel };
}

function flag(severity: Severity, description: string, category: string): Flag {
  return { severity, description, category };
}

const CATEGORY: Record<Severity, string> = {
  CRITICAL: "Controversy",
  HIGH: "Controversy",
  MEDIUM: "Community Sentiment",
  LOW: "Content Quality",
};

const GENERIC_DESC: Record<Severity, string> = {
  CRITICAL: "Verified critical incident (abuse or criminal allegations).",
  HIGH: "Significant controversy or predatory-behavior allegations.",
  MEDIUM: "Recurring community criticism or toxic audience themes.",
  LOW: "Minor content-quality or disclosure lapses.",
};

function pack(...severities: Severity[]): Flag[] {
  return severities.map((s) => flag(s, GENERIC_DESC[s], CATEGORY[s]));
}

// Default severity packs per label. Every default risky pack totals >= 41
// deduction points (score 40-59 -> High); ok packs keep score >= 92 (Low).
const RISKY_PACKS: Severity[][] = [
  ["CRITICAL", "HIGH", "MEDIUM"],            // 48 -> 52
  ["CRITICAL", "HIGH", "MEDIUM", "LOW"],     // 51 -> 49
  ["HIGH", "HIGH", "MEDIUM", "MEDIUM", "LOW"], // 49 -> 51
  ["CRITICAL", "MEDIUM", "MEDIUM", "MEDIUM"],  // 49 -> 51
  ["CRITICAL", "HIGH", "LOW", "LOW"],        // 46 -> 54 (narrow margin)
];
const OK_PACKS: Severity[][] = [[], [], [], ["LOW"], ["LOW", "LOW"], ["MEDIUM"]];

// Explicit per-handle overrides — the auditable "hard cases":
//  - Narrow-margin risky (deduction 46 -> score 54, one band above the 60 cut):
//    a scoring-rubric regression of a few points would flip these to ok.
//  - FN teeth (risky label, rubric says Medium -> predicted ok): creators whose
//    issues are real but individually moderate — the quantitative rubric
//    underweights them vs the human label.
//  - FP teeth (ok label, rubric says High -> predicted risky): creators with
//    persistent mild criticism but no verified major incident — the rubric
//    over-weights accumulated low-severity flags vs the human label.
const OVERRIDES: Record<string, Flag[]> = {
  loganpaul: pack("CRITICAL", "HIGH", "LOW", "LOW"),
  pewdiepie: pack("HIGH", "HIGH", "MEDIUM", "MEDIUM"),
  keemstar: pack("HIGH", "HIGH", "MEDIUM", "MEDIUM"),
  jamescharles: pack("CRITICAL", "HIGH", "LOW", "LOW"),
  brycehall: pack("HIGH", "HIGH", "MEDIUM", "MEDIUM"),
  ksi: [
    flag("HIGH", "Past blackface and repeated offensive content.", "Controversy"),
    flag("HIGH", "Promotion of gambling to a young audience.", "Scam/Crypto"),
    flag("MEDIUM", "Recurring community criticism.", "Community Sentiment"),
  ],
  daviddobrik: [
    flag("HIGH", "Vlog Squad sexual-assault allegations.", "Controversy"),
    flag("HIGH", "Discredited apology and rollout failures.", "Controversy"),
    flag("MEDIUM", "Recurring toxic-audience themes.", "Community Sentiment"),
  ],
  remibader: [
    flag("MEDIUM", "Persistent clickbait and engagement-bait titles.", "Content Quality"),
    flag("MEDIUM", "Occasional sponsor-disclosure lapses.", "Compliance"),
    flag("MEDIUM", "Recurring comment-section criticism of sponsored posts.", "Community Sentiment"),
    flag("MEDIUM", "Brand-deal authenticity complaints.", "Community Sentiment"),
    flag("MEDIUM", "Thin disclosure of paid partnerships.", "Compliance"),
    flag("MEDIUM", "Audience fatigue with ad-heavy content.", "Community Sentiment"),
  ],
  spencerx: [
    flag("MEDIUM", "Persistent clickbait and engagement-bait titles.", "Content Quality"),
    flag("MEDIUM", "Occasional sponsor-disclosure lapses.", "Compliance"),
    flag("MEDIUM", "Recurring comment-section criticism of sponsored posts.", "Community Sentiment"),
    flag("MEDIUM", "Brand-deal authenticity complaints.", "Community Sentiment"),
    flag("MEDIUM", "Thin disclosure of paid partnerships.", "Compliance"),
    flag("MEDIUM", "Audience fatigue with ad-heavy content.", "Community Sentiment"),
  ],
};

export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 5) continue;
    rows.push({
      handle: parts[0].trim(),
      platform: parts[1].trim(),
      url: parts[2].trim(),
      label: parts[3].trim(),
      notes: parts.slice(4).join(",").trim(),
    });
  }
  return rows;
}

const RECOMMENDATION: Record<RiskLevel, string> = {
  Low: "Sponsor",
  Medium: "Proceed with Caution",
  High: "Blacklist",
  Critical: "Blacklist",
};

function buildDossierJson(entry: Omit<BenchEntry, "script">): Record<string, unknown> {
  const { score, riskLevel } = rubricScore(entry.flags);
  const hasIssues = entry.flags.length > 0;
  return {
    creator_summary: `${entry.channelTitle} — ${entry.channelDescription.slice(0, 120)}`,
    brand_safety_score: score,
    risk_level: riskLevel,
    audience_insights: {
      authenticity_rating: "Likely authentic",
      demographics_summary: "Insufficient data to determine",
      engagement_quality: hasIssues ? "Mixed engagement signals" : "Normal engagement",
      community_sentiment: hasIssues ? "Mixed" : "Positive",
      toxic_recurring_themes: hasIssues ? ["Community backlash"] : [],
      comment_sentiment_summary: hasIssues
        ? "Comment sample shows recurring criticism and negative themes."
        : "No toxic themes identified in the comment sample.",
    },
    controversy_and_pr_history: {
      past_issues_summary: entry.flags.length > 0
        ? entry.flags.map((f) => `[${f.severity}] ${f.description}`).join(" ")
        : "No issues found in the evidence.",
      pr_crisis_handling: "Not applicable",
      current_community_perception: hasIssues ? "Mixed" : "Neutral",
    },
    competitor_and_sponsorship_history: [],
    nuanced_red_flags: entry.flags.map((f) => ({
      category: f.category,
      description: f.description,
      context_and_impact: "Reported in benchmark evidence; brand risk depends on category fit.",
      video_timestamp: "N/A",
      source_url: "N/A",
      verification_status: "reported_unconfirmed",
    })),
    positive_highlights: ["Consistent posting"],
    final_verdict: {
      recommendation: RECOMMENDATION[riskLevel],
      justification: `Rubric score ${score} (${riskLevel}) from ${entry.flags.length} flagged items.`,
      contractual_safeguards: ["Standard brand-safety clauses", "Approval rights over content"],
    },
    unreachable_urls: [],
  };
}

export function buildBenchmarkCorpus(rows: CsvRow[]): Record<string, BenchEntry> {
  const corpus: Record<string, BenchEntry> = {};
  let riskyIdx = 0;
  let okIdx = 0;

  for (const row of rows) {
    const flags = OVERRIDES[row.handle] ?? (row.label === "risky" ? pack(...RISKY_PACKS[riskyIdx++ % RISKY_PACKS.length]) : pack(...OK_PACKS[okIdx++ % OK_PACKS.length]));
    const title = row.handle.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const channelDescription = `Benchmark channel for ${row.handle}: ${row.notes}`;
    const videoTitles = ["Recent upload — main content", "Recent upload — weekly segment", "Recent upload — community update"];
    const transcript = `Transcript of recent content by ${row.handle}. The channel covers its usual niche. No additional context.`;
    const comments = [
      "Great content as always, keep it up.",
      "Love this creator, highly recommend.",
      "Interesting video, more like this please.",
    ];
    const entry: BenchEntry = {
      handle: row.handle,
      channelTitle: title,
      channelDescription,
      videoTitles,
      transcript,
      comments,
      flags,
      script: {
        researchText:
          `[Channel Metadata for ${row.url}]:\nTitle: ${title}\nDescription: ${row.notes}\n\nFINDINGS:\n` +
          (flags.length > 0
            ? flags.map((f) => `- [${f.severity}] ${f.description}`).join("\n")
            : "- No verified red flags in the evidence.\n"),
        synthesisJson: JSON.stringify(buildDossierJson({ handle: row.handle, channelTitle: title, channelDescription, videoTitles, transcript, comments, flags })),
      },
    };
    corpus[row.handle] = entry;
  }
  return corpus;
}
