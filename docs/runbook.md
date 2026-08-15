# SafeSponsor AI — Operations Runbook

> Single-operator runbook: what to do when something breaks, in order.
> Everything here is designed to be executable by one person in < 30 minutes.

## 0. Contact & Escalation

| Role | Contact |
|---|---|
| Operator (sole proprietor) | pandejesal@gmail.com (also the support inbox) |
| Users | Support email: pandejesal@gmail.com (linked in site footer) |
| Escalation beyond self | None currently — you are the last line. Document incidents anyway. |

**Sole-proprietor record-keeping (N5T4):** keep for tax season —
- Dodo payout statements (login to the Dodo dashboard monthly; export statements)
- Test-mode transaction logs (no tax effect, but keep for audit trail)
- Stripe/Firebase invoices for paid tooling (Vercel, GCP backups)
- A running revenue log: `docs/revenue-log.csv` (date, plan, amount, mode: test/live)

## 1. Alert Sources & What Each Means

| Alert | Where it arrives | Meaning |
|---|---|---|
| UptimeRobot "down" | Email (UptimeRobot) | `/api/health` unreachable — app or network down |
| Sentry error spike | Sentry dashboard | Unhandled exceptions server or client side |
| Weekly cost alert (`usage_alerts`) | Firestore `usage_alerts` (check `/api/usage` route) | Weekly LLM spend ≥ 75% of worst-case budget |
| Per-audit cost alert | Firestore `usage_alerts` | A single audit cost ≥ $0.30 (possible runaway) |
| Dodo webhook failure | Console logs (Vercel) | Payment grant not applied — user paid but no credits |

## 2. Incident Tiers

- **T1 Critical** — site down, payments broken, data exposed. Act now, < 1 hour.
- **T2 Major** — feature broken for paying users (analyze failing), cost runaway. < 4 hours.
- **T3 Minor** — cosmetic issues, single-user edge case. < 48 hours.

## 3. Response Playbooks

### T1a — Site down (UptimeRobot)
1. Open Vercel dashboard → check deployment status + build logs.
2. If the last deploy broke it: rollback —
   ```
   git revert HEAD          # on the main branch
   git push origin main     # Vercel redeploys automatically
   ```
   Verify `/api/health` returns 200 before announcing anything.
3. If Vercel itself is down: check https://status.vercel.com — nothing to do but wait; post status note to support inbox.
4. If Firestore is down: check https://status.firebase.google.com — app is degraded (health returns `db: degraded`, fail-open), users may still see cached pages.

### T1b — Payments broken (checkout or webhook)
1. Test a $0 checkout in test mode end-to-end.
2. If checkout fails: check `DODO_API_KEY` + product IDs in Vercel env; verify Dodo dashboard shows the products; check Dodo status page.
3. If webhook fails: check `DODO_WEBHOOK_SECRET` matches the dashboard; Vercel function logs for `webhook` route errors.
4. **User paid but got nothing:** manual grant — set the user's credits/`hasSubscription` in Firestore console from the Dodo payment record, then tell them. Log it in `docs/revenue-log.csv`.

### T1c — Security incident (unusual access, leaked data, tombstone bypass)
1. Immediately: note the timestamp, freeze affected account(s) in Firebase console (disable auth).
2. Review Vercel function logs + Firebase audit logs for the affected window.
3. If the global cache served wrong data: use `app/api/clear-cache` (admin) or delete the offending `global_audits` doc(s).
4. Write an incident note in `docs/incidents/<date>-<slug>.md` (what, when, impact, fix, prevention).
5. Contact any affected user with a factual summary.

### T2a — Analyze failures
1. Check Sentry + Vercel logs for `app/api/analyze`.
2. LLM provider failing → the pipeline rotates providers; if all fail it returns 502 and refunds the entitlement (by design). Nothing to do unless it persists > 1 hour: check the provider dashboard (Gemini) for quota/outage.
3. YouTube API quota exhausted → check Google Cloud console quota page; raise quota or wait for reset.

### T2b — Cost runaway
1. Open `/api/usage` (weekly rollup). Find which uid/target consumed abnormally.
2. If a single user: consider disabling their account or blocking the target (add to `rate_limits` or `takedown_tombstones` if justified).
3. Check `usage_alerts` for the alert that fired; confirm the threshold math (75% of worst case = $26.25/wk at cap 50; per-audit = $0.30).
4. If mock-mode accidentally deployed (`LLM_MOCK_MODE=true` in prod): fix env immediately — mock audits cost nothing but are fake data.

### T2c — Takedown SLA breach (M4)
1. Takedown requests must be actioned within **48h** of confirmation. Track pending requests in `docs/takedown-log.csv`.
2. Apply: `app/api/takedown` admin endpoint, or manually set the tombstone in Firestore.
3. Verify: the key returns 404 and no cached copy is served (tombstone is checked before every cache read).

### T3 — Minor bugs
1. Reproduce, fix, deploy via normal flow.
2. Log in `docs/incidents/` only if it recurred before.

## 4. Maintenance Calendar

| Cadence | Task |
|---|---|
| Weekly (Mon) | Check `/api/usage` weekly rollup; note cost; update `docs/revenue-log.csv` |
| Monthly | `npm run export:db` (requires `FIREBASE_SERVICE_ACCOUNT`) |
| Monthly | Verify GCP scheduled backup ran (Firebase console → Backups) |
| Quarterly | Restore drill (see `docs/restore-drill-TEMPLATE.md`) |

## 5. Recovery: Key Locations

| Asset | Where |
|---|---|
| Source of truth | Git repo `main` branch; Vercel auto-deploys |
| Env vars | Vercel project settings (never in git) |
| Firestore | Firebase console, project `safesponsor-ai-958cd` |
| Payments | Dodo dashboard (test mode until the live flip) |
| Analytics | Plausible dashboard (safe-sponsor-ai.vercel.app) |
| Errors | Sentry (when `SENTRY_DSN` configured) |
| Uptime | UptimeRobot (when monitor added) |

## 6. The Live-Flip Checklist (deferred by decision N-D2)

Only when ops are complete and the operator decides to go live:
1. Test full checkout E2E in Dodo test mode.
2. Set Dodo **live** keys + live product IDs + live webhook secret in Vercel env.
3. Run a $0 test checkout (live mode sandbox).
4. Set `ENFORCE_APP_CHECK=true`.
5. Update the Terms "test mode" clause; notify users of live payments.
6. Monitor 48h: UptimeRobot + Sentry + `/api/usage`.