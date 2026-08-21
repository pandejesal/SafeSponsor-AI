import fs from "fs";
import path from "path";

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  niche: string;
  creatorUrl: string;
  brandSafetyScore: number;
  riskLevel: string;
  topRedFlags: { category: string; description: string }[];
  publishedAt: string;
  source: "safesponsor_teaser" | "evergreen_fallback";
  content: string; // markdown body (after frontmatter)
};

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) return { data: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: raw };
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const data: Record<string, string> = {};
  for (const line of fm.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    data[k] = v;
  }
  return { data, body };
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  const posts: BlogPost[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const slug = data.slug || file.replace(/\.md$/, "");
    posts.push({
      slug,
      title: data.title || slug,
      excerpt: data.excerpt || "",
      niche: data.niche || "general",
      creatorUrl: data.creatorUrl || "",
      brandSafetyScore: Number(data.brandSafetyScore || 0),
      riskLevel: data.riskLevel || "Unknown",
      topRedFlags: data.topRedFlags ? JSON.parse(data.topRedFlags) : [],
      publishedAt: data.publishedAt || new Date().toISOString(),
      source: (data.source as BlogPost["source"]) || "safesponsor_teaser",
      content: body,
    });
  }
  return posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((p) => p.slug === slug) || null;
}
