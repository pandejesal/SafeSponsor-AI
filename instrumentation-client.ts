import * as Sentry from "@sentry/nextjs";

// N3T3 — client-side error capture. NO-OP when NEXT_PUBLIC_SENTRY_DSN is
// unset (the default): initialization only happens when the DSN is present.
// Next.js 16 (Turbopack) requires this in instrumentation-client.ts; the old
// sentry.client.config.ts convention is no longer loaded.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",
  });
}