# Funnel Nurture — MailerLite Setup & 3-Email Sequence

Status: Week 1 (funnel launch). The teaser lead capture (`/api/lead`) already
stores leads in Firestore. This doc covers the MailerLite bridge and the
nurture sequence for leads who entered their email on the landing page
("Email me the full dossier").

## 1. MailerLite Setup Runbook

1. Create a free MailerLite account at https://www.mailerlite.com (free tier
   covers 1,000 subscribers — enough for this funnel).
2. Go to **Settings → API** and create an API key.
3. Set it as `MAILERLITE_API_KEY` in the Vercel project environment variables
   (Project → Settings → Environment Variables → Production) and redeploy.
   Until it is set, `/api/lead` logs "MailerLite not configured" and keeps
   working — the bridge is fail-soft by design.
4. Verify the sender: **Account → Sender Management** — add the sender email
   used for campaigns and complete the verification email. Use the same Gmail
   account as the outreach sender for consistent reputation.
5. (Recommended) Create one group, e.g. `Teaser Leads`, so campaigns target
   only this segment. The API bridge currently adds subscribers without a
   group — leads still land in All Subscribers.
6. Sanity check after the first lead: **Subscribers** should show the new
   contact with the UTM fields (`utm_source`, `utm_medium`, `utm_campaign`,
   ...) populated when the landing URL had them.

UTM attribution: `/api/lead` stores `utm_source/medium/campaign/content/term`
on both the Firestore lead and the MailerLite subscriber when present. This is
how we measure which channel (outreach, SEO, content) drives leads.

## 2. Nurture Sequence (3 emails, ~2 weeks)

Subscribers are teaser leads: they ran a free check and asked for "the full
dossier". They have NOT paid yet. The sequence sells the $8 Single Report as
the obvious next step, then gives real value so the brand stays warm.

All emails keep the mandatory MailerLite unsubscribe footer (automatic).
No list buying, no trick subject lines. Copy below is paste-ready — replace
`{{FULLNAME}}` and `{{EMAIL}}` placeholders with MailerLite merge tags.

### Email 1 — Day 1: Deliver value + the $8 unlock

Subject: Your brand safety report for {{FULLNAME}} (from your free check)

```
Hi,

You asked for the full dossier after your free creator check on
SafeSponsor AI — here's what the free preview showed you:

• Brand Safety Score (0-100) and risk level
• Top red-flag categories if any were found

The free preview only surfaces the headline numbers. The full dossier goes
much deeper: comment toxicity sampling, transcript scan, press history,
scam risk, and competitor conflict checks — plus contract-ready safeguards
your team can paste straight into a sponsorship agreement.

Unlock the complete dossier for $8 (no subscription):
https://safe-sponsor-ai.vercel.app

One report, yours to keep, PDF-ready.

Questions? Just reply — a human reads every reply here.

— SafeSponsor AI
```

### Email 2 — Day 5: Show the problem the tool solves

Subject: What a single $8 report catches

```
Hi,

Most sponsorship teams find out about a bad creator deal the hard way:
the backlash thread, the news story, the contract they can't get out of.

A $8 SafeSponsor AI report runs the checks a careful team would do in
hours — in about a minute:

• 50 most recent comments sampled for toxicity and scam complaints
• Full transcript scan for red-flag content
• Web press + social history check
• Competitor sponsorship conflicts
• Suggested contractual safeguards and clawback clauses

If you're vetting even one creator this quarter, the report pays for
itself on the first red flag it catches.

https://safe-sponsor-ai.vercel.app

— SafeSponsor AI
```

### Email 3 — Day 12: Final nudge, honest close

Subject: Leaving the dossier here if you need it

```
Hi,

One last note — no hard sell, just the facts.

Your free check is still valid, and the $8 Single Report link below works
whenever you need it. If you're not vetting creators right now, no worries:
keep this email and come back when you are.

If you've decided this isn't for you, no hard feelings — you can
unsubscribe below and you won't hear from us again.

https://safe-sponsor-ai.vercel.app

— SafeSponsor AI
```

## 3. Scheduling in MailerLite

1. **Campaigns → Create campaign → Regular newsletter.**
2. Pick the sender verified in step 4 above.
3. Paste the copy; replace `{{FULLNAME}}` with `*|FNAME|*` and `{{EMAIL}}`
   with `*|EMAIL|*` if you want merge tags.
4. For a 2-week cadence, schedule **Email 1** immediately (or on a small
   delay after signup), then **Email 2** 4 days later, **Email 3** 7 days
   after that. Automation (**Automations**) is cleaner: trigger = "subscriber
   added to group", wait steps of 5 days, send sequence, optional exit when
   the subscriber pays (order automation). Start with the simple version.

## 4. Success Metrics

- Leads captured (Firestore `leads` count + MailerLite subscribers).
- Lead-to-paid conversion (compare MailerLite subscribers vs. Dodo checkout
  events; UTM source shows which channel converted).
- Target: 50-100 leads, 5-10% paid within 30-60 days of the funnel going live.

## 5. Compliance Notes

- MailerLite adds the unsubscribe footer automatically — keep it.
- Leads consented by entering their email on the landing page with a clear
  "we'll reach out with your full dossier" statement — do not use this list
  for anything else without re-consent.
- Respect bounces/abuse reports: MailerLite auto-suppresses; don't re-add.