import React from 'react';
import Link from 'next/link';
import TeaserWidget from '@/components/TeaserWidget';
import { Navbar } from '@/components/Navbar';
import { CheckCircle2, ShieldCheck, AlertTriangle, FileText } from 'lucide-react';

interface PlatformPageProps {
  platform: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  faq: { q: string; a: string }[];
  platformHint?: string;
}

// N2T2–N2T4 — static platform landing pages: SEO copy + embedded teaser
// widget. Server component shell; the teaser is the only client island.
export default function PlatformPage({ platform, eyebrow, title, subtitle, bullets, faq, platformHint }: PlatformPageProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm mb-6 bg-white dark:bg-zinc-900/90 border-orange-200 dark:border-cyan-500/30 text-orange-700 dark:text-cyan-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            {eyebrow}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-6">
            {title}
          </h1>
          <p className="text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed mb-10 font-medium text-slate-600 dark:text-zinc-400">
            {subtitle}
          </p>

          <div className="max-w-2xl mx-auto mb-4">
            <TeaserWidget platformHint={platformHint} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto mt-14 text-left">
            {bullets.map((b, i) => (
              <div key={i} className={`p-5 rounded-xl border shadow-sm ${
                i % 2 === 0
                  ? 'bg-white dark:bg-zinc-900/90 border-slate-200 dark:border-zinc-800'
                  : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800'
              }`}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-6 pb-20">
          <h2 className="text-2xl font-extrabold mb-6 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
{faq.map((f, i) => (
              <details key={i} className={`group rounded-xl border p-5 shadow-sm bg-white dark:bg-zinc-900/90 border-slate-200 dark:border-zinc-800`}>
                <summary className="flex items-start gap-3 cursor-pointer list-none font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" />
                  <span>{f.q}</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 pl-7">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-14 p-6 rounded-2xl border shadow-md bg-gradient-to-br from-slate-50 to-white dark:from-zinc-900 dark:to-zinc-950 border-slate-200 dark:border-zinc-800 text-center">
            <FileText className="w-8 h-8 mx-auto mb-3 text-orange-500" />
            <h3 className="text-xl font-extrabold mb-2">Need the full {platform} risk dossier?</h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-5 max-w-xl mx-auto">
              The free check shows the headline score. The $8 Single Report delivers the complete
              analysis: audience insights, sponsorship history, verified red flags, and contractual safeguards.
            </p>
            <Link
              href="/pricing"
              className="inline-block py-3 px-7 rounded-xl font-bold text-sm bg-orange-600 hover:bg-orange-700 text-white shadow-md hover:scale-[1.02] transition-all"
            >
              See Pricing
            </Link>
          </div>

          {/* N2T5 — internal cross-links between platform pages */}
          <nav className="mt-14 pt-8 border-t border-slate-200 dark:border-zinc-800 text-center" aria-label="Platform checks">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Check creators on other platforms</p>
            <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
              <Link href="/" className="text-orange-600 dark:text-cyan-400 hover:underline">Home</Link>
              {[
                ['YouTube', '/brand-safety/youtube'],
                ['TikTok', '/brand-safety/tiktok'],
                ['Instagram', '/brand-safety/instagram'],
                ['Twitch', '/brand-safety/twitch'],
              ]
                .filter(([name]) => name !== platform)
                .map(([name, href]) => (
                  <Link key={href} href={href} className="text-orange-600 dark:text-cyan-400 hover:underline">
                    {name}
                  </Link>
                ))}
            </div>
          </nav>
        </section>
      </main>
    </div>
  );
}