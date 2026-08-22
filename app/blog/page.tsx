import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata = {
  title: "Teardowns — SafeSponsor AI",
  description: "Real creator brand-safety teardowns via SafeSponsor AI teaser — DTC-niche, headline scores only, honest provenance.",
};

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <main className="max-w-3xl mx-auto px-6 py-12" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <h1 className="text-[32px] leading-[1.1]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Teardowns</h1>
      <p className="text-[13px] mt-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
        Real scores from <code className="px-1 py-0.5 rounded" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>POST /api/analyze {"{teaser:true}"}</code> — cited excerpts, 1/day at 09:00.
      </p>
      {posts.length === 0 ? (
        <p className="text-[13px] mt-8" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>No teardowns yet — the 09:00 cron will publish the first one.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {posts.map((p) => (
            <li key={p.slug} className="border rounded-[8px] p-5 hover:border-[var(--card-border)] transition" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
              <Link href={`/blog/${p.slug}`} className="text-[18px] font-semibold hover:underline" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                {p.title}
              </Link>
              <p className="text-[12px] mt-1" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
                {new Date(p.publishedAt).toLocaleDateString()} · {p.niche} · {p.brandSafetyScore}/100 {p.riskLevel} · {p.source}
              </p>
              <p className="text-[14px] leading-[1.5] mt-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>{p.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
