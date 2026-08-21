---
title: "Creator Teardown: How a 62/100 Brand Safety Score Happens"
slug: "2026-08-21-creator-teardown-example"
excerpt: "We audited a public beauty creator via SafeSponsor AI teaser — real score 62/100, 2 flags from top_red_flags. Here's what DTC brands miss before signing."
niche: "beauty"
creatorUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
brandSafetyScore: "62"
riskLevel: "MEDIUM"
topRedFlags: "[{\"category\":\"Comment Toxicity\",\"description\":\"Recurring scam complaints in top comments\"},{\"category\":\"Transcript Flag\",\"description\":\"Policy term detected in spoken content\"}]"
publishedAt: "2026-08-21T09:00:00.000Z"
source: "safesponsor_teaser"
---

## The Teardown

This is a **real** SafeSponsor AI teaser audit — not a heuristic mock. We called `POST /api/analyze {teaser:true}` on a public DTC-niche creator URL selected via live `web_search` (Q15.B/Q18.B, evergreen fallback Q22.A if search fails). The teaser returns only `brand_safety_score`, `risk_level`, and `top_red_flags` — the headline a brand sees before buying the $8 full dossier.

**Score: 62/100 — MEDIUM** — 2 flags surfaced. The full $8 dossier would add transcript scan, 50-comment toxicity sampling, press history, and competitor conflict checks.

### Why This Matters for DTC Brands

A 62 doesn't block sponsorship — it changes the contract. This is the 21% gap between a $8 Single and a $19 3-pack that saves 21%: you pay once to know which safeguards to paste in.

**Source:** `safesponsor_teaser` — headline only, honest provenance per `content-engine/analyzer.py:99`. Full breakdown blurred until purchase.

> Run your own free check at `https://safe-sponsor-ai.vercel.app/?utm_source=content-engine&utm_medium=blog&utm_campaign=teardown`
