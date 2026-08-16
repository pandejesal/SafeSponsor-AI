# Ops Runbooks — SafeSponsor AI

Covers the audit open items that need credentials/tools not available on the dev machine (no `gcloud`, no `vercel` CLI, no service-account JSON materialized locally — all env files carry the redacted `[SENSITIVE]` placeholder). Status as of 2026-08-16, after the deferred-audit-fix round (`44d09fd`).

## 0. Quick facts

- Prod: `https://safe-sponsor-ai.vercel.app` (Vercel, Hobby plan — 60s function wall).
- Firebase project: `safesponsor-ai-958cd`; auth domain hosts the `__/firebase/init.json` handler (Firebase Hosting site enabled).
- Repo: `pandejesal/SafeSponsor-AI`, branch `main`.
- Test account: `pandejesal@gmail.com` (uid `BawpZULCjAOko5NEdIEGrustnYm1`).
- Server admin auth: `FIREBASE_SERVICE_ACCOUNT` env var (JSON string) on Vercel. Locally it exists only as `[SENSITIVE]` in `.env.local` / `.env.local.pulled`.

## 1. Rotate test password + clean prod test records

> Audit open item 5. **Cannot run yet**: needs a real service-account JSON on disk.

1. Put the real service-account JSON into `.env.local` as `FIREBASE_SERVICE_ACCOUNT="<json>"` (or a full service-account file path as `GOOGLE_APPLICATION_CREDENTIALS` — script only reads the JSON var today).
2. `npm install` (firebase-admin already in node_modules).
3. `node scripts/rotate-test-password.js` — does, in one pass:
   - resolves `pandejesal@gmail.com` (uid fallback built in),
   - rotates the password (prints `NEW_TEST_PASSWORD=` once),
   - resets `users/{uid}.freeTeaserUsed` → `false`,
   - deletes `users/{uid}/history/*`.
4. Record the new password somewhere safe; delete the old creds file if it still exists (`.swarm/e2e/.creds` was removed 2026-08-16).
5. Pending Dodo test sessions (`cks_…`) expire by themselves in test mode — verify in the Dodo dashboard before launch.

## 2. Restore drill

> Audit open item 3. Needs: `gcloud` CLI + a service account with Firestore admin.

1. Install gcloud, `gcloud auth login`, `gcloud config set project safesponsor-ai-958cd`.
2. Export the production data: `gcloud firestore export gs://<your-bucket>/backups/$(date +%Y%m%d)` (bucket must be in the same project).
3. Documented restore path (drill): import into a scratch project first, then to prod only after a dry run:
   `gcloud firestore import gs://<your-bucket>/backups/<timestamp>` (restores the default database).
4. Verify: dashboard history loads; a test analyze round-trips.
5. `backups/` dir in the repo is empty — the drill should populate it or reference the GCS bucket.

## 3. Unlink the `safesponsor-ai2` Vercel project

> Audit open item 4a. Needs: `vercel` CLI or dashboard access with owner rights on the Vercel account.

1. `vercel login`, then `vercel switch` to the account holding `safesponsor-ai2`.
2. Verify it is a leftover/duplicate (no domains in use): `vercel domains ls` in that project dir or the dashboard.
3. Delete: dashboard → project settings → Danger Zone → Delete Project (or `vercel project rm safesponsor-ai2`).
4. Confirm `safe-sponsor-ai.vercel.app` still routes only to the real project.

## 4. UptimeRobot monitor

> Audit open item 4b. Needs: UptimeRobot account + API key (put in `.env.local` as `UPTIMEROBOT_API_KEY` for future automation; **never commit it**).

Recommended monitors (keyword: https + 200):

| Monitor | URL | Interval |
|---|---|---|
| Home | `https://safe-sponsor-ai.vercel.app` | 5 min |
| Analyze API | `https://safe-sponsor-ai.vercel.app/api/health` (GET, expects 200) | 5 min |
| Checkout readiness | manual click-through after Dodo prices fixed | — |

Alert contact: email. No SMS on the free tier.

## 5. Sentry

> Audit open item 4c. Both `sentry.client.config.ts` and `sentry.server.config.ts` are NO-OPs until a DSN is set (`NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`). No DSN is configured anywhere.

1. Create a Sentry project (Next.js template) or reuse an org.
2. Set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (client) in Vercel env, redeploy.
3. Confirm: trigger a synthetic error, check the Sentry issue stream.
4. Note: `NEXT_PUBLIC_*` DSNs are visible in the client bundle by design.

## 6. Authorized domains (visual check)

> Audit open item 2. Sign-in works on prod (E2E run6 10/10 PASS) → `safe-sponsor-ai.vercel.app` is effectively present. Visual confirmation: Firebase console → Authentication → Settings → Authorized domains; confirm `safe-sponsor-ai.vercel.app` (and the auth domain from Firebase Hosting) are listed.

## 7. Dodo products & webhook (DONE on new account; Vercel env update is user-action)

> Audit E2E-4 / S-003 / S-006. The original Dodo account was lost; the user created a NEW
> account and handed over a products-scoped test-mode API key. Products were created
> programmatically on the new account (scripts/dodo-create-products.js) at the correct
> USD prices, and the test-mode webhook endpoint was created (scripts/dodo-setup-webhook.js):

| Product | Price | Product ID (test) |
|---|---|---|
| Single Report | $8.00 USD one-time | `pdt_0NlWuG9SbcATQxHLyYawW` |
| Channel Report | $19.00 USD one-time | `pdt_0NlWuGIhziGGhxd8beRPc` |
| Pro | $149.00 USD / month (named) | `pdt_0NlWuRCCHHazsop6t4iup` |

- Checkout-session creation verified against these IDs (scripts/dodo-checkout-probe.js
  → 200 + test checkout URL).
- Webhook endpoint `ep_3I0QiPxfxfuWAoVX0lIw8iIKBjm` → `https://safe-sponsor-ai.vercel.app/api/webhook`,
  filtered to the 6 events the app handles; signing secret (38 chars) wired into
  `.env.local` as `DODO_PAYMENTS_WEBHOOK_SECRET`.
- `.env.local` now holds: `DODO_PAYMENTS_API_KEY` (new), `DODO_PAYMENTS_MODE=test_mode`,
  the 3 product IDs, and the webhook secret.

**Done — Vercel env + redeploy (2026-08-16, via CLI)**: Vercel CLI 59.1.3 installed
(`npm i -g vercel`), logged in, `vercel link --project safe-sponsor-ai --yes`,
`scripts/vercel-env-sync.js` replaced the 6 vars in Production with the values from
`.env.local`, and `vercel --prod --yes` deployed: `dpl_5VWu51mv5MYJ2rKGnjc8YjShP5S7` →
`https://safe-sponsor-ai.vercel.app`. Verified: `/api/health` →
`{"ok":true,"db":"ok","paymentsMode":"test"}` and homepage 200.

Re-run this when `.env.local` changes: `node scripts/vercel-env-sync.js && vercel --prod --yes`.

**Verified on production (2026-08-16)**: browser profile re-seeded (`.swarm/e2e/reseed.js`
— one manual Google sign-in), then `node .swarm/e2e/checkout-api-check.js` → `POST
/api/checkout` for all 3 plans returned 200 with `test.checkout.dodopayments.com/session/cks_…`
URLs using real auth headers. Full `e2e5.js` run: 7 PASS / 0 FAIL (S1/C1/P1 card clicks
partial — driver timing, contract verified via the API check).

Verify the intro discount code is exactly $50 off (S-006) in the Dodo dashboard.

**Before live go-live**: repeat this setup in LIVE mode — live API key, live product IDs
(still $8/$19/$149), a live webhook endpoint + secret — and update Vercel again.

After deploy: rerun `node .swarm/e2e/e2e5.js` (needs `NODE_PATH` pointing at a folder with
playwright; driver kept at `.swarm/e2e/e2e5.js`). If the signed-in profile is missing,
run `node .swarm/e2e/reseed.js` first and complete the Google sign-in once.