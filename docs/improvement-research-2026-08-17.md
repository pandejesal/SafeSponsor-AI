# SafeSponsor AI — Monetization & Design Improvement Research (2026-08-17)

Research-based recommendations, ranked by expected revenue impact. Grounded in 2026 SaaS pricing/CRO studies (Artisan Strategies, GoGoChimp, Framiq/Landdding, Subscription Index, Quantide/SBI, GrowThunders pricing comparison).

## Part 1 — Make People Spend More (Monetization)

### P1. Turn on the $99 intro offer (already built! — highest ROI, zero dev)
- The M3T2/M3T3 intro logic is **fully implemented** (banner + checkout price application + introProClaimed guard). It's dead because `DODO_PAYMENTS_DISCOUNT_CODE_PRO_INTRO` is unset on Vercel.
- First-purchase Pro at $99 (vs $149) converts more first-time buyers, and the guard means second purchases bill full $149. **Revenue math:** even at $99 vs $149, an intro user who would have churned as $8 report buyers is pure upside; studies show intro/launch offers lift first purchase 15–30%.
- **Action:** verify the discount code exists in Dodo dashboard (audit open item), set the env var on Production + Preview, redeploy, verify E2E.

### P2. Add annual Pro billing (2nd-biggest structural lever per research)
- Artisan Strategies 2026: **annual-first pricing lifts conversion 10–20%**; Subscription Index: annual plans raise LTV 25–50% vs monthly-only; annual subscribers renew 3–5x better.
- Recommended: **$149/mo monthly OR $1,490/yr annual** (effectively 2 months free — "Save 17%"). Research says for B2B, 10–12x monthly = 0–17% discount is right (don't over-discount). Monthly stays the acquisition engine; annual is the retention engine.
- **Action:** create a second Dodo recurring product (annual, 1,490,000 minor units, yearly frequency), wire `plan=subscription_annual` in `/api/checkout` + UI toggle on pricing section + dashboard. JSON-LD update.

### P3. Anchor the $19 plan + add a 4th "Enterprise/Custom" tier (anchor psychology)
- GoGoChimp: a quote-only "Enterprise" tier **makes the middle tier look reasonable** — it doesn't need to convert. PricingSaaS: 3 tiers + anchor is the highest-converting structure.
- **Action:** add a muted 4th column "Agency / Enterprise — Custom" (quote via mailto). No checkout code needed. This makes $19 and $149 look cheap by comparison to $4–12K/mo competitors (CreatorIQ/Aspire/HypeAuditor).

### P4. Post-purchase upsell: $19 channel upgrade offer after $8 report
- Shopify 2026 AOV playbook: **post-purchase upsells convert 5–15%** because buyer resistance is at zero after payment; Mountain Ice raised AOV $20→$39 with one post-purchase offer.
- **Action:** after a successful $8 single report purchase, show "Upgrade this report to a full Channel audit — $11 (save $8)" one-click upsell. Second Dodo one-time product or discount code.

### P5. Credit packs / "Top-up" — buy 3 reports for $19 (bundle)
- Quantide/SBI: credits are the dominant AI monetization pattern (126% YoY growth); bundles lift AOV 15–25% when structural; quantity breaks lift 6–12%.
- **Action:** add "3 Single Reports — $19 (save $5)" pre-purchase bundle card on pricing + dashboard. Maps to channel price — natural upgrade story. Alternatively make `single` accept quantity param at checkout.

### P6. Reduce churn levers that raise lifetime spend
- **Usage-based soft limits instead of hard blocks:** after monthly cap, show "You've used X of Y audits — upgrade or top-up" rather than a wall. Transparency (usage meter) is cited by Forrester: 62% of B2B buyers abandon unclear pricing; visible usage meters build trust.
- **Save-on-cancel offer:** when a user types CANCEL, offer "Downgrade to $19/mo report credits" or pause instead of full cancel. Cancellation flow already exists — add one retention offer step.

### P7. Email capture + retargeting on the free teaser (currently sign-in-gated only)
- The free teaser currently **requires Google sign-in** before running. Research (ScienceDirect data-marketplace model): free samples boost traffic/registration — but sign-in wall before value adds friction.
- **Action (test):** allow anonymous teaser runs, then capture email at result time ("Email me the full dossier — $8"): more email leads for retargeting, less sign-in friction. Keep 1-per-IP/device limiter to protect the paywall.

### P8. Price anchoring + comparison table (current pricing section is prose)
- GoGoChimp: comparison tables (14 rows, 3-4 groups) lift conversion 8–12%; paired with FAQ + logos, 18–24%. Current pricing cards list 3-4 bullets each — upgrade to a full comparison table with checkmarks.
- Add "no credit card required" + money-back guarantee signals: risk-reversal lifts 4–9% on the recommended tier.

## Part 2 — Improve the Look (Design)

### D1. Hero: show the product, not just text (2026 standard)
- Framiq/Landdding 2026: every high-converting SaaS page leads with **real product UI**; "static hero screenshots are no longer enough — live demos became table stakes for AI pages". Current hero = headline + input + stat cards, no product visual.
- **Action:** below the hero input (or beside it), embed the **mock dossier card already on the page** (currently blurred at #demo) as a live "peek" that unblurs when the teaser runs — turning the demo into the hero visual. This converts the blur from a static mock into an interactive product demo.

### D2. Typography — the #1 differentiator in 2026
- Landdding: "Teams that invested in type shipped pages that felt intentional; Tailwind defaults / Inter-for-everything felt interchangeable." Current page uses system font stack (`font-sans`).
- **Action:** add a display font (e.g. Space Grotesk / Sora / Geist) for headings via `next/font`, keep Inter/system for body. Cheap, high visual impact.

### D3. Restrained motion + gradient discipline (already good — refine)
- Landdding: motion narrowed to "one or two tuned reveals per page"; gradients applied surgically (hero blob, CTA). Page already follows this — keep, but ensure the hero input/result transitions are the only animations (they are).

### D4. Dark mode is already the default — make it the *design*, not the fallback
- 60%+ of new AI SaaS landings are dark-dominant; current theme defaults dark (`class="dark"` on html). Good. **Polish:** unify card surfaces (`bg-zinc-900/60` vs `zinc-950` vs `zinc-900/90` — inconsistent), align border colors (zinc-800 vs zinc-700 mix), single accent: currently orange (CTA) + cyan (dark accents) — pick ONE accent for buttons and use the other only for informational tags.

### D5. Social proof is missing (only stat bar)
- Every 2026 benchmark: logos, testimonials, and metric screenshots woven through the page. Current page has zero testimonials/logos.
- **Action:** add a 2-3 testimonial strip (user can write) + "X reports delivered" / "Y creators screened" counters + trust badges (GDPR, secure payments). Research: social proof near CTA lifts 5–15%.

### D6. Mobile sticky pricing CTA (mobile is 40–60% of SaaS traffic)
- GoGoChimp: mobile pricing conversion lifts 8–15% with sticky bottom CTA bar.
- **Action:** sticky "Start free check" / "Buy report" bar on mobile below pricing/dashboard.

### D7. Micro-fixes
- Header: `<8 words` headline — current "Vet Creator Sponsorships Before You Risk Your Brand" is 8 words, good. Keep.
- Navigation: fewer than 5 links + single primary CTA (current Navbar is fine — verify).
- FAQ block is complete (8 items) — research says 6+ answers lift trial→paid 12–18%; keep expanding.
- TestModeBadge — hide entirely in live mode (it currently shows "test mode" on the pricing section; looks unfinished to buyers).

## Implementation Priority
1. **P1** intro coupon env (dev 0.5h, revenue: immediate conversion lift) — also closes an open audit item
2. **D5 + D1** testimonials + hero product visual (dev 2-4h, conversion + trust)
3. **P3** Enterprise anchor column (dev 0.5h) + **P8** comparison table (dev 2-3h)
4. **P2** annual billing (dev 2-4h, Dodo product + checkout + UI)
5. **P4/P5** post-purchase upsell + 3-pack bundle (dev 3-5h)
6. **D2/D4/D6/D7** design polish (dev 3-5h)

## Implementation Status (2026-08-17)

### SHIPPED + VERIFIED LIVE (2026-08-17/18, deploys `dpl_8bopwWeMsDHGd1aombqfyn2g1Hqo` + `dpl_Gj3CiuP3bdyquX2CL29Q5sbQ9CMy`)
- **P1 — $99 intro — DONE**: flat $50-off discount code `PROINTRO50` (`dsc_0NlbPB6h2rff55Yd84sMj`) created on Dodo (restricted to monthly Pro product, `per_customer_usage_limit:1`, `subscription_cycles:1`, `usage_limit:500`); `DODO_PAYMENTS_DISCOUNT_CODE_PRO_INTRO` set in `.env.local` + pushed to Vercel Production & Preview (verified via `vercel env ls`). Code: `/api/checkout` attaches the code; webhook stamps `introProClaimed` monthly-only; dashboard banner gated on `introAvailable && !introClaimed && !hasSubscription`; `check-credits` exposes `introClaimed`. E2E: discounted $99 session confirmed on a fresh user; already-claimed user correctly billed $149.00.
- **P2 — Annual Pro billing — DONE**: Dodo recurring product `pdt_0NlbPb3pnRdsM2q6KQpwN` ($1,490/yr, `price:149000` USD) + `DODO_PAYMENTS_PRODUCT_ID_SUBSCRIPTION_ANNUAL` env (Vercel Production+Preview). `/api/checkout` supports `plan: subscription_annual`; landing page Monthly/Annual toggle (SAVE 17% badge, "$1,490 / year · 2 months free", dynamic CTA + comparison-table price); dashboard shows "Pro · Annual"; JSON-LD annual Offer; webhook grants +12 months (`setFullYear(+1)`) and preserves `subscriptionId`.
- **E2E 20/20 PASS** (`.swarm/e2e/annual-e2e.js`, test mode, real card): landing toggle + UI session creation; monthly session $149 (no discount, claimed); annual session $1,490; annual payment → webhook grant `plan=subscription_annual` +365d; dashboard "Pro · Annual"; banner hidden; monthly re-purchase → +31d extension with `cancelAtPeriodEnd=true` active sub (sub-identity dedup guard fixed — same-subscription-only dedup, no more swallowed renewals).
- **P3 — Enterprise anchor column**: 4th muted "Agency / Enterprise — Custom" card with mailto Contact Sales in `app/page.tsx` pricing grid (now `lg:grid-cols-4`). Anchor psychology: makes $19/$149 look reasonable vs $4-12K/mo competitors.
- **P8 — Comparison table**: 7-row × 4-col "Compare Plans at a Glance" table (audit scope, transcripts, comments, competitor check, safeguards, PDF dossier, batch queue) with check/cross icons and highlighted Pro column. Live verified.
- **D2 — Typography**: Space Grotesk (via `next/font/google`, self-hosted) applied to all headings via `--font-display` CSS var in `app/layout.tsx` + `app/globals.css`. Verified in dev + prod.
- **D5 (partial) — Trust chips**: "Secure payments via Dodo Payments / No card required for the free check / Cancel anytime — no lock-in" under pricing header. NOTE: testimonials deliberately NOT fabricated — need real customer quotes (see Pending).
- **D6 — Mobile sticky CTA bar**: `md:hidden` fixed bottom bar ("Check Any Creator Free" → scrolls to hero, "See Pricing" → scrolls to #pricing); root div gets `pb-16 md:pb-0` so content is never obscured. Verified scroll behavior at 390×844.
- **D7 — TestModeBadge**: already self-hides in live mode (verified in code — no change needed).
- **D1 — Hero**: already product-first (interactive search + live score card) — no change needed.
- Smoke-verified: `npm run lint` clean, `next build` clean, Playwright dev + production (zero console/page errors, all sections visible).

### SHIPPED + VERIFIED LIVE (2026-08-18, deploy `dpl_HkAk7yNwGCsKyKrQoqthFLj84hiq`, commit `cc92e5f`)
- **P5 — 3-report $19 bundle — DONE (pricing decision: dedicated Dodo product, not quantity)**: Dodo quantity multiplies unit price (no volume discount), so 3×$8 would bill $24. Instead created a dedicated one-time product **"3-Pack Single Report"** (`pdt_0Nle7dMr3TEhcGAJYdDhk`, $19.00 USD) + `DODO_PAYMENTS_PRODUCT_ID_SINGLE_3PACK` env (Vercel Production+Preview). `/api/checkout` accepts `plan: single_3pack` → maps to the dedicated product, `quantity: 1`, and normalizes the success page + grant plan to `single` with metadata `qty: "3"`. Landing pricing card gets a "1 report / 3-pack $19 (SAVE 21%)" toggle (`app/page.tsx`), CTA + comparison table reflect the selection.
- **Grant side is quantity-aware**: `/api/webhook` and `/api/verify-payment` parse metadata `qty` (clamped 1..10) and increment `videoCredits` by qty; refunds claw back qty. Both also persist `lastDodoCustomerId` so a later one-click upsell can charge the same saved card.
- **P4 — Post-purchase $19 channel upsell — DONE (one-click, saved card)**: after a successful single/3-pack purchase, `/dashboard?dodo_success=true&plan=single` shows a modal upsell (upgrade to Channel audit, $19). "Yes, upgrade" → `/api/upsell` creates a Dodo checkout with `customer.customer_id` (saved card, `confirm: true`); on success the webhook grants `channelCredits +1`; success page shows "Channel credits added". Suppression rules: never for subscribers (`hasSubscription`), never for channel-credit holders, 20s dismiss-window (no forced modals), only on `plan=single` success. Fixed a flash bug: the popup gate now waits for `userCredits !== null` before deciding, so channel holders never see the modal flash while credits load.
- **E2E 30/30 PASS** (`.swarm/e2e/annual-e2e.js`, extended: A1/A2/A3/A6 annual pay+grant+extend+cancelAtPeriodEnd=false; M0-M4 monthly re-purchase +31d; U1-U9 single → 3-pack pricing `$19.00`, +3 video credits, single +1, popup shown, upsell one-click paid, +1 channel credit): all green on production test mode with a real card. The previous run's 3 failures ($57 cart-quantity bug on the 3-pack, card-input detection on Dodo's new short-token checkout variant, popup flash for channel holders) are fixed and re-verified.
- **Auth tooling fix (E2E infrastructure)**: Google now blocks automation browsers at accounts.google.com, so the E2E's old Google-popup sign-in was replaced by `.swarm/mint-session.js` — mints a Firebase session via the admin SDK + identitytoolkit REST and injects the `firebase:authUser:<apiKey>:[DEFAULT]` localStorage blob (single user object, not the legacy array format). `ensureAuthed` in the E2E self-heals by re-minting whenever `/dashboard` redirects to `/login`. Fully headless; no browser sign-in UI needed.

### PENDING (needs user action — external dependencies)
- **Go live with Dodo** (user has deferred): test-mode → live products/key; re-run `.swarm/e2e/annual-e2e.js` against live before/after switch; then remove `TestModeBadge` visibility concerns and switch `DODO_PAYMENTS_MODE`.
- **Testimonials**: need real customer quotes before adding (integrity — no fabrication).
- **P7 — Email capture on the free teaser**: still sign-in-gated (the proposed anonymous-teaser + email-capture flow needs a product decision on the 1-per-IP limiter and spam controls).
- **P6 — usage soft-limits**: dashboard shows the credits meter; a "top-up" soft-limit prompt at 0 credits (instead of the hard wall) is a small follow-up.

### Screenshots
- `.swarm/landing-desktop.png` (desktop, 1280×900), `.swarm/landing-mobile.png` (mobile 390×844) — before/after visual check point.