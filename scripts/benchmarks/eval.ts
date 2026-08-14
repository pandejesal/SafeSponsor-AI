// M2 Benchmark eval (M2T2/T4): runs the analyze pipeline core against the
// 100-creator ground-truth CSV, fully offline (LLM_MOCK_MODE + mock fetcher —
// zero network calls). Compares the predicted risk_level against the human
// label, computes precision/recall/F1 (positive = risky), writes
// scripts/benchmarks/last-run.json, and prints a previous-vs-current delta.
//
// Interpretation note: the mock LLM is a deterministic stand-in for model
// behavior — it applies the rubric the real synthesis prompt instructs
// (score deductions per flag severity, band mapping). The gate therefore
// guards pipeline mechanics (parsing, validation, repair, clamping, band
// mapping, competitor fill-in, data-quality flags) plus rubric-vs-label
// agreement, and it fails when precision or recall drops below 0.90.
//
// Exit code 1 = gate failed (precision < 0.90 OR recall < 0.90).

import * as fs from "fs";
import * as path from "path";

// Enforce offline mode: the benchmark must make ZERO network calls. This flag
// also disables M5 platform-evidence collection inside the pipeline.
process.env.LLM_MOCK_MODE = "true";

import {
  createMockLlmProvider,
  createMockVideoFetcher,
  isChannelTarget,
  normalizeTargetKey,
  runAnalyzePipeline,
} from "../../lib/analyze-pipeline";
import { BenchEntry, buildBenchmarkCorpus, CsvRow, parseCsv } from "./corpus";

const DIR = __dirname;
const CSV_PATH = path.join(DIR, "creators.csv");
const RESULTS_PATH = path.join(DIR, "last-run.json");

interface RowResult {
  handle: string;
  platform: string;
  expected: boolean;
  predicted: boolean;
  riskLevel: string;
  score: number;
  correct: boolean;
  dataQuality: string;
  note: string;
}

interface Metrics {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  rows: RowResult[];
}

function computeMetrics(results: RowResult[]): Metrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of results) {
    if (r.expected && r.predicted) tp++;
    else if (!r.expected && r.predicted) fp++;
    else if (r.expected && !r.predicted) fn++;
    else tn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = results.length > 0 ? (tp + tn) / results.length : 0;
  return { tp, fp, fn, tn, precision, recall, f1, accuracy, rows: results };
}

async function main(): Promise<void> {
  const csvText = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csvText);
  console.log(`[BENCHMARK] Loaded ${rows.length} creators from creators.csv`);
  if (rows.length !== 100) {
    console.error(`[BENCHMARK] Expected 100 rows, got ${rows.length} — aborting`);
    process.exit(1);
  }

  const riskyCount = rows.filter((r) => r.label === "risky").length;
  const okCount = rows.length - riskyCount;
  console.log(`[BENCHMARK] Labels: ${riskyCount} risky / ${okCount} ok`);

  const corpus = buildBenchmarkCorpus(rows);

  const results: RowResult[] = [];
  const failures: string[] = [];

  for (const row of rows) {
    const entry: BenchEntry = corpus[row.handle];
    if (!entry) {
      failures.push(`${row.handle}: no corpus entry`);
      continue;
    }

    const outcome = await runAnalyzePipeline({
      target: row.url,
      brandName: "Benchmark Brand",
      auditFocus: "standard",
      competitorBrands: [],
      additionalUrls: [],
      aliases: [],
      targetKey: normalizeTargetKey(row.url),
      isChannelAudit: isChannelTarget(row.url),
      deadlineMs: performance.now() + 60000,
      checkBudget: async () => {},
      llm: createMockLlmProvider(entry.script),
      video: createMockVideoFetcher(corpus),
    });

    if (!outcome.ok) {
      failures.push(`${row.handle}: pipeline outcome ${outcome.reason}`);
      continue;
    }

    const report = outcome.reportData as any;
    const expected = row.label === "risky";
    const predicted = report.risk_level === "High" || report.risk_level === "Critical";
    results.push({
      handle: row.handle,
      platform: row.platform,
      expected,
      predicted,
      riskLevel: String(report.risk_level),
      score: Number(report.brand_safety_score),
      correct: expected === predicted,
      dataQuality: String(report.data_quality),
      note: row.notes,
    });
  }

  if (failures.length > 0) {
    console.error("[BENCHMARK] Pipeline failures:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  const metrics = computeMetrics(results);

  // M2T4: scorecard delta vs the previously committed baseline.
  let previous: Metrics | null = null;
  if (fs.existsSync(RESULTS_PATH)) {
    try {
      previous = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) as Metrics;
    } catch {
      previous = null;
    }
  }

  console.log("");
  console.log("=== SCORECARD ===");
  console.log(`TP=${metrics.tp} FP=${metrics.fp} FN=${metrics.fn} TN=${metrics.tn}`);
  console.log(`precision=${(metrics.precision * 100).toFixed(2)}% recall=${(metrics.recall * 100).toFixed(2)}% F1=${(metrics.f1 * 100).toFixed(2)}% accuracy=${(metrics.accuracy * 100).toFixed(2)}%`);

  const incorrect = results.filter((r) => !r.correct);
  if (incorrect.length > 0) {
    console.log("");
    console.log("=== MISCLASSIFIED (expected vs predicted) ===");
    for (const r of incorrect) {
      console.log(`  ${r.handle} (${r.platform}): expected=${r.expected ? "risky" : "ok"} predicted=${r.predicted ? "risky" : "ok"} (${r.riskLevel}, score ${r.score})`);
    }
  }

  const limited = results.filter((r) => r.dataQuality === "limited");
  console.log(`\ndata_quality: ${limited.length}/${results.length} rows limited`);

  if (previous) {
    console.log("");
    console.log("=== DELTA vs PREVIOUS RUN ===");
    console.log(`precision: ${(previous.precision * 100).toFixed(2)}% -> ${(metrics.precision * 100).toFixed(2)}%`);
    console.log(`recall:    ${(previous.recall * 100).toFixed(2)}% -> ${(metrics.recall * 100).toFixed(2)}%`);
    console.log(`F1:        ${(previous.f1 * 100).toFixed(2)}% -> ${(metrics.f1 * 100).toFixed(2)}%`);
    const prevPred = new Map(previous.rows.map((r) => [r.handle, r.predicted]));
    const flips = metrics.rows
      .filter((r) => prevPred.has(r.handle) && prevPred.get(r.handle) !== r.predicted)
      .map((r) => `${r.handle}: ${prevPred.get(r.handle) ? "risky" : "ok"} -> ${r.predicted ? "risky" : "ok"}`);
    if (flips.length > 0) {
      console.log("risk flips:");
      for (const f of flips) console.log(`  ${f}`);
    } else {
      console.log("no risk flips");
    }
  } else {
    console.log("\nno previous baseline (first run)");
  }

  fs.writeFileSync(RESULTS_PATH, JSON.stringify({ runAt: new Date().toISOString(), ...metrics }, null, 2));
  console.log(`\n[BENCHMARK] wrote ${RESULTS_PATH}`);

  const pass = metrics.precision >= 0.90 && metrics.recall >= 0.90;
  console.log(pass
    ? "[BENCHMARK] PASS (precision >= 0.90 AND recall >= 0.90)"
    : "[BENCHMARK] FAIL (precision < 0.90 OR recall < 0.90)");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("[BENCHMARK] unexpected error:", err);
  process.exit(1);
});
