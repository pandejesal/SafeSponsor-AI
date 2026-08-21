'use client';

import { useState } from "react";
import { Copy, Check, Gift } from "lucide-react";

export function ReferralCard({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  const short = uid.slice(0, 8);
  const link = `https://safe-sponsor-ai.vercel.app/?utm_source=referral&utm_medium=dashboard&utm_campaign=${short}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("input");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-5 rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <Gift className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-bold">Refer a brand — get $8 credit</h3>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        They get 10% off their first report. You get $8 credit when they buy.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={link}
          className="flex-1 px-3 py-2 rounded-lg text-xs border bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 border-slate-200 text-slate-900 truncate"
        />
        <button
          type="button"
          onClick={copy}
          className="px-3 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
