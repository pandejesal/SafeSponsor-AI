import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

// N3T3 — request-level error capture (Next.js 15 app router). Sentry no-ops
// internally when no DSN is configured, so this hook is safe unconditionally.
export function onRequestError(error: unknown, request: unknown, context: unknown) {
  Sentry.captureRequestError(error, request as Parameters<typeof Sentry.captureRequestError>[1], context as Parameters<typeof Sentry.captureRequestError>[2]);
}