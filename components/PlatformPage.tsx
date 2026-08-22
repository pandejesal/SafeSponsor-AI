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

export default function PlatformPage({ platform, eyebrow, title, subtitle, bullets, faq, platformHint }: PlatformPageProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <Navbar />
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
          <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase border mb-6" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', color: 'var(--ink-600)', fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-sm)' }}>
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--ink-600)' }} />
            {eyebrow}
          </p>
          <h1 className="text-[36px] sm:text-[48px] leading-[1.05] mb-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            {title}
          </h1>
          <p className="text-[16px] leading-[1.6] max-w-3xl mx-auto mb-8" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
            {subtitle}
          </p>

          <div className="max-w-2xl mx-auto mb-4">
            <TeaserWidget platformHint={platformHint} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto mt-10 text-left">
            {bullets.map((b, i) => (
              <div key={i} className="p-5 rounded-[8px] border" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--score-good)' }} />
                  <p className="text-[13px] leading-[1.5] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>{b}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-6 pb-16">
          <h2 className="text-[24px] leading-[1.1] mb-6 text-center" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--ink)' }}>
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {faq.map((f, i) => (
              <details key={i} className="group rounded-[8px] border p-5" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
                <summary className="flex items-start gap-3 cursor-pointer list-none font-semibold text-[14px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--risk)' }} />
                  <span>{f.q}</span>
                </summary>
                <p className="mt-3 text-[13px] leading-[1.6] pl-7" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>{f.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-10 p-6 rounded-[16px] border text-center" style={{ background: 'white', borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)' }}>
            <FileText className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--ink-600)' }} />
            <h3 className="text-[18px] font-semibold mb-2" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>Need the full {platform} dossier?</h3>
            <p className="text-[13px] leading-[1.5] mb-5 max-w-xl mx-auto" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
              Free check shows headline score. $8 Single Report delivers full analysis: audience, sponsorship history, red flags, and safeguards — cited.
            </p>
            <Link
              href="/#pricing"
              className="inline-block h-11 px-6 rounded-[8px] text-[14px] font-semibold inline-flex items-center justify-center"
              style={{ background: 'var(--risk)', color: 'white', fontFamily: 'var(--font-sans)' }}
            >
              See pricing
            </Link>
          </div>

          <nav className="mt-10 pt-6 text-center" style={{ borderTop: '1px solid rgba(15,27,46,0.08)' }} aria-label="Platform checks">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>Check creators on other platforms</p>
            <div className="flex flex-wrap justify-center gap-3 text-[13px] font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
              <Link href="/" className="hover:underline" style={{ color: 'var(--line)' }}>Home</Link>
              {[
                ['YouTube', '/brand-safety/youtube'],
                ['TikTok', '/brand-safety/tiktok'],
                ['Instagram', '/brand-safety/instagram'],
                ['Twitch', '/brand-safety/twitch'],
              ]
                .filter(([name]) => name !== platform)
                .map(([name, href]) => (
                  <Link key={href} href={href} className="hover:underline" style={{ color: 'var(--line)' }}>
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
