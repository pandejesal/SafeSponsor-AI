import { readFileSync } from "fs";
import { join } from "path";
import { buildTeaserReport } from "../lib/teaser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  FAIL ${name}: ${err?.message || err}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Full dossier shaped like the synthesis output (mirrors seeded_audits shape).
const FULL_DOSSIER: Record<string, unknown> = {
  creator_summary: "Full creator background would go here.",
  brand_safety_score: 62,
  risk_level: "High",
  audience_insights: { authenticity_rating: "x", toxic_recurring_themes: ["a"] },
  controversy_and_pr_history: { past_issues_summary: "x" },
  competitor_and_sponsorship_history: [{ competitor_or_brand: "X" }],
  nuanced_red_flags: [
    { category: "Crypto Controversy", description: "Past NFT project allegations.", context_and_impact: "PR risk.", video_timestamp: "N/A", source_url: "u", verification_status: "verified" },
    { category: "Fintech Compliance", description: "Promoted exchange before insolvency.", context_and_impact: "Compliance.", video_timestamp: "N/A", source_url: "u", verification_status: "verified" },
    { category: "Toxic Community", description: "Comment toxicity spikes.", context_and_impact: "x.", video_timestamp: "N/A", source_url: "u", verification_status: "verified" },
    { category: "Fourth Flag", description: "Should never appear (cap is 3).", context_and_impact: "x.", video_timestamp: "N/A", source_url: "u", verification_status: "verified" },
  ],
  positive_highlights: ["x"],
  final_verdict: { recommendation: "Proceed with Caution", justification: "x" },
  grounding_sources: [{ title: "t", url: "u" }],
};

console.log("N1 — Score Teaser unit tests");

// ---- N1T1: teaser output shape ----
test("buildTeaserReport returns only score/risk_level/top flags", () => {
  const teaser = buildTeaserReport(FULL_DOSSIER);
  assert(teaser.teaser === true, "teaser marker must be true");
  assert(teaser.brand_safety_score === 62, "score must pass through");
  assert(teaser.risk_level === "High", "risk_level must pass through");
  const keys = Object.keys(teaser).sort().join(",");
  assert(keys === "brand_safety_score,risk_level,teaser,top_red_flags", `unexpected keys: ${keys}`);
  assert("creator_summary" in teaser === false, "creator_summary must be stripped");
  assert("audience_insights" in teaser === false, "audience_insights must be stripped");
  assert("final_verdict" in teaser === false, "final_verdict must be stripped");
  assert("grounding_sources" in teaser === false, "grounding_sources must be stripped");
});

test("buildTeaserReport caps red flags at 3 and keeps only header fields", () => {
  const teaser = buildTeaserReport(FULL_DOSSIER);
  assert(teaser.top_red_flags.length === 3, `expected 3 flags, got ${teaser.top_red_flags.length}`);
  assert(teaser.top_red_flags[0].category === "Crypto Controversy", "flags keep original order");
  for (const f of teaser.top_red_flags) {
    const keys = Object.keys(f).sort().join(",");
    assert(keys === "category,description", `flag leaked fields: ${keys}`);
  }
});

test("buildTeaserReport handles missing/empty flags and garbage input", () => {
  const noFlags = buildTeaserReport({ brand_safety_score: 90, risk_level: "Low", nuanced_red_flags: [] });
  assert(noFlags.top_red_flags.length === 0, "empty flags array must yield no flags");
  const junkFlags = buildTeaserReport({ brand_safety_score: 50, risk_level: "Medium", nuanced_red_flags: [null, "nope", {}, { category: "", description: "" }] });
  assert(junkFlags.top_red_flags.length === 0, "junk flag entries must be filtered");
  const missing = buildTeaserReport({});
  assert(missing.brand_safety_score === 50, "missing score defaults to 50");
  assert(missing.risk_level === "Unknown", "missing risk_level defaults to Unknown");
  const nullInput = buildTeaserReport(null);
  assert(nullInput.brand_safety_score === 50 && nullInput.top_red_flags.length === 0, "null input must not throw");
});

test("buildTeaserReport clamps score to 0-100", () => {
  assert(buildTeaserReport({ brand_safety_score: 999, risk_level: "Low" }).brand_safety_score === 100, "999 clamps to 100");
  assert(buildTeaserReport({ brand_safety_score: -5, risk_level: "Low" }).brand_safety_score === 0, "-5 clamps to 0");
  assert(buildTeaserReport({ brand_safety_score: 62.4, risk_level: "High" }).brand_safety_score === 62, "62.4 rounds to 62");
});

// ---- N1T1/N1T2: route structure proofs (mirror test_m1 source-grep style) ----
const routeSrc = readFileSync(join(__dirname, "..", "app", "api", "analyze", "route.ts"), "utf8");

test("teaser flag is accepted by the schema and parsed", () => {
  assert(routeSrc.includes("teaser: z.boolean().optional()"), "schema must accept teaser flag");
  assert(routeSrc.includes("const teaser = inputData.teaser === true;"), "route must parse the teaser flag");
});

test("teaser run returns BEFORE the cache read path and the quota transaction", () => {
  const teaserIdx = routeSrc.indexOf("if (teaser) {");
  const cacheIdx = routeSrc.indexOf("GLOBAL DATABASE CACHE CHECK");
  const quotaIdx = routeSrc.indexOf("Check User Quota / Entitlements ATOMICALLY");
  assert(teaserIdx !== -1 && cacheIdx !== -1 && quotaIdx !== -1, "required anchors must exist");
  assert(teaserIdx < cacheIdx, "teaser branch must precede the cache read path");
  assert(teaserIdx < quotaIdx, "teaser branch must precede the entitlement-claim transaction");
});

test("teaser result is trimmed and discarded: no history/global_audits write in the branch", () => {
  assert(routeSrc.includes("buildTeaserReport(teaserOutcome.reportData)"), "teaser must return the trimmed report");
  const teaserIdx = routeSrc.indexOf("if (teaser) {");
  const historySaveIdx = routeSrc.indexOf("Save Report to User History");
  assert(historySaveIdx !== -1, "history save section must exist");
  assert(teaserIdx < historySaveIdx, "teaser branch returns before the history write section");
  assert(!routeSrc.slice(teaserIdx, routeSrc.indexOf("GLOBAL DATABASE CACHE CHECK")).includes('collection("global_audits")'), "teaser branch must never write to global_audits");
});

test("teaser tombstone check denies tombstoned creators", () => {
  const teaserBlock = routeSrc.slice(routeSrc.indexOf("if (teaser) {"), routeSrc.indexOf("GLOBAL DATABASE CACHE CHECK"));
  assert(teaserBlock.includes("isTombstoned(targetKey)"), "teaser branch must check tombstones");
  assert(teaserBlock.includes('"This creator cannot be analyzed."'), "tombstoned creators must be denied with a message");
});

test("tombstone check runs BEFORE the cap transaction (denial does not burn the cap)", () => {
  const teaserBlock = routeSrc.slice(routeSrc.indexOf("if (teaser) {"), routeSrc.indexOf("GLOBAL DATABASE CACHE CHECK"));
  const tombIdx = teaserBlock.indexOf("isTombstoned(targetKey)");
  const capIdx = teaserBlock.indexOf("freeAnalysisUsed: true");
  assert(tombIdx !== -1 && capIdx !== -1, "required anchors must exist");
  assert(tombIdx < capIdx, "tombstone denial must precede the cap write");
});

test("failed teaser runs roll the cap back (one free check is not burned)", () => {
  const teaserBlock = routeSrc.slice(routeSrc.indexOf("if (teaser) {"), routeSrc.indexOf("GLOBAL DATABASE CACHE CHECK"));
  const failIdx = teaserBlock.indexOf("if (!teaserOutcome.ok) {");
  const rollbackIdx = teaserBlock.indexOf("Cap rollback failed");
  const researchFailIdx = teaserBlock.indexOf('teaserOutcome.reason === "research_failed"');
  assert(failIdx !== -1 && rollbackIdx !== -1 && researchFailIdx !== -1, "anchors must exist");
  assert(failIdx < rollbackIdx && rollbackIdx < researchFailIdx, "rollback must run inside the failure branch, before the error return");
  assert(teaserBlock.includes("FieldValue.delete()"), "rollback must delete the cap fields");
});

test("teaser still logs usage and fires per-audit cost alerts", () => {
  const teaserBlock = routeSrc.slice(routeSrc.indexOf("if (teaser) {"), routeSrc.indexOf("GLOBAL DATABASE CACHE CHECK"));
  assert(teaserBlock.includes("onUsage: reportAuditUsage"), "teaser pipeline must log LLM usage");
  assert(teaserBlock.includes("runAnalyzePipeline"), "teaser must run the real pipeline (fresh run)");
  const alertCount = (teaserBlock.match(/emitPerAuditCostAlert/g) || []).length;
  assert(alertCount >= 2, `teaser must emit cost alerts on failure AND success (found ${alertCount})`);
});

// ---- N1T2: 1-per-account cap + paid-only cache gating ----
test("freeAnalysisUsed is the teaser cap ONLY: no free full-dossier grant remains", () => {
  const trueRefs = (routeSrc.match(/freeAnalysisUsed: true/g) || []).length;
  assert(trueRefs === 1, `freeAnalysisUsed:true must appear exactly once (teaser cap), found ${trueRefs}`);
  assert(!routeSrc.includes('type: "free" as const'), "quota transaction must no longer grant free full audits");
  assert(!routeSrc.includes('consumedEntitlement === "free"'), "refund helper must no longer handle the free grant");
  assert(routeSrc.includes('"Free teaser already used"'), "teaser cap denial message must exist");
  assert(routeSrc.includes("teaserUsedAt"), "teaser cap must stamp when it was used");
});

test("seed/global_audits cache is served ONLY to paid users", () => {
  assert(routeSrc.includes("!force_refresh && targetKey && isPaidUser"), "cache read must require a paid entitlement");
  assert(!routeSrc.includes("!force_refresh && targetKey && !isPaidUser"), "free users must not reach the cache read");
  assert(routeSrc.includes("getSeededAudit"), "seed path still exists for paid users");
});

// ---- check-credits surface ----
const checkCreditsSrc = readFileSync(join(__dirname, "..", "app", "api", "check-credits", "route.ts"), "utf8");
test("check-credits exposes freeTeaserUsed without leaking anything else", () => {
  assert(checkCreditsSrc.includes("freeTeaserUsed: data.freeAnalysisUsed === true"), "existing-user branch must expose the cap");
  assert(checkCreditsSrc.includes("freeTeaserUsed: false"), "fresh-user branch must expose false");
});

console.log(`\nN1 results: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);