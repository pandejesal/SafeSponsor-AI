"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";

const inputStyle = { background: 'var(--paper)', borderColor: 'var(--card-border)', color: 'var(--ink)' } as const;

interface CustomerRow {
  id: number;
  email: string | null;
  name: string;
  ordersCount: number;
  totalSpent: number;
}

export default function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [shop, setShop] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function connect() {
    if (!user) return;
    setStatus(null);
    setConnecting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/shopify/connect?shop=${encodeURIComponent(shop.trim().toLowerCase())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.installUrl) throw new Error(data.error || "Could not start the connection.");
      window.location.href = data.installUrl; // Shopify consent screen
    } catch (err: any) {
      setStatus(err?.message || "Something went wrong.");
      setConnecting(false);
    }
  }

  async function search() {
    if (!user) return;
    setSearchError(null);
    setSearching(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/shopify/customers/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setCustomers(data.customers || []);
    } catch (err: any) {
      setSearchError(err?.message || "Search failed.");
      setCustomers(null);
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-20">
        <h1 className="text-4xl mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Integrations</h1>
        <p className="text-[15px] mb-8" style={{ color: 'var(--ink-600)' }}>
          Connect your store to find creators who are already your customers.
        </p>

        {authLoading ? (
          <div className="h-40 rounded-[8px] border animate-pulse" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />
        ) : !user ? (
          <p className="p-6 rounded-[8px] border text-sm" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--ink-600)' }}>Sign in on the dashboard first.</p>
        ) : (
          <>
            <section className="p-6 rounded-[8px] border mb-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="text-xl mb-1" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Shopify</h2>
              <p className="text-[13px] mb-4" style={{ color: 'var(--ink-600)' }}>
                Enter your store's admin domain (e.g. <code>my-store.myshopify.com</code>) and you'll be redirected to Shopify to approve access.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="your-store.myshopify.com"
                  className="flex-1 px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
                <button onClick={connect} disabled={connecting || shop.length < 5} className="px-5 py-3 rounded-[8px] text-[13px] font-semibold disabled:opacity-50" style={{ background: 'var(--ink)', color: '#F6F2EF' }}>
                  {connecting ? "Redirecting…" : "Connect"}
                </button>
              </div>
              {status && <p className="text-[12px] mt-3" style={{ color: 'var(--risk, #E07A5F)' }}>{status}</p>}
            </section>

            <section className="p-6 rounded-[8px] border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="text-xl mb-1" style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Find creators among your customers</h2>
              <p className="text-[13px] mb-4" style={{ color: 'var(--ink-600)' }}>
                Search customers by name or email — then audit any match with SafeSponsor before gifting.
              </p>
              <div className="flex gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="jane@ / Jane Doe"
                  className="flex-1 px-4 py-3 rounded-[8px] border text-[14px]" style={inputStyle} />
                <button onClick={search} disabled={searching || query.trim().length < 2} className="px-5 py-3 rounded-[8px] text-[13px] font-semibold disabled:opacity-50" style={{ background: 'var(--ink)', color: '#F6F2EF' }}>
                  {searching ? "…" : "Search"}
                </button>
              </div>
              {searchError && <p className="text-[12px] mt-3" style={{ color: 'var(--risk, #E07A5F)' }}>{searchError}</p>}
              {customers !== null && (
                <div className="mt-4 space-y-2">
                  {customers.length === 0 && <p className="text-[13px]" style={{ color: 'var(--ink-600)' }}>No customers matched.</p>}
                  {customers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-[8px] border" style={{ background: 'var(--paper)', borderColor: 'var(--card-border)' }}>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{c.name}</p>
                        <p className="text-[12px]" style={{ color: 'var(--ink-600)' }}>{c.email || "(no email)"}</p>
                      </div>
                      <p className="text-[12px]" style={{ color: 'var(--ink-600)' }}>{c.ordersCount} orders · ${c.totalSpent.toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
