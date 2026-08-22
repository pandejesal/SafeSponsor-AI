"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

interface CollabCard {
  id: string;
  brandName: string;
  title: string;
  description: string;
  niche: string;
  platforms: string[];
  minFollowers: number;
  compensation: { type: string; amount?: number; currency: string; details?: string };
  deliverables: string[];
  applicationDeadline: string | null;
  status: string;
  applicationCount: number;
}

const fmtFollowers = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

export default function MarketplacePage() {
  const [collabs, setCollabs] = useState<CollabCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nicheFilter, setNicheFilter] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    fetch("/api/marketplace/collabs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((d) => { if (alive) setCollabs(d.collabs || []); })
      .catch(() => { if (alive) setError("Could not load the marketplace. Please refresh."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const niches = Array.from(new Set(collabs.map((c) => c.niche)));
  const visible = nicheFilter === "all" ? collabs : collabs.filter((c) => c.niche === nicheFilter);

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 pt-28 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase border mb-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}>
              Collab Marketplace
            </p>
            <h1 className="text-4xl md:text-5xl leading-[1.05]" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>
              Brands are looking<br />for creators like you.
            </h1>
            <p className="mt-3 text-[15px]" style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}>
              Inbound collabs from verified brands. Apply in under a minute — no cold DMs.
            </p>
          </div>
          <Link href="/marketplace/new" className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-[8px] text-sm font-semibold transition-opacity hover:opacity-85" style={{ background: 'var(--ink)', color: '#F6F2EF', fontFamily: 'var(--font-sans)' }}>
            Post a Collab
          </Link>
        </div>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-[8px] border animate-pulse" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />
            ))}
          </div>
        )}
        {error && <div className="p-5 rounded-[8px] border" style={{ background: 'var(--card-bg)', borderColor: 'var(--risk, #E07A5F)', color: 'var(--ink)' }}>{error}</div>}
        {!loading && !error && visible.length === 0 && (
          <div className="p-10 rounded-[8px] border text-center" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p className="text-lg mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>No open collabs yet</p>
            <p className="text-sm" style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}>Be the first brand to post one.</p>
          </div>
        )}

        {!loading && niches.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {["all", ...niches].map((n) => (
              <button key={n} onClick={() => setNicheFilter(n)} className="px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-opacity hover:opacity-80" style={nicheFilter === n ? { background: 'var(--ink)', color: '#F6F2EF', borderColor: 'var(--ink)' } : { background: 'var(--card-bg)', color: 'var(--ink-600)', borderColor: 'var(--card-border)' }}>
                {n === "all" ? "All niches" : n}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((c) => (
            <Link key={c.id} href={`/marketplace/${c.id}`} className="block p-5 rounded-[8px] border transition-transform hover:-translate-y-0.5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wide" style={{ background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'var(--card-border)' }}>{c.niche}</span>
                <span className="text-[12px] font-semibold" style={{ color: 'var(--risk, #E07A5F)' }}>
                  {c.compensation.type === "paid" && c.compensation.amount ? `$${c.compensation.amount.toLocaleString()}` : c.compensation.type}
                </span>
              </div>
              <h2 className="text-xl leading-snug mb-1.5" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>{c.title}</h2>
              <p className="text-[13px] line-clamp-2 mb-3" style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}>{c.description}</p>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[12px]" style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}>
                <span className="font-semibold">{c.brandName}</span>
                <span>· {c.platforms.join(", ")}</span>
                <span>· ≥{fmtFollowers(c.minFollowers)} followers</span>
                <span>· {c.applicationCount} applied</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
