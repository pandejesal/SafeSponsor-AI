# Integration Status

## SHOPIFY INTEGRATION — NOT DONE YET

**Status:** Code complete, waiting on manual setup. Do not assume this feature works.

### What IS done (shipped)
- OAuth scaffold: `/api/shopify/connect` + `/api/shopify/callback` (`lib/shopify.ts`)
- Customer search API: `/api/shopify/customers/search`
- UI page: `/dashboard/integrations` (Connect button + customer search)
- Commits: `e6dde21`, `7266b33`

### What is NOT done
1. **Shopify Partner account** — not created (signup blocked by bot verification during automation attempt; abandoned 2026-08-24 per owner decision)
2. **Development store** — not created
3. **Custom app credentials** — no Client ID / Client secret yet
4. **Env vars not set**: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `APP_URL` (Vercel + `.env.local`)
5. **Redirect URI not configured** in the Shopify app config:
   `https://<vercel-url>/api/shopify/callback`
6. **End-to-end flow never tested** (connect → consent → callback → token stored)

### Resume checklist (~10 min, free)
- [ ] Sign up at partners.shopify.com (email verification required — manual)
- [ ] Stores → Add store → Development store
- [ ] Apps → Create app ("SafeSponsor") → copy Client ID + secret
- [ ] Set env vars in Vercel (+ redirect URI above in app config) → redeploy
- [ ] Visit /dashboard/integrations → connect store → verify search works

---

## Other pending items
- **Phyllo competitor research** — re-dispatched 2026-08-24 (batch `lanes-mt67q682`) but the lane stalled pending again on host calls; findings STILL missing from COMPETITIVE_ABSORPTION_STRATEGY.md
- ~~Applications inbox~~ DONE 2026-08-24 — `/dashboard/collabs` (commit `3dadfbd`)
- **Anomaly signals** feed Gemini context but aren't rendered as UI chips in dossiers
