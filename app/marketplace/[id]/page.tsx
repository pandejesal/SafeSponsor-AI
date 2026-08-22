"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";

interface CollabDetail {
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

interface AppRow {
  id: string;
  creatorHandle: string;
  platform: string;
  followers: number;
  email: string;
  pitch: string;
  links: string[];
  status: "pending" | "accepted" | "rejected";
  createdAt: string | null;
}

const inputStyle = { background: 'var(--paper)', borderColor: 'var(--card-border)', color: 'var(--ink)' } as const;

export default function CollabDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [collab, setCollab] = useState<CollabDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [apps, setApps] = useState<AppRow[] | null>(null);

  // Apply form
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [followers, setFollowers] = useState("");
  const [email, setEmail] = useState("");
  const [pitch, setPitch] = useState("");
  const [links, setLinks] = useState("");
  const [applyState, setApplyState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/marketplace/collabs/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("nf");
        return r.json();
      })
      .then((d) => { if (alive) setCollab(d.collab); })
      .catch(() => { if (alive) setNotFound(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  // Owner check: only after auth resolves and collab loads.
  useEffect(() => {
    if (!user || !collab) return;
    let alive = true;
    user.getIdToken().then((token) =>
      fetch("/api/marketplace/collabs?mine=1", { headers: { Authorization: `Bearer ${token}` } })
    ).then((r) => (r.ok ? r.json() : { collabs: [] }))
      .then((d) => {
        if (alive && (d.collabs || []).some((c: CollabDetail) => c.id === id)) setIsOwner(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user, collab, id]);

  const loadApps = useCallback(() => {
    if (!user || !isOwner) return;
    user.getIdToken().then((token) =>
      fetch(`/api/marketplace/collabs/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } })
    ).then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((d) => setApps(d.applications || []))
      .catch(() => setApps([]));
  }, [user, isOwner, id]);

  useEffect(() => { loadApps(); }, [loadApps]);

  async function decide(appId: string, status: "accepted" | "rejected") {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`/api/marketplace/applications/${appId}?collab=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    loadApps();
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setApplyState("sending");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
      const res = await fetch(`/api/marketplace/collabs/${id}/apply`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          creatorHandle: handle,
          platform,
          followers: parseInt(followers || "0", 10) || 0,
          email,
          pitch,
          links: links.split("\n").map((s) => s.trim()).filter((s) => s.startsWith("http")).slice(0, 3),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit application.");
      setApplyState("done");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
      setApplyState("idle");
    }
  }

  if (loading) return <main className="min-h-screen pt-32 px-4" style={{ background: 'var(--paper)' }}><div className="max-w-2xl mx-auto h-72 rounded-[8px] border animate-pulse" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }} /></main>;
  if (notFound || !collab) return (
    <main className="min-h-screen pt-32 px-4 text-center" style={{ background: 'var(--paper)' }}>
      <p className="text-2xl mb-4" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Collab not found</p>
      <Link href="/marketplace" className="text-sm font-semibold underline" style={{ color: 'var(--ink-600)' }}>Back to marketplace</Link>
    </main>
  );

  const expired = collab.applicationDeadline ? new Date(collab.applicationDeadline).getTime() <= Date.now() : false;
  const openToApply = collab.status === "open" && !expired;

  return (
    <main className="min-h-screen pb-20" style={{ background: 'var(--paper)' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-28">
        <div className="mb-8">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wide inline-block mb-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink-600)' }}>{collab.niche}</span>
          <h1 className="text-4xl leading-tight mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>{collab.title}</h1>
          <p className="text-[13px] mb-4" style={{ color: 'var(--ink-600)' }}>by <span className="font-semibold">{collab.brandName}</span> · {collab.platforms.join(", ")} · ≥{collab.minFollowers.toLocaleString()} followers · {collab.applicationCount} applied</p>
          <p className="text-[15px] whitespace-pre-wrap" style={{ color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>{collab.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-10">
          <div className="p-4 rounded-[8px] border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--ink-600)' }}>Compensation</p>
            <p className="text-[15px] font-semibold capitalize" style={{ color: 'var(--risk, #E07A5F)' }}>{collab.compensation.type}{collab.compensation.amount ? ` — $${collab.compensation.amount.toLocaleString()} ${collab.compensation.currency}` : ""}</p>
            {collab.compensation.details && <p className="text-[12px] mt-1" style={{ color: 'var(--ink-600)' }}>{collab.compensation.details}</p>}
          </div>
          <div className="p-4 rounded-[8px] border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--ink-600)' }}>Deliverables</p>
            <ul className="text-[12px] space-y-0.5" style={{ color: 'var(--ink)' }}>
              {collab.deliverables.map((d, i) => <li key={i}>· {d}</li>)}
            </ul>
          </div>
        </div>

        {isOwner ? (
          <section>
            <h2 className="text-2xl mb-4" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Applications ({apps?.length ?? "…"})</h2>
            {apps === null && <div className="h-24 rounded-[8px] border animate-pulse" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />}
            {apps?.length === 0 && <p className="p-6 rounded-[8px] border text-center text-sm" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink-600)' }}>No applications yet.</p>}
            <div className="space-y-3">
              {apps?.map((a) => (
                <div key={a.id} className="p-5 rounded-[8px] border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-[14px]" style={{ color: 'var(--ink)' }}>{a.creatorHandle} <span className="font-normal" style={{ color: 'var(--ink-600)' }}>· {a.platform} · {a.followers.toLocaleString()} followers</span></p>
                      <p className="text-[12px]" style={{ color: 'var(--ink-600)' }}>{a.email}</p>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full border capitalize" style={a.status === "accepted" ? { color: '#2F9E44', borderColor: '#2F9E44' } : a.status === "rejected" ? { color: 'var(--risk, #E07A5F)', borderColor: 'var(--risk, #E07A5F)' } : { color: 'var(--ink-600)', borderColor: 'var(--card-border)' }}>{a.status}</span>
                  </div>
                  <p className="text-[13px] mb-3 whitespace-pre-wrap" style={{ color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>{a.pitch}</p>
                  {a.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {a.links.map((l, i) => <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-[12px] underline break-all" style={{ color: '#49A9DE' }}>{l}</a>)}
                    </div>
                  )}
                  {a.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => decide(a.id, "accepted")} className="px-4 py-2 rounded-[8px] text-[12px] font-semibold" style={{ background: '#2F9E44', color: 'white' }}>Accept</button>
                      <button onClick={() => decide(a.id, "rejected")} className="px-4 py-2 rounded-[8px] text-[12px] font-semibold border" style={{ borderColor: 'var(--risk, #E07A5F)', color: 'var(--risk, #E07A5F)' }}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : applyState === "done" ? (
          <div className="p-8 rounded-[8px] border text-center" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p className="text-lg mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Application sent</p>
            <p className="text-sm" style={{ color: 'var(--ink-600)' }}>{collab.brandName} will review it and reach out by email.</p>
          </div>
        ) : openToApply ? (
          <form onSubmit={apply} className="space-y-4 p-6 rounded-[8px] border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h2 className="text-xl" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Apply to this collab</h2>
            <div className="grid grid-cols-2 gap-3">
              <input required minLength={2} maxLength={80} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" className="w-full px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full px-4 py-3 rounded-[8px] border text-[14px] capitalize" style={inputStyle}>
                {collab.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input required type="number" min={0} value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="Follower count" className="w-full px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
              <input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
            </div>
            <textarea required minLength={30} maxLength={1500} rows={4} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Why you're a fit — audience overlap, past brand work, ideas for this collab…" className="w-full px-4 py-3 rounded-[8px] border text-[14px] resize-y" style={inputStyle} />
            <textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} placeholder={"Links (optional, one per line, max 3)\nhttps://youtube.com/@you"} className="w-full px-4 py-3 rounded-[8px] border text-[13px] resize-y" style={inputStyle} />
            {error && <p className="text-[13px] px-4 py-3 rounded-[8px] border" style={{ color: 'var(--risk, #E07A5F)', borderColor: 'var(--risk, #E07A5F)' }}>{error}</p>}
            <button type="submit" disabled={applyState === "sending"} className="w-full py-4 rounded-[8px] text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--ink)', color: '#F6F2EF' }}>
              {applyState === "sending" ? "Sending…" : "Submit application"}
            </button>
            <p className="text-[11px] text-center" style={{ color: 'var(--ink-600)' }}>One application per collab. Brands see your email only if they accept.</p>
          </form>
        ) : (
          <div className="p-8 rounded-[8px] border text-center" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p className="text-lg mb-1" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Applications closed</p>
            <p className="text-sm" style={{ color: 'var(--ink-600)' }}>This collab is no longer accepting applications.</p>
          </div>
        )}
      </div>
    </main>
  );
}
