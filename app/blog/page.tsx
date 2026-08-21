import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata = {
  title: "Teardowns — SafeSponsor AI",
  description: "Real creator brand-safety teardowns via SafeSponsor AI teaser — DTC-niche, headline scores only, honest provenance.",
};

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-black tracking-tight">Teardowns</h1>
      <p className="text-sm text-zinc-500 mt-2">
        Real scores from <code className="px-1 py-0.5 bg-zinc-100 rounded">POST /api/analyze {"{teaser:true}"}</code> — DTC-niche, live web_search with evergreen fallback (Q18.B/Q22.A), 1/day at 09:00.
      </p>
      {posts.length === 0 ? (
        <p className="text-sm text-zinc-400 mt-8">No teardowns yet — the 09:00 cron will publish the first one.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {posts.map((p) => (
            <li key={p.slug} className="border rounded-xl p-5 hover:border-zinc-300 transition">
              <Link href={`/blog/${p.slug}`} className="text-lg font-bold hover:underline">
                {p.title}
              </Link>
              <p className="text-xs text-zinc-500 mt-1">
                {new Date(p.publishedAt).toLocaleDateString()} · {p.niche} · {p.brandSafetyScore}/100 {p.riskLevel} · {p.source}
              </p>
              <p className="text-sm text-zinc-600 mt-2">{p.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
