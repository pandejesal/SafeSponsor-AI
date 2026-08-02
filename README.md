<div align="center">

# SafeSponsor AI

**AI-powered brand safety & sponsorship vetting for e-commerce brands.**

Score creators on risk, audit comment toxicity, detect competitor conflicts, and generate contract-ready safeguards — before you spend a dollar on a deal.

</div>

---

## Overview

SafeSponsor AI is a Next.js application that turns a creator's handle, channel, or
video URL into an executive risk dossier. It works in two passes:

1. **Research pass** — grounded web search + page-fetch tools scan for competitor
   sponsorships, public controversy, and per-platform backlash. Video transcripts
   are extracted from YouTube and the 50 most recent/top comments are pulled via the
   YouTube Data API for sentiment and toxicity analysis.
2. **Synthesis pass** — findings are consolidated into a structured JSON dossier with
   a `brand_safety_score` (0–100), `risk_level`, `competitor_and_sponsorship_history`,
   `nuanced_red_flags`, `positive_highlights`, and recommended `contractual_safeguards`.

Reports are cached globally (sanitized of brand strategy) so repeat audits are instant,
and every request is guarded by authentication, rate limiting, and atomic entitlement checks.

## Features

- **360° creator risk dossiers** — grounded research verified with web search and URL retrieval.
- **Transcript safety parsing** — spoken-content analysis of YouTube videos and Shorts.
- **Comment toxicity audit** — sentiment sampling of the 50 most recent/top comments per video.
- **Competitor conflict detection** — explicit per-brand sponsorship checks with verification status.
- **Multi-provider AI fallback** — Gemini models with automatic fallthrough and a Groq backup.
- **Global report cache** — repeat audits are served instantly at zero API cost (with anti-poisoning guard).
- **Billing via Dodo Payments** — one-time Single/Channel reports and Unlimited Pro subscription.
- **Hardened security** — Firebase Auth + App Check, signed webhooks, atomic quota, strict Firestore rules.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) (App Router, TypeScript, React 19) |
| Styling | Tailwind CSS 4, `motion` |
| Backend | Next.js Route Handlers, Firebase Admin SDK (Firestore) |
| AI | `@google/genai` (Gemini) with Groq (`llama-3.3-70b-versatile`) fallback |
| Auth / DB | Firebase Auth (Google Sign-In), Cloud Firestore, App Check |
| Payments | Dodo Payments (`dodopayments`, `standardwebhooks`) |
| Validation | `zod` |

## Getting Started

### Prerequisites

- Node.js 20+ and/or [Bun](https://bun.sh) (lockfile is `bun.lock`)
- A Firebase project (Authentication email/Google provider enabled, App Check configured)
- A Gemini API key (`GEMINI_API_KEY`)

> The Firebase web config (project ID, API key, etc.) is loaded from
> `firebase-applet-config.json`. The Firestore database ID used by the app is
> `ai-studio-safesponsorai-e1584e79-9010-49e0-9421-87e9ca537559` (see that file).

### 1. Install dependencies

```bash
npm install        # or: bun install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes (prod) | Primary AI provider. |
| `APP_URL` | Yes (prod) | Public base URL (used for return links). |
| `DODO_PAYMENTS_API_KEY` | Yes (prod) | Dodo Payments secret key. |
| `DODO_PAYMENTS_MODE` | No | `test_mode` (default) or `live`. |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Yes (prod) | Verifies webhook signatures. **Required in all environments** (fail-closed). |
| `DODO_PAYMENTS_PRODUCT_ID_SINGLE` | Yes (prod) | Product ID for the $10 Single Report. |
| `DODO_PAYMENTS_PRODUCT_ID_CHANNEL` | Yes (prod) | Product ID for the $25 Channel Report. |
| `DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION` | Yes (prod) | Product ID for the $199/mo Unlimited Pro. |
| `YOUTUBE_API_KEY` | No | YouTube Data API key for comment sampling (falls back to Gemini key). |
| `GROQ_API_KEY` | No | Backup provider when Gemini is unavailable. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Yes (prod) | reCAPTCHA Enterprise key used for App Check. Required in production or App Check enforcement blocks all API calls. |

> **Firebase Admin SDK credentials:** the server-side SDK initializes with the project ID and
> relies on [Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc).
> Locally, run `gcloud auth application-default login` or start `GOOGLE_APPLICATION_CREDENTIALS` pointing at a
> service-account JSON. This is required for `/api/*` routes that access Firestore.

### 3. Run

```bash
npm run dev        # http://localhost:3000
```

Production build / start:

```bash
npm run build
npm start
```

## Project Structure

```
.
├── app/
│   ├── page.tsx              # Landing / marketing page (pricing, FAQ, demo)
│   ├── login/page.tsx         # Google sign-in
│   ├── dashboard/page.tsx     # Audit engine, batch queue, dossier viewer, history
│   └── api/
│       ├── analyze/route.ts   # POST — creator audit (auth, App Check, rate limit, quota)
│       ├── checkout/route.ts  # POST — create Dodo Payments checkout link
│       └── webhook/route.ts   # POST — verify + process payment webhooks, revoke on refunds
├── components/                 # Navbar, ThemeProvider, AuthProvider, ClientOnly
├── lib/
│   ├── firebase.ts             # Client SDK + App Check setup
│   ├── firebase-admin.ts       # Admin SDK, token verification helpers
│   ├── seeded_audits.ts        # Pre-computed dossiers for top YouTubers
│   └── dodopayments.ts         # Dodo client factory
├── scripts/seed_famous_creators.ts  # Populate global_audits via Groq
├── firestore.rules             # Security rules (admin-only writes, default deny)
└── SecurityArchitecture.md     # Threat-model and hardening spec
```

## Hosting & Deployment

- **Hosting:** this app requires a Node runtime with API routes (Firebase Admin, webhooks,
  server-side Gemini/Groq calls). GitHub Pages cannot execute these, so deploy to
  [Vercel](https://vercel.com) (import your repo — it stays private) or Cloud Run.
- **Firestore rules:** deploy `firestore.rules` or the created Firestore database to enforce
  per-user reads, user-write protection on sensitive entitlement fields, and read-only public cache.
- **App Check:** enforced by default in production (opt-out with `ENFORCE_APP_CHECK=false`).
  Provide `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` so the client can mint App Check tokens — otherwise
  all API requests will be rejected with `401`.

## Entitlements & Payments

| Plan | Price | Webhook grant |
|---|---|---|
| Single Report | $10 one-time | `+1 videoCredit` (any audit consumes it) |
| Channel Report | $25 one-time | `+1 channelCredit` (channel audits consume it; credits are interchangeable) |
| Unlimited Pro | $199/mo | `hasSubscription` (expires after 30 days unless renewed) |

- Webhooks are idempotent (deduplicated per event), signature-verified via `standardwebhooks`,
  and processed in an atomic Firestore transaction.
- Refunds / subscription cancellation event revoked entitlements (`hasSubscription=false`,
  credits are clawed back without going negative).

## Security Model

- **Authentication:** every API route verifies a short-lived Firebase ID Token.
- **Anti-bot:** Firebase App Check, fail-closed in production.
- **Quota integrity:** access grants are checked and deducted in a Firestore transaction
  (no TOCTOU double-spend).
- **Input bounds:** all fields are validated with `zod` plus server-side caps; payloads are
  capped at 1 MB.
- **Webhook authenticity:** Dodo webhook signatures are verified with `standardwebhooks`;
  the endpoint rejects unconfigured/missing secrets and out-of-window timestamps.
- **Output sanitization:** LLM-produced URLs are restricted to `http(s)` before being stored
  or rendered; `brand_safety_score` is clamped to 0–100 and verdict fields are validated before
  caching, with a poison-guard on the global cache.
- **Firestore rules:** default-deny, per-user reads, server-only writes for entitlement fields.

See [SecurityArchitecture](SecurityArchitecture.md) for the full threat-model breakdown.

## Repository

```
git clone https://github.com/pandejesal/SafeSponsor-AI.git
cd SafeSponsor-AI
```

## License

All rights reserved — not open-sourced unless agreed.