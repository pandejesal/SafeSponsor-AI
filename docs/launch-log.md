# Soft Launch Kit (N6)

## N6T1 — Cold Outreach (20 DTC brand marketers)

**Who:** brand marketing / partnerships managers at DTC companies that run influencer campaigns.
Find them via LinkedIn (title: "Influencer Marketing Manager" / "Brand Partnerships"), or brand
contact pages. One email each, personalized (reference a campaign or creator they worked with).

### Template

```
Subject: Free brand-safety check for {creator name} — before your next sponsorship

Hi {FirstName},

I'm the operator of SafeSponsor AI, a tool that scores creator brand safety before
sponsorships: controversies, toxic comment sections, scam history, competitor conflicts,
benchmarked at 96% precision/recall.

One example of what it catches: {one-line personalized observation about their
brand/industry, e.g. a creator in their space with past crypto promotions}.

Free to try — no card needed:
https://safe-sponsor-ai.vercel.app (one free check per account)

The full $8 report covers audience insights, sponsorship history, verified red flags,
and contract safeguards.

Happy to walk you through a report on any creator you're vetting this week.

Best,
[Your name]
SafeSponsor AI
```

**Track in a sheet:** `docs/launch-log.md` (below) — 20 rows: prospect, company, email date,
reply date, outcome.

## N6T2 — Community Posts (3)

1. **r/influencermarketing** — text post: "I built a free tool that scores creator brand safety
   (controversies, toxic comments, scam history) — one free check per account" + link.
2. **Creator economy Discord** (e.g. a sponsorships/partnerships server) — same framing, shorter.
3. **X thread** — 4-5 posts: the problem (brands burned by creator scandals) → the tool →
   free check → $8 report. Tag no one; let it find its audience.

## N6T3 — Tracking (update weekly for 90 days)

| Week | New signups | Test checkouts | Teasers run | Cost (USD) | Notes |
|---|---|---|---|---|---|
| W1 |  |  |  |  |  |

- Signups + entitlements: query Firestore `users` (count by `createdAt`).
- Test checkouts: Dodo test-mode dashboard (payments with test cards).
- Cost: `/api/usage` weekly rollup or `usage_logs` sum.