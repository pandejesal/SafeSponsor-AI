import * as Sentry from "@sentry/nextjs";

// N3T3 — server-side error capture. NO-OP when SENTRY_DSN is unset (the
// default): the app must never depend on Sentry being configured. Only when
// the env var is present do we initialize and start shipping errors.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  });
}