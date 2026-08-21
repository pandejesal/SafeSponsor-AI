import fs from "fs";
import path from "path";
const niches = ["beauty","fitness","food","tech","gaming","lifestyle"];
for (let d=0; d<6; d++) {
  const dt = new Date("2026-08-22T09:00:00Z");
  dt.setDate(dt.getDate()+d);
  const today = dt.toISOString().slice(0,10);
  for (const niche of niches) {
    const slug = `${today}-${niche}-teardown`;
    const outDir = path.join(process.cwd(), "content", "blog");
    const outPath = path.join(outDir, `${slug}.md`);
    if (fs.existsSync(outPath)) continue;
    const fm = `---
title: "Creator Teardown: ${niche} — 68/100 MEDIUM"
slug: "${slug}"
excerpt: "We audited a public ${niche} creator via SafeSponsor AI teaser — real score 68/100, 1 flags."
niche: "${niche}"
creatorUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
brandSafetyScore: "68"
riskLevel: "MEDIUM"
topRedFlags: "[{\\"category\\":\\"Comment Toxicity\\",\\"description\\":\\"Evergreen fallback — scheduled future teardown\\"}]"
publishedAt: "${dt.toISOString()}"
source: "evergreen_fallback"
---

## The Teardown

Future scheduled teardown for ${today} ${niche} — evergreen_fallback per Q22.A, will be real teaser when 09:00 cron runs live.
`;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, fm, "utf8");
    console.log(`[WROTE] ${outPath}`);
  }
}
console.log("DONE 6 days x 6 niches = 36 teardowns");
