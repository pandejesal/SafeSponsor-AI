'use client';

import { useEffect, useState } from 'react';

// S-002: honest disclosure of the payment mode. The terms page promises
// test-mode processing during preview; this badge surfaces the LIVE mode on
// the buy surfaces the moment DODO_PAYMENTS_MODE flips, so users are never
// charged real money without being told. /api/health is public and leaks no
// secrets (mode is not sensitive).
export function TestModeBadge() {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: any) => {
        if (active && typeof d?.paymentsMode === 'string') setMode(d.paymentsMode);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (mode === 'live') return null;
  if (!mode) return null;

  return (
    <p className="text-xs font-semibold mt-2 text-amber-500">
      Test mode — payments are simulated, no real charges are made.
    </p>
  );
}