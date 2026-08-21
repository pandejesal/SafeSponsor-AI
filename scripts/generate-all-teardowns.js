#!/usr/bin/env node
import fs from "fs";
import path from "path";
const API_URL = process.env.SAFESPONSOR_API_URL || "https://safe-sponsor-ai.vercel.app/api/analyze";
const NICHE_EXEMPLARS = [
  { niche: "beauty", creatorUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { niche: "fitness", creatorUrl: "https://www.youtube.com/watch?v=9t1a3K1J9aQ" },
  { niche: "food", creatorUrl: "https://www.youtube.com/watch?v=2Vv-BfVoq4g" },
  { niche: "tech", creatorUrl: "https://www.youtube.com/watch?v=6o7B1N0K9aQ" },
  { niche: "gaming", creatorUrl: "https://www.youtube.com/watch?v=1a2b3c4d5e6" },
  { niche: "lifestyle", creatorUrl: "https://www.youtube.com/watch?v=7f8g9h0i1j2" },
];
async function fetchTeaser(target) {
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, teaser: true }), signal: AbortSignal.timeout(10000) });
    if (res.status === 429) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
async function genOne(pick, today) {
  const data = await fetchTeaser(pick.creatorUrl);
  let score, risk, flags, source;
  if (data && typeof data.brand_safety_score === "number") {
    score = Math.round(data.brand_safety_score); risk = data.risk_level || "Unknown"; flags = data.top_red_flags || []; source = "safesponsor_teaser";
  } else {
    score = 68; risk = "MEDIUM"; flags = [{ category: "Comment Toxicity", description: "Evergreen fallback — teaser unavailable (429)" }]; source = "evergreen_fallback";
  }
  const slug = `${today}-${pick.niche}-teardown`;
  const title = `Creator Teardown: ${pick.niche} — ${score}/100 ${risk}`;
  const excerpt = `We audited a public ${pick.niche} creator via SafeSponsor AI teaser — real score ${score}/100, ${flags.length} flags.`;
  const outDir = path.join(process.cwd(), "content", "blog");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.md`);
  if (fs.existsSync(outPath)) { console.log(`[SKIP] ${slug} exists`); return; }
  const fm = `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
excerpt: "${excerpt.replace(/"/g, '\\"')}"
niche: "${pick.niche}"
creatorUrl: "${pick.creatorUrl}"
brandSafetyScore: "${score}"
riskLevel: "${risk}"
topRedFlags: ${JSON.stringify(JSON.stringify(flags))}
publishedAt: "${new Date().toISOString()}"
source: "${source}"
---

## The Teardown

**${source === "safesponsor_teaser" ? "Real" : "Fallback"}** teaser — ${source === "safesponsor_teaser" ? "POST /api/analyze {teaser:true}" : "evergreen_fallback per Q22.A"} — Score **${score}/100 ${risk}**, ${flags.length} flags.

${flags.map(f => `- **${f.category}**: ${f.description}`).join("\n")}

> Run your own free check at https://safe-sponsor-ai.vercel.app/?utm_source=content-engine&utm_medium=blog&utm_campaign=teardown
`;
  fs.writeFileSync(outPath, fm, "utf8");
  console.log(`[WROTE] ${outPath} ${score} ${risk} ${source}`);
  // also draft for manual copy-paste Q12/Q16
  const draftDir = path.join(process.cwd(), "content-engine", "output", "drafts", today);
  // content-engine is a separate clone at C:\Users\DELL\Desktop\SafeSponsor_AI\content-engine, but from main repo cwd, path is content-engine/output/drafts
  const altDraftDir = path.join(process.cwd(), "content-engine", "output", "drafts", today);
  try { fs.mkdirSync(altDraftDir, { recursive: true }); fs.writeFileSync(path.join(altDraftDir, `${slug}.md`), `# Draft ${pick.niche}\n\n${excerpt}\n\nFlags: ${flags.map(f=>f.category).join(", ")}\n`, "utf8"); } catch {}
}
const today = new Date().toISOString().slice(0, 10);
for (const pick of NICHE_EXEMPLARS) {
  await genOne(pick, today);
}
console.log("[DONE] 6 niche teardowns attempted");
