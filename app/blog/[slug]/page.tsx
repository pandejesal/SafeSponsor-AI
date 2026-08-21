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
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/blog" className="text-xs text-zinc-500 hover:underline">
        ← All teardowns
      </Link>
      <h1 className="text-3xl font-black tracking-tight mt-4">{post.title}</h1>
      <p className="text-xs text-zinc-500 mt-2">
        {new Date(post.publishedAt).toLocaleDateString()} · {post.niche} · Score {post.brandSafetyScore}/100 {post.riskLevel} · Source {post.source} ·{" "}
        <a href={post.creatorUrl} className="underline" target="_blank" rel="noreferrer">
          creator URL
        </a>
      </p>
      {post.topRedFlags.length > 0 && (
        <ul className="mt-4 space-y-2">
          {post.topRedFlags.map((f, i) => (
            <li key={i} className="text-sm bg-zinc-50 border rounded-lg px-3 py-2">
              <span className="font-bold">{f.category}</span>
              {f.description ? <span className="text-zinc-500"> — {f.description}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <article className="prose prose-zinc max-w-none mt-6 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</article>
      <div className="mt-8 p-4 rounded-xl border bg-zinc-50">
        <p className="text-sm font-bold">Run your own free check</p>
        <p className="text-xs text-zinc-500 mt-1">
          <a className="underline" href="https://safe-sponsor-ai.vercel.app/?utm_source=content-engine&utm_medium=blog&utm_campaign=teardown">
            safe-sponsor-ai.vercel.app
          </a>{" "}
          — headline score + top flags free, full dossier $8
        </p>
      </div>
    </main>
  );
}
