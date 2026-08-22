'use client';

import { motion } from 'motion/react';

export function MethodDiagram() {
  return (
    <motion.section
      aria-labelledby="method-heading"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="py-14 border-y"
      style={{ background: 'var(--paper-100)', borderColor: 'var(--card-border)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-8">
          <p className="text-[13px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ fontFamily: 'var(--font-sans)', color: 'var(--risk)' }}>
            Method, not magic
          </p>
          <h2 id="method-heading" className="text-[28px] sm:text-[36px] leading-[1.1] mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            How a dossier is built — and where it’s cited.
          </h2>
          <p className="text-[14px] leading-[1.6]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
            Every score is traced to an API, transcript, or search result. PII scrubbed, hashed, cached 90 days. Not an AI guess.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-stretch">
          {[
            { k: '01', label: 'Transcript', detail: 'youtube-transcript', src: 'Video audio → text' },
            { k: '02', label: '50 comments', detail: 'YouTube Data API v3', src: 'Top recent, PII-scrubbed' },
            { k: '03', label: 'Channel', detail: 'YouTube Data API', src: 'History + metadata' },
            { k: '04', label: 'Web search', detail: 'Grounded controversy', src: 'Cross-platform' },
            { k: '05', label: 'Synthesis', detail: 'Gemini → Groq fallback', src: 'Structured JSON' },
            { k: '06', label: 'Scrub + hash', detail: 'PII scrub + SHA-256', src: 'Anonymized' },
            { k: '07', label: 'Cache 90d', detail: 'global_audits', src: 'Hashed repeat' },
          ].map((s, i) => (
            <div key={s.k} className="relative flex flex-col">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.35, delay: i * 0.07, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 rounded-[8px] border p-4 flex flex-col gap-2"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
                  {s.k}
                </span>
                <span className="text-[14px] font-semibold leading-[1.2]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
                  {s.label}
                </span>
                <span className="text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}>
                  {s.detail}
                </span>
                <span className="text-[11px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
                  {s.src}
                </span>
              </motion.div>
              {i < 6 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ duration: 0.25, delay: i * 0.07 + 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="hidden md:block absolute top-1/2 -right-[7px] w-[14px] h-[2px] -translate-y-1/2 origin-left"
                  style={{ background: 'var(--line)' }}
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>

        <p className="text-[12px] mt-4" style={{ fontFamily: 'var(--font-sans)', color: 'var(--zinc-400)' }}>
          Sources declared in every dossier footer. Example excerpts are labeled “anonymized” — never presented as real reports.
        </p>
      </div>
    </motion.section>
  );
}
