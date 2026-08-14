# SafeSponsor AI — Implementation Plan (Quarter)

> Target reader: AI coding agent (opencode / DeepSeek V4 Flash Free). Terse by design — read the whole file before editing. Task IDs are stable references (`M1T1`). Execute milestones in order; run each milestone's checks before moving on.

## 1. Context

SafeSponsor AI is a Next.js 15 (App Router, TS, React 19) app that turns a creator handle/channel/video URL into a `brand_safety_score` (0–100) risk dossier via a two-pass pipeline (research → synthesis) using Gemini models with Groq fallback. Auth: Firebase (Google Sign-In + App Check). Data: Firestore via Admin SDK only for entitlements. Payments: Dodo Payments (single report, channel report, monthly Pro subscription). Reports are cached globally in `global_audits` (sanitized of brand strategy).

This quarter: harden unit economics (cost tracking + caps), add a benchmark-driven accuracy loop, lower prices + add intro-coupon upsell, ship data lifecycle controls (TTL / takedown / GDPR), and extend research depth to TikTok → Instagram → Twitch/X.

## 2. Current State Inventory

### 2.1 API Routes (`app/api/*/route.ts`)

| Route | Method | Purpose | Notes |
|---|---|---|---|
| `analyze` | POST | Main pipeline: auth + app check → atomic quota claim → research (YouTube transcript/comments + channel metadata via YouTube Data API; Gemini text-only — no web search) → Gemini synthesis w/ fallback → save dossier + global cache | `runtime=nodejs`, `maxDuration=120`, hard `OVERALL_BUDGET_MS=50000`; input bounds: target 500, brand_name 100, competitor_brands 5×100, additional_urls 3×300, aliases 5×100; global cache is SKIPPED for paid/subscribed users (they pay for fresh analysis, route.ts ~L475); rate_limits 10/min per-user (~L352) |
| `checkout` | POST | Validates App Check + auth, creates Dodo payment link | `plan` enum: `single` \| `channel` \| `subscription`; zero fail-open (502/500 on error) |
| `verify-payment` | POST | Polls Dodo payments list (30d window, page 20) after redirect; grants entitlements on `succeeded` | Grants `videoCredits`/`channelCredits` or `subscription` + `expiresAt` |
| `webhook` | POST | `standardwebhooks` signature verify + 5-min replay window + 1MB cap; grants/revokes entitlements atomically | Events: `payment.succeeded`, `subscription.active/renewed/cancelled/expired`, `refund.succeeded` |
| `check-credits` | GET | Returns `videoCredits`, `channelCredits`, `hasSubscription`, `subscriptionExpiresAt`, `cancelAtPeriodEnd`, `plan` | Sub active iff `hasSubscription && expiresAt > now` |
| `save-dossier` | POST | Validates + persists client dossier to `users/{uid}/history` | Zod schema, server-stamped `createdAt` |
| `clear-cache` | POST | Admin-only (`role === "admin"`) delete of `global_audits/{target_key}` | key sliced to 500 |
| `cancel-subscription` | POST | Schedules Dodo subscription cancellation | |

### 2.2 Lib (`lib/*`)

| File | Exports | Notes |
|---|---|---|
| `firebase-admin.ts` | `adminDb`, `adminAuth`, `adminAppCheck`, `verifyAuthHeader`, `verifyAppCheckHeader` | App Check opt-in via `ENFORCE_APP_CHECK=true`; config from `firebase-applet-config.json` |
| `dodopayments.ts` | `getDodoPayments()` | `DODO_PAYMENTS_MODE` test/live; singleton client |
| `seeded_audits.ts` | `getSeededAudit()` | Seed dossier data |
| `utils.ts` | `sanitizeUrl()` | URL sanitization |

### 2.3 Firestore Collections

| Collection | Shape | Writes |
|---|---|---|
| `users/{uid}` | entitlements: `videoCredits`, `channelCredits`, `hasSubscription`, `subscription.{expiresAt,cancelAtPeriodEnd}`, `plan`, `role` | Server-only via Admin SDK; rules forbid client writes to sensitive fields |
| `users/{uid}/history` | dossiers | Server-only (`allow write: if false`) |
| `global_audits/{targetKey}` | sanitized report, `createdAt`, `updatedAt` | Server-only; anti-poisoning guard (worse score doesn't overwrite fresh cache) |
| `rate_limits/{uid}` | per-user rate limit state (10/min) | Server-only, analyze route ~L352 |
| `processed_webhooks/{id}` | webhook idempotency markers | Server-only, webhook route ~L144 |

### 2.4 Env Vars (`.env.example`)

`GEMINI_API_KEY`, `APP_URL`, `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_MODE`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PAYMENTS_PRODUCT_ID_SINGLE`, `DODO_PAYMENTS_PRODUCT_ID_CHANNEL`, `DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION`, `YOUTUBE_API_KEY`, `GROQ_API_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `ENFORCE_APP_CHECK`.

## 3. Decisions Lock (from grilling, 2026-08-14)

| ID | Decision |
|---|---|
| D1 | Serve all segments (DTC / agencies / enterprises) as **one product**; no segmented tracks |
| D2 | Moat = **research depth**; scoring + speed are enablers |
| D3 | Benchmark: **100-creator CSV** ground truth, ≥90% precision AND recall, **CI gate** on prompt/pipeline changes |
| D4 | Prices **lowered permanently**: Single **$8**, Channel **$19**, Pro **$149**; first-purchase Pro intro **$99** via coupon |
| D5 | Upsell = **pre-checkout inline banner** (non-blocking, no modal, no auto-pop) |
| D6 | Unlimited Pro guardrail: **50 audits/day cap** (counts all audits; paid users skip the global cache by design, so there is no cache exemption) |
| D7 | Full cost instrumentation: per-model-call token/latency logs, weekly rollup, alert at 75% of worst-case budget |
| D8 | Lifecycle (all three ship): cache **TTL tiers** (90/180d), creator **takedown form + admin review** (48h SLA, tombstone), **GDPR export/delete** |
| D9 | Platform order: **TikTok → Instagram → Twitch/X**; YouTube deepened in parallel |
| D10 | TikTok stack: **oEmbed + open-source scraper + Apify free tier**, rotating fallback; legal review in takedown milestone |
| D11 | Milestone order: M1 Economics → M2 Benchmarks → M3 Pricing → M4 Lifecycle → M5 TikTok |
| D12 | Per-audit cost ≈ $0.03–0.10; break-even ≈ 2,000 audits/mo/subscriber at $149 |

## 4. Constraints / Bounds (do not violate)

| Constraint | Value |
|---|---|
| Analyze wall-clock budget | `OVERALL_BUDGET_MS = 50000` (Vercel Hobby ~60s; `maxDuration=120`) |
| Single LLM call budget | `GEMINI_TIMEOUT_MS = 12000`, retries ≤ 1 (429 only), deadline pre-check |
| Unrestricted model fallback | `gemini-3.6-flash → gemini-3.5-flash → gemini-3.1-flash-lite → GROQ` |
| Pro audit cap | 50/day per user; counts ALL audits (paid users skip global cache by design, so no cache exemption) |
| Input bounds | target ≤500, brand ≤100, competitors ≤5×100, urls ≤3×300, aliases ≤5×100 |
| Webhook | ≤1MB, replay window 5min, signature always verified |
| Entitlement writes | Server-only; client rules forbid sensitive fields |
| Cache | Always sanitized of brand strategy; anti-poisoning guard stays |
| Cost alert | Fire when weekly spend or per-audit cost exceeds budget (defined in M1) |
| No new secrets | All keys stay in env vars; nothing hardcoded |

## 5. Milestones

### M1 — Economics & Guardrails

**Check**: `npm run build && npm run lint` + M1-specific unit test (`npm run test:m1`).

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| M1T1 | — | Instrument `generateWithModelFallback` (and Groq call) in `app/api/analyze/route.ts`: log per call — model, inputTokens, outputTokens, latencyMs, estCostUsd (rate table constant), targetKey, uid, ts | Usage docs written to `usage_logs/{autoId}` for every LLM call (success and failed models) |
| M1T2 | M1T1 | Weekly cost rollup: aggregate `usage_logs` by uid/week — total calls, tokens, estCostUsd, by model | Rollup doc `usage_rollups/{yyyymmdd-week}`; exposed via admin-only `GET /api/usage` |
| M1T3 | M1T1 | 50/day audit cap for subscription users: per-uid day-stamped counter `usage_daily/{uid}_{yyyymmdd}`, atomic `runTransaction` check+increment at quota-claim point; paid users never get global-cache hits (by design), so the cap counts every audit — no exemption; 429 `{error: "Daily audit limit reached"}` over 50. **Also:** add `tsx` to devDependencies + create `"test:m1": "tsx scripts/test_m1.ts"` npm script (M1 gate depends on it; do NOT defer to M2) | Script `scripts/test_m1.ts` (unit, mocked DB): cap enforces at 50, atomic under concurrency, 429 payload correct; `npm run test:m1` runs standalone (tsx installed in this task) |
| M1T4 | M1T1, M1T2 | Cost alerts (formulas fixed against real worst case): (a) weekly rollup estCostUsd > 75% × (50 × 7 × $0.10) = **$26.25/week** → log `[COST ALERT]` + set admin flag on the rollup doc; (b) any single audit estCostUsd > $0.30 (worst case across up to 3 LLM calls: pass1 + pass2 + repair at 15s each, route.ts ~L957/1037/1204) → log `[COST ALERT]` + admin flag. Per-audit basis = sum of estCostUsd of all calls in that audit, keyed by targetKey | Alert logic unit-tested in `scripts/test_m1.ts` (both thresholds fire at exactly 75% and $0.30, not before) |
| M1T5 | M1T3 | Add env vars to `.env.example`: `PRO_DAILY_AUDIT_CAP=50`, `COST_ALERT_THRESHOLD_USD` (defaults sane); document in README | `.env.example` updated; README env table extended |

### M2 — Benchmark Loop

**Check**: `npm run build && npm run lint` + `npm run benchmark` passes ≥90% precision AND recall.

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| M2T1 | — | `scripts/benchmarks/creators.csv`: 100 real creators — columns `handle,platform,url,label(risky|ok),notes`; labels: ~50 risky, ~50 ok; mix of YouTube/TikTok/IG | CSV committed; labels defensible (notes explain each) |
| M2T1a | — | **Testability refactor (required for deterministic eval):** extract the analyze pipeline core out of `POST()` into `lib/analyze-pipeline.ts` with injected dependencies — `llmProvider` interface (generateContent) + `videoFetcher` (transcript/comments) + `db` facade; route stays thin (auth, quota, response). Add env `LLM_MOCK_MODE=true` that swaps in a scripted mock provider, and `MOCK_YOUTUBE_FETCHES=true` for the fetcher | `lib/analyze-pipeline.ts` exported; route delegates to it; mock modes produce identical dossier shape with zero network calls; existing build/lint pass; no behavior change in default mode |
| M2T2 | M2T1a | `scripts/benchmarks/eval.ts`: for each CSV row, run pipeline core with `LLM_MOCK_MODE=true` + `MOCK_YOUTUBE_FETCHES=true` (deterministic, zero network in CI), compare `risk_level`/score vs label; compute precision, recall, F1; write `scripts/benchmarks/last-run.json` | Scorecard JSON with per-row results + aggregate metrics; run fully offline |
| M2T3 | M2T2 | `package.json` scripts: `"benchmark": "tsx scripts/benchmarks/eval.ts"` (tsx already added in M1T3); GitHub Action `.github/workflows/benchmark.yml` on PRs touching `app/api/analyze/**`, `lib/analyze-pipeline.ts`, `scripts/benchmarks/**`, prompts | Action fails when precision < 0.90 OR recall < 0.90; run on `pull_request` + `push` to main; mock env vars set in the Action |
| M2T4 | M2T3 | Scorecard diff: `last-run.json` committed baseline + action prints `previous vs current` deltas | Deltas visible in action logs; regression visible in one glance |

### M3 — Pricing & Upsell

**Check**: `npm run build && npm run lint` + manual smoke (checkout shows new prices + banner once).

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| M3T1 | — | Change prices to Single **$8** / Channel **$19** / Pro **$149** in ALL price-bearing files: `app/page.tsx` (~L568-702), `app/dashboard/page.tsx` (~L1039-2117), `app/layout.tsx` JSON-LD (~L82-95), plus `.env.example` comment values ($10/$25/$199) and README | No hardcoded old prices in app code; `grep -r "199"` clean in `app/` (env-comment/README doc updates exempt by name) |
| M3T2 | M3T1 | First-purchase Pro intro at **$99**: apply in `/api/checkout` when `plan=subscription` AND user has no `introProClaimed` flag; webhook marks `introProClaimed=true` on success. **Fallback if Dodo checkout payload (currently `product_cart/customer/return_url/metadata` only, route ~L102-115) has no discount field:** create a separate Dodo product `PRO_INTRO_99` and pick it when the flag applies — verify which path Dodo supports in-task, implement one | Intro applies exactly once per user; second purchase is $149; chosen mechanism documented in code comment |
| M3T3 | M3T1 | Pre-checkout **inline banner** (not modal) in checkout page: "Get Pro for $99 your first month" shown only when user lacks active subscription; dismissible; shows once per session (localStorage) | Banner never re-opens after dismissal; no auto-pop; renders inline, non-blocking |
| M3T4 | M3T2, M3T3 | Wire banner → checkout with intro price applied; update README pricing section | End-to-end: banner click → checkout shows $99 → payment → entitlement |

### M4 — Data Lifecycle

**Check**: `npm run build && npm run lint` + lifecycle smoke test (TTL stale re-audit, takedown deletes + tombstones, export/delete round-trip).

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| M4T1 | — | Cache TTL: `global_audits` docs get `cacheExpiresAt` (90d) and `hardExpiresAt` (180d). Read path in `analyze`: `cacheExpiresAt` past → re-audit (still serve stale with `is_cached:true, cached_at` note while refreshing); `hardExpiresAt` past → treat as miss | TTL fields stamped on all new cache writes + backfilled on read; seeded docs unaffected |
| M4T2 | — | Creator takedown: public `POST /api/takedown` form (target URL/name, requester contact) → `takedown_requests/{autoId}` (status: pending); admin queue page/route lists pending; admin approve → delete dossier from `global_audits` + write `takedown_tombstones/{targetKey}`; 48h SLA clock starts at submit; audit log. **Required analyze-route change (explicit):** in the cache read path (`app/api/analyze/route.ts` ~L520) check `takedown_tombstones` before serving; in the write path (~L1316) skip re-cache of tombstoned keys | Takedown deletes cache entry, tombstone blocks future re-cache AND serving of the same key, requester gets status via `GET /api/takedown/{id}` |
| M4T3 | — | GDPR export: `GET /api/export` returns all user data (profile, history dossiers, usage logs) as JSON download | Authorized user receives full JSON; admin cannot trigger on others without role check |
| M4T4 | — | GDPR delete: `POST /api/delete-account` cascades: delete `users/{uid}`, `users/{uid}/history`, `usage_logs`, `usage_daily` for uid (Firestore has no cascade — implement recursive list+delete in batches, subcollections included); keeps Firestore rules server-side; confirmation required | Post-delete: `check-credits` returns fresh-state; docs gone (verified by list query); re-login creates new doc |
| M4T5 | — | PII scrub in dossier output: transcripts/notes redacted of email/phone/street patterns before cache save (`lib/utils.ts` helper) | Unit test: emails/phones/addresses absent from sanitized cache doc |

### M5 — Research Depth (TikTok → Instagram → Twitch/X)

**Check**: `npm run build && npm run lint` + provider rotation unit test (`scripts/test_m5.ts`).

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| M5T1 | — | TikTok data layer `lib/providers/tiktok.ts`: provider interface `{name, fetchProfile, fetchComments, fetchVideos}`; **TikTok stack**: (1) oEmbed (free metadata), (2) open-source scraper lib, (3) Apify free tier; rotation on rate-limit/failure; graceful degradation to metadata-only when all fail | Provider returns structured evidence or explicit `data_quality: limited`; rotation unit-tested in `scripts/test_m5.ts` |
| M5T2 | M5T1 | Integrate TikTok evidence into analyze research pass: profile bio/stats, top comments (toxicity sample), video titles → dossier sections `platform_evidence.tiktok`; transcripts unavailable → flag in `data_quality_note` | Analyze with TikTok target produces platform section; no crash when provider fails |
| M5T3 | M5T1 | Instagram provider (scrape-based, same interface): posts captions, comment sample, bio; follow-thru on Instagram's rate limits with rotation. **Legal review required before scrape-based IG ships (same review owned by M4 takedown milestone); if rejected, fall back to metadata-only via public endpoints + web-search-backed backlash scan** | IG evidence in dossier or `data_quality: limited`; graceful; legal review note in task output |
| M5T4 | M5T1 | Twitch/X providers: Twitch (official API: stream titles, clips, chat sample via public endpoints); X (web search-based backlash scan, no direct scrape) | Evidence sections per platform; X uses web-search grounding only |
| M5T5 | M5T2–M5T4 | YouTube depth: channel history (past controversies, deletion gaps), deeper comment sampling (top 100), sponsor-pattern detection in transcripts | New fields in `platform_evidence.youtube`; backward-compatible dossier schema |

## 6. Definition of Done (whole quarter)

1. `npm run build` passes; `npm run lint` clean (no new warnings beyond baseline).
2. All milestone checks pass: `npm run test:m1` (tsx dep added in M1T3), `npm run benchmark` (≥90/90, mock-mode offline), lifecycle smoke, `npm run test:m5`.
3. No secrets hardcoded; all config via env (`secretscan` clean on new files).
4. Firestore rules unchanged except documented additions (no client entitlement writes ever).
5. Dossier schema additions backward-compatible; old cached dossiers still render.
6. README updated: pricing, env vars, benchmark + usage scripts, takedown/export endpoints.
7. Critic pass: a fresh agent reads this file + the diff and finds no contradictions or gaps.

## 7. Next Phase — Ops & GTM (post M1–M5)

> Status: M1–M5 implemented (commit e5738c1), audited, fixed, all checks green (build/lint/tests/benchmark 96/96). This phase runs **two parallel tracks**: Operations (hardening) and GTM (first users). Dodo stays in **test mode** — the 90-day success metric is **completed test checkouts + signed-up users**, not real revenue. Live flip only after ops readiness (N5 gate).

### 7.1 Decisions (grilled 2026-08-14)

| ID | Decision |
|---|---|
| N-D1 | Ops scope: monitoring + backups + runbook + **sole-prop legal** (no LLC; LLC at $10–20k revenue) |
| N-D2 | Parallel tracks; revenue proof = test checkouts; live flip gated on ops completion |
| N-D3 | Monitoring = free tier: `/api/health` + UptimeRobot (50 checks) + Sentry free + Vercel dashboard |
| N-D4 | Backups = scheduled GCP Firestore backups (~$10–20/mo) + monthly export script + one restore drill |
| N-D5 | **Score teaser**: sign-in required, **1 per account**, full pipeline run, output = score + risk_level + 2–3 red-flag headers ONLY; result **discarded** (no storage — purchase re-runs). **Repurposes the existing `freeAnalysisUsed` free-analysis entitlement as the teaser cap** — there is exactly ONE free pipeline run per uid total, and its output is the trimmed teaser, not a full dossier. This removes the pre-existing free full-dossier flow (was one free full dossier stored to history + `global_audits`); the $8 upsell is the only path to a full dossier for free-tier users |
| N-D6 | Teaser upsell: "$8 unlock full dossier" primary, $149 Pro secondary |
| N-D7 | Teaser placement: homepage hero + dashboard tab (shared 1-cap counter) |
| N-D8 | SEO: 5 static pages (homepage + 4 per-platform "creator brand safety check"), each embedding the teaser |
| N-D9 | Launch: soft launch + 20 cold outreach emails to DTC brand marketers + 3 community posts |
| N-D10 | Ops order: Monitor → Backup → Runbook → Legal docs |

### 7.2 Milestones (N1–N6)

#### N1 — Score Teaser

**Check**: `npm run build && npm run lint` + `npm run test:n1` (new script).

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| N1T1 | — | Teaser output mode in pipeline: new flag `teaser=true` → **forces a fresh run (bypasses cache/seed read path)**, dossier returned with score, risk_level, and 2–3 top red-flag headers ONLY (all detail fields stripped); result **not** written to history or `global_audits`; **skips the entire normal entitlement-claim transaction** (no credit decrement, no subscription cap slot, no daily cap counter change — only the `freeAnalysisUsed` cap from N1T2 applies); **takedown tombstone check still enforced** (mirror M4T2) even though the result is discarded; `usage_logs` + `usage_alerts` (cost visibility) STILL apply to teaser runs. Also: create `scripts/test_n1.ts` and add `"test:n1": "tsx scripts/test_n1.ts"` to package.json (mirror M1T3) | `teaser=true` output has no full dossier fields and never serves cached/seed full dossiers; no history/global_audits write for teaser runs; no credit/slot/cap-counter consumption; tombstoned creators denied; cost rows still logged; unit test in `scripts/test_n1.ts`; `npm run test:n1` runs |
| N1T2 | N1T1 | 1-per-account teaser cap: **repurpose `freeAnalysisUsed` as the teaser cap** — atomic `runTransaction` check+set (mirror M1T3 pattern); cap applies to EVERY uid (no paid-user exemption; paid users simply don't see the teaser CTA — UI-level); second teaser → 429/`{error:"Free teaser already used"}`. **Also: gate the cache/seed read path** (`route.ts` ~L468, currently `!isPaidUser`) on paid entitlement — any user WITHOUT a paid entitlement (teaser-exhausted or never-teasered) skips seed/`global_audits` cache reads entirely (fall through to quota denial 402/429), so stored full dossiers are never served to free-tier users through the normal analyze path | Cap enforces once per uid atomically; free users (any state) get no seed/cache full dossiers (quota denial only); unit tested |
| N1T3 | N1T2 | Homepage hero teaser: input (handle/URL) + "Check any creator free" CTA → runs teaser → result card (score + flags) → upsell buttons ($8 full dossier primary, $149 Pro secondary) | Hero flow works end-to-end; upsell routes to checkout with plan preset |
| N1T4 | N1T2 | Dashboard tab teaser (same shared cap counter as hero) | Tab works; cap shared — hero use blocks tab use and vice versa |
| N1T5 | N1T3 | Teaser result page: "Unlock full dossier for $8" button → `/api/checkout` plan=single (dossier re-runs on purchase) | Purchase path re-runs pipeline, returns full dossier to history + cache |

#### N2 — SEO Landing Pages

**Check**: `npm run build && npm run lint` + manual: 5 URLs render, sitemap updated.

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| N2T1 | N1T3 | Homepage SEO pass: title/description/H1 target "creator brand safety check", teaser embedded, schema.org markup | Homepage meta + structured data correct |
| N2T2 | N2T1 | Static page `/brand-safety/youtube`: copy + embedded teaser (YouTube pre-selected hint) | Page renders; teaser functional from page |
| N2T3 | N2T1 | Static page `/brand-safety/tiktok` | Same as N2T2 |
| N2T4 | N2T1 | Static pages `/brand-safety/instagram`, `/brand-safety/twitch` | Same as N2T2 |
| N2T5 | N2T2–N2T4 | Update `app/sitemap.ts` to include all 5 pages; internal links between pages | All 5 URLs in sitemap; crawlable |

#### N3 — Monitoring

**Check**: `npm run build && npm run lint` + curl `/api/health` returns 200 JSON.

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| N3T1 | — | `GET /api/health`: no-auth, returns `{ok:true, ts}` + Firestore ping (best-effort, fail-open) | 200 JSON under 1s; no secret exposure |
| N3T2 | N3T1 | UptimeRobot: monitor on `/api/health` (50 free checks) + docs note in **README** (runbook N5T1 will link it) | Monitor configured; README documents it |
| N3T3 | — | Sentry free tier: `@sentry/nextjs` init (DSN via `NEXT_PUBLIC_SENTRY_DSN` env, unset = disabled), capture route errors | Errors appear in Sentry when DSN set; no-op when unset; build/lint clean |

#### N4 — Backups

**Check**: restore drill log (documented output file).

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| N4T1 | — | Scheduled GCP Firestore backups for all collections (`users`, `global_audits`, `usage_*`, `takedown_*`, `rate_limits`); daily, 30-day retention; documented in **README** (runbook N5T1 will link it) | Backup schedule active; documented; cost note in README |
| N4T2 | — | `scripts/export_firestore.ts`: admin SDK export of all collections to local JSON (used as free monthly belt-and-braces) | Script runs; output JSON valid; `npm run export:db` script added |
| N4T3 | N4T1 | Restore drill: restore latest backup to a scratch collection, verify counts match, write `docs/restore-drill-<date>.md` | Drill log documents procedure + verification result |

#### N5 — Runbook & Legal

**Check**: docs exist; Terms/Privacy pages render.

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| N5T1 | N3T3 | `docs/runbook.md`: incident tiers, alert responses (uptime/cost/error), rollback (git revert + redeploy), support contact, escalation to user | Runbook covers cost alert, downtime, webhook failure, takedown SLA breach |
| N5T2 | N5T1 | Support inbox: contact form or email alias documented in runbook + site footer | Contact path exists and is documented |
| N5T3 | — | Refresh `app/(legal)/terms` + `app/(legal)/privacy`: teaser (1-free, sign-in), takedown process, test-mode payment notice, sole-prop operator identity | Legal pages updated and consistent with actual behavior |
| N5T4 | N5T3 | Sole-prop record-keeping note in runbook: tax-relevant docs (revenue from Dodo payouts) | Documented |

**N5 gate — live-mode flip checklist** (executed only after N1–N5 done): test E2E checkout in test mode → set Dodo live keys + live product IDs + live webhook secret → verify a $0 test → `ENFORCE_APP_CHECK=true` → monitor 48h. Not part of the 90-day milestone; triggered by user decision.

#### N6 — Soft Launch

**Check**: manual: launch log with dates/links.

| Task | Depends | Description | Acceptance |
|---|---|---|---|
| N6T1 | N1T3, N2T5 | Cold outreach: 20 DTC brand marketers, template mentioning free teaser link, tracked in a sheet | 20 personalized emails sent; replies logged |
| N6T2 | N1T3, N2T5 | Community posts: r/influencermarketing, one creator Discord, X thread — teaser link + use-case framing | 3 posts live with links |
| N6T3 | N6T1, N6T2 | Success tracking: signed-up users + completed test checkouts (check-credits/usage queries), weekly review note in `docs/launch-log.md` | Metrics collected weekly for 90 days; log updated |

### 7.3 Definition of Done (Next phase)

1. Teaser live: hero + dashboard, 1-cap enforced, result discarded, $8 upsell path works end-to-end.
2. 5 SEO pages live, sitemap updated.
3. `/api/health` + UptimeRobot + Sentry operational; runbook + support inbox documented.
4. Backups scheduled + drill completed with log.
5. Terms/Privacy refreshed; sole-prop record-keeping documented.
6. Soft launch executed: 20 emails + 3 posts + weekly metric log.
7. All checks green: `npm run build`, `npm run lint`, `npm run test:m1/m4/m5`, `npm run test:n1`, `npm run benchmark` (≥90/90).
8. Critic pass on the full diff before launch wave.


