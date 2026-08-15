'use client';

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// N3T3 — root error boundary so React rendering errors reach Sentry (when a
// DSN is configured; no-op otherwise).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased font-sans bg-zinc-950 text-white min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
          <p className="text-sm text-zinc-400 mb-6">
            An unexpected error occurred. Your data is safe — please try again.
          </p>
          <button
            onClick={reset}
            className="py-2.5 px-6 rounded-xl font-bold text-sm bg-orange-600 hover:bg-orange-700 text-white transition-all"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}