"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import { PLATFORMS, NICHES, COMPENSATION_TYPES, type Platform } from "@/lib/marketplace";

const inputStyle = { background: 'var(--paper)', borderColor: 'var(--card-border)', color: 'var(--ink)' } as const;
const labelCls = "block text-[12px] font-semibold uppercase tracking-wide mb-1.5";

export default function NewCollabPage() {
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [niche, setNiche] = useState<string>("lifestyle");
  const [platforms, setPlatforms] = useState<Platform[]>(["youtube"]);
  const [minFollowers, setMinFollowers] = useState("1000");
  const [compType, setCompType] = useState<string>("paid");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [deliverables, setDeliverables] = useState("1 dedicated YouTube video\n2 Instagram stories");
  const [deadlineDays, setDeadlineDays] = useState("14");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/marketplace/collabs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          description,
          niche,
          platforms,
          minFollowers: parseInt(minFollowers || "0", 10) || 0,
          compensation: {
            type: compType,
            ...(amount ? { amount: parseFloat(amount) || 0 } : {}),
            currency: "USD",
            ...(details ? { details } : {}),
          },
          deliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
          deadlineDays: parseInt(deadlineDays || "14", 10) || 14,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create collab.");
      setCreatedId(data.id);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-20">
        <h1 className="text-4xl mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Post a Collab</h1>
        <p className="text-[15px] mb-8" style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}>
          Describe the partnership — creators apply directly to you.
        </p>

        {authLoading ? (
          <div className="h-64 rounded-[8px] border animate-pulse" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />
        ) : !user ? (
          <div className="p-8 rounded-[8px] border text-center" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p className="text-lg mb-3" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Sign in to post a collab</p>
            <Link href="/dashboard" className="inline-flex px-5 py-3 rounded-[8px] text-sm font-semibold" style={{ background: 'var(--ink)', color: '#F6F2EF' }}>Go to Dashboard</Link>
          </div>
        ) : createdId ? (
          <div className="p-8 rounded-[8px] border text-center" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p className="text-lg mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Collab is live</p>
            <p className="text-sm mb-6" style={{ color: 'var(--ink-600)' }}>Creators can now find and apply to it.</p>
            <div className="flex gap-3 justify-center">
              <Link href={`/marketplace/${createdId}`} className="px-5 py-3 rounded-[8px] text-sm font-semibold" style={{ background: 'var(--ink)', color: '#F6F2EF' }}>View listing</Link>
              <Link href="/marketplace" className="px-5 py-3 rounded-[8px] text-sm font-semibold border" style={{ borderColor: 'var(--card-border)', color: 'var(--ink)' }}>Marketplace</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="p-6 rounded-[8px] border space-y-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div>
                <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Title</label>
                <input required minLength={5} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer launch — skincare creators wanted"
                  className="w-full px-4 py-3 rounded-[8px] border text-[14px] outline-none focus:ring-2 focus:ring-[#49A9DE]/40" style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Description</label>
                <textarea required minLength={20} maxLength={2000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you launching, who's your audience, what does success look like?"
                  className="w-full px-4 py-3 rounded-[8px] border text-[14px] outline-none focus:ring-2 focus:ring-[#49A9DE]/40 resize-y" style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Niche</label>
                  <select value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle}>
                    {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Min followers</label>
                  <input type="number" min={0} value={minFollowers} onChange={(e) => setMinFollowers(e.target.value)} className="w-full px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button key={p} type="button" onClick={() => togglePlatform(p)} className="px-3 py-1.5 rounded-full text-[12px] font-semibold border capitalize"
                      style={platforms.includes(p) ? { background: 'var(--ink)', color: '#F6F2EF', borderColor: 'var(--ink)' } : { background: 'var(--paper)', color: 'var(--ink-600)', borderColor: 'var(--card-border)' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-[8px] border space-y-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Compensation</label>
                  <select value={compType} onChange={(e) => setCompType(e.target.value)} className="w-full px-4 py-3 rounded-[8px] border text-[14px] capitalize" style={inputStyle}>
                    {COMPENSATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {(compType === "paid" || compType === "mixed") && (
                  <div>
                    <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Amount (USD)</label>
                    <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" className="w-full px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Compensation details (optional)</label>
                <input maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Free product + affiliate at 15%"
                  className="w-full px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Deliverables (one per line)</label>
                <textarea rows={3} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className="w-full px-4 py-3 rounded-[8px] border text-[14px] resize-y" style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--ink-600)' }}>Accept applications for (days)</label>
                <input type="number" min={1} max={90} value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} className="w-full px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
              </div>
            </div>

            {error && <p className="text-[13px] px-4 py-3 rounded-[8px] border" style={{ color: 'var(--risk, #E07A5F)', borderColor: 'var(--risk, #E07A5F)' }}>{error}</p>}
            <button type="submit" disabled={submitting} className="w-full py-4 rounded-[8px] text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-85" style={{ background: 'var(--ink)', color: '#F6F2EF' }}>
              {submitting ? "Publishing…" : "Publish collab"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
