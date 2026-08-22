import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return { title: `${post.title} — SafeSponsor AI`, description: post.excerpt };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  return (
    <main className="max-w-3xl mx-auto px-6 py-12" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <Link href="/blog" className="text-[12px] hover:underline" style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}>
        ← All teardowns
      </Link>
      <h1 className="text-[28px] leading-[1.1] mt-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{post.title}</h1>
      <p className="text-[12px] mt-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
        {new Date(post.publishedAt).toLocaleDateString()} · {post.niche} · Score {post.brandSafetyScore}/100 {post.riskLevel} · Source {post.source} ·{" "}
        <a href={post.creatorUrl} className="underline" style={{ color: 'var(--line)' }} target="_blank" rel="noreferrer">
          creator URL
        </a>
      </p>
      {post.topRedFlags.length > 0 && (
        <ul className="mt-4 space-y-2">
          {post.topRedFlags.map((f, i) => (
            <li key={i} className="text-[13px] bg-white border rounded-[8px] px-3 py-2" style={{ borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
              <span className="font-semibold">{f.category}</span>
              {f.description ? <span style={{ color: 'var(--ink-600)' }}> — {f.description}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <article className="prose max-w-none mt-6 whitespace-pre-wrap text-[14px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{post.content}</article>
      <div className="mt-8 p-4 rounded-[8px] border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
        <p className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Run your own free check</p>
        <p className="text-[12px] mt-1" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
          <a className="underline" style={{ color: 'var(--line)' }} href="https://safe-sponsor-ai.vercel.app/?utm_source=content-engine&utm_medium=blog&utm_campaign=teardown">
            safe-sponsor-ai.vercel.app
          </a>{" "}
          — headline score + top flags free, full dossier $8
        </p>
      </div>
    </main>
  );
}
