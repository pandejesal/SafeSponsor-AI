"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";

interface MyCollab {
  id: string;
  title: string;
  status: string;
  applicationCount: number;
  applicationDeadline: string | null;
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
}

export default function DashboardCollabsPage() {
  const { user, loading: authLoading } = useAuth();
  const [collabs, setCollabs] = useState<MyCollab[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [appsById, setAppsById] = useState<Record<string, AppRow[]>>({});

  useEffect(() => {
    if (!user) return;
    let alive = true;
    user.getIdToken().then((token) =>
      fetch("/api/marketplace/collabs?mine=1", { headers: { Authorization: `Bearer ${token}` } })
    ).then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((d) => { if (alive) setCollabs(d.collabs || []); })
      .catch(() => { if (alive) setError("Could not load your collabs."); });
    return () => { alive = false; };
  }, [user]);

  const loadApps = useCallback((collabId: string) => {
    if (!user) return;
    user.getIdToken().then((token) =>
      fetch(`/api/marketplace/collabs/${collabId}/applications`, { headers: { Authorization: `Bearer ${token}` } })
    ).then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((d) => setAppsById((prev) => ({ ...prev, [collabId]: d.applications || [] })))
      .catch(() => setAppsById((prev) => ({ ...prev, [collabId]: [] })));
  }, [user]);

  async function decide(collabId: string, appId: string, status: "accepted" | "rejected") {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`/api/marketplace/applications/${appId}?collab=${collabId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    loadApps(collabId);
  }

  return (
    <main className="min-h-screen pb-20" style={{ background: 'var(--paper)' }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-28">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl mb-1" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>My Collabs</h1>
            <p className="text-[14px]" style={{ color: 'var(--ink-600)' }}>Your listings and incoming creator applications.</p>
          </div>
          <Link href="/marketplace/new" className="shrink-0 px-4 py-2.5 rounded-[8px] text-[13px] font-semibold" style={{ background: 'var(--ink)', color: '#F6F2EF' }}>+ New</Link>
        </div>

        {authLoading || collabs === null ? (
          <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 rounded-[8px] border animate-pulse" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />)}</div>
        ) : error ? (
          <p className="p-6 rounded-[8px] border text-sm" style={{ background: 'var(--card-bg)', borderColor: 'var(--risk, #E07A5F)', color: 'var(--ink)' }}>{error}</p>
        ) : collabs.length === 0 ? (
          <div className="p-10 rounded-[8px] border text-center" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p className="text-lg mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>No collabs yet</p>
            <Link href="/marketplace/new" className="text-sm font-semibold underline" style={{ color: 'var(--ink-600)' }}>Post your first one</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {collabs.map((c) => {
              const open = openId === c.id;
              const apps = appsById[c.id];
              return (
                <div key={c.id} className="rounded-[8px] border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                  <button onClick={() => { setOpenId(open ? null : c.id); if (!open && !apps) loadApps(c.id); }} className="w-full flex items-center justify-between px-5 py-4 text-left">
                    <div>
                      <p className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{c.title}</p>
                      <p className="text-[12px]" style={{ color: 'var(--ink-600)' }}>
                        {c.status === "open" ? "Open" : "Closed"} · {c.applicationCount} applicant{c.applicationCount === 1 ? "" : "s"}
                        {c.status === "open" && c.applicationDeadline ? ` · closes ${new Date(c.applicationDeadline).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <span className="text-[12px] font-semibold shrink-0 ml-3" style={{ color: 'var(--ink-600)' }}>{open ? "Hide ▲" : `Review ▼`}</span>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 space-y-3">
                      {(apps === undefined) && <p className="text-[13px]" style={{ color: 'var(--ink-600)' }}>Loading…</p>}
                      {apps?.length === 0 && <p className="text-[13px]" style={{ color: 'var(--ink-600)' }}>No applications yet.</p>}
                      {apps?.map((a) => (
                        <div key={a.id} className="p-4 rounded-[8px] border" style={{ background: 'var(--paper)', borderColor: 'var(--card-border)' }}>
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{a.creatorHandle} <span className="font-normal text-[12px]" style={{ color: 'var(--ink-600)' }}>· {a.platform} · {a.followers.toLocaleString()}</span></p>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize" style={a.status === "accepted" ? { color: '#2F9E44', borderColor: '#2F9E44' } : a.status === "rejected" ? { color: 'var(--risk, #E07A5F)', borderColor: 'var(--risk, #E07A5F)' } : { color: 'var(--ink-600)', borderColor: 'var(--card-border)' }}>{a.status}</span>
                          </div>
                          <p className="text-[12px] mb-2" style={{ color: 'var(--ink-600)' }}>{a.email}</p>
                          <p className="text-[13px] whitespace-pre-wrap mb-2" style={{ color: 'var(--ink)' }}>{a.pitch}</p>
                          {a.links.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">{a.links.map((l, i) => <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-[12px] underline break-all" style={{ color: '#49A9DE' }}>{l}</a>)}</div>
                          )}
                          {a.status === "pending" && (
                            <div className="flex gap-2">
                              <button onClick={() => decide(c.id, a.id, "accepted")} className="px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold" style={{ background: '#2F9E44', color: 'white' }}>Accept</button>
                              <button onClick={() => decide(c.id, a.id, "rejected")} className="px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold border" style={{ borderColor: 'var(--risk, #E07A5F)', color: 'var(--risk, #E07A5F)' }}>Reject</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
