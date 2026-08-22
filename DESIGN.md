# SafeSponsor AI — DESIGN.md
## Ink Auditor Design System (post-grill rebuild)

**Generated:** 2026-08-22 — Shared understanding locked (Q1-Q22). Funnel-first trust rebuild.
**Stack:** Next 16 + Tailwind 4 + next/font/google + lucide-react + motion. No Webflow runtime.
**Philosophy:** Calm Auditor + Risk Radar. Editorial trust, not AI wrapper. Every pixel answers "would an agency risk a client on this?"

---

### 1. Visual Theme & Atmosphere

**One-line pitch:** *A forensic audit report that happens to be a marketing site.*
**Atmosphere keywords:** ink, paper, forensic, editorial, restrained, evidence-first, risk-aware
**Narrative arc:**
- Hero = risk radar (hook: "catch the flag before your client does") — urgent but not hype
- Middle = calm auditor (evidence tables, sourced metrics, hashed case) — dense, tabular, footnoted
- Close = confident operator (pricing as procurement table, not gimmick)

**Fixes 8 AI tells directly:**
- #1 palette → Ink Auditor (ink/paper/amber/blue) replaces zinc-950/cyan+orange duet
- #2 type → serif headlines + Inter UI replaces Space Grotesk everywhere
- #3 icons → UGC masonry + dossier screenshots replace lucide wallpaper (lucide only where functional)
- #4 card lift → 8px audit cards + 16-20px marketing cards, no universal hover:-translate-y-1
- #5 fake blur → real anonymized excerpt (thumbnail + 2-3 red flags) labeled "Example: anonymized"
- #6 buzzwords → rewrite: "Evidence-backed sponsor checks. PII-scrubbed. 90-day cache." No 360°/Bulletproof
- #7 synthetic metrics → every metric source-linked ("50 comments via YouTube Data API v3")
- #8 anon footer → method diagram + hashed case + procurement-grade pricing (team stays anon per Q15=C, compensated via 7+8)

**Interaction tier: L2 (Fluent Interaction)**
- Scroll reveal stagger, nav state on scroll, dossier count-up, citation footnotes. No L3 pin/hero 3D (Q17=B, restrained editorial motion). L1 fallback via `prefers-reduced-motion`.

---

### 2. Color Palette & Roles

**CSS variables — Ink Auditor (light is default; dark inverts ink/paper)**

```css
:root {
  /* Ink — calm auditor base */
  --ink: #0F1B2E;        /* rgb 15 27 46 — primary text, hero bg, nav */
  --ink-900: #16243E;
  --ink-800: #1E3446;
  --ink-700: #2A4861;
  --ink-600: #3B5F7A;
  /* Paper — restrained light */
  --paper: #F6F2EF;      /* rgb 246 242 239 — page bg */
  --paper-100: #EDE9E3;
  --paper-200: #E6E1D9;
  --paper-300: #D9D2C5;
  /* Risk — single accent for scores/risk (replaces cyan+orange duet) */
  --risk: #E07A5F;       /* rgb 224 122 95 — amber/clay */
  --risk-600: #C96A52;
  --risk-300: #F0A99A;
  --risk-50: #FDF0EC;
  /* Line — links/citations only */
  --line: #49A9DE;       /* rgb 73 169 222 — CreatorIQ blue lineage */
  --line-600: #2E8BC1;
  /* Neutrals — for borders/text secondary */
  --zinc-950: #0F1B2E;   /* alias ink */
  --zinc-900: #1A2A44;
  --zinc-800: #2A3A52;
  --zinc-700: #3F4E66;
  --zinc-500: #64748B;
  --zinc-400: #94A3B8;
  --slate-50: #F8FAFC;
  --slate-200: #E2E8F0;
  --slate-300: #CBD5E1;
  /* Semantic — scores */
  --score-good: #059669;   /* emerald 600 — >=80 */
  --score-warn: #D97706;   /* amber 600 — 60-79 */
  --score-risk: #DC2626;   /* red 600 — <60 */
  --score-good-bg: #ECFDF5;
  --score-warn-bg: #FFFBEB;
  --score-risk-bg: #FEF2F2;
  /* RGB helpers for rgba() */
  --ink-rgb: 15 27 46;
  --paper-rgb: 246 242 239;
  --risk-rgb: 224 122 95;
  --line-rgb: 73 169 222;
}
.dark {
  --paper: #0F1B2E;
  --paper-100: #16243E;
  --paper-200: #1E3446;
  --ink: #F6F2EF;
  --ink-600: #CBD5E1;
}
```

**Roles:**
- `ink` = hero/nav background (light: paper bg, dark: ink bg), primary text (inverted in dark)
- `paper` = page background, card background (marketing = paper, audit = #FFF)
- `risk` = *only* for risk scores, "High Risk" badges, pricing highlight border, CTA accent (never for general decoration)
- `line` = links, citation underlines, focused rings, method diagram lines (never for CTA)
- `zinc/slate` = borders (`#E2E8F0` / `rgba(15,27,46,0.08)`), secondary text, dividers
- Score chips use semantic `score-*` (text + bg) with 1px border in same hue

**Do not use:** cyan-400/500 (#06b6d4), orange-600 (#ea580c) gradients, emerald/amber/rose raw Tailwind without semantic mapping, pure black #000, pure white #fff for large surfaces (use paper/ink).

---

### 3. Typography Rules

**Google Fonts — next/font/google (self-hosted, display=swap)**

```ts
import { Instrument_Serif, Inter } from 'next/font/google'
const display = Instrument_Serif({ subsets:['latin'], weight:'400', variable:'--font-display', display:'swap' })
const sans = Inter({ subsets:['latin'], variable:'--font-sans', display:'swap' })
// Fallback stacks
// --font-display: Instrument Serif, Perfectly Nineties, Georgia, serif
// --font-sans: Inter, Geist, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
```

**Prohibited:** Space Grotesk everywhere, font-black on headlines, all-caps eyebrow at 10px tracked 0.2em without serif.

**Scale (marketing headlines = serif display, UI/dossier = Inter):**

| Token | Size / LH / Weight | Usage |
|---|---|---|
| `display-2xl` | `72px / 1.05 / 400` display | Hero H1 (serif, max 2 lines), `letter-spacing: -0.03em` |
| `display-xl` | `48px / 1.1 / 400` display | Section H2 (serif), ` -0.02em` |
| `display-lg` | `32px / 1.2 / 400` display | Card titles (serif) |
| `heading-md` | `20px / 1.4 / 600` sans | Dossier section headers (Inter 600) |
| `body-lg` | `18px / 1.6 / 400` sans | Hero sub, lead |
| `body` | `16px / 1.6 / 400` sans | Body, pricing features |
| `body-sm` | `14px / 1.5 / 400` sans | Captions, citations, footnotes |
| `label` | `13px / 1.3 / 600` sans `uppercase 0.08em` | Eyebrow, kicker (Inter 600, not 10px) |
| `mono` | `13px / 1.5 / 500` mono | Hashed IDs, citations, method tags |

**Rules:**
- H1-H3 = `var(--font-display)` serif. H4-H6, body, UI, tables = `var(--font-sans)`.
- Dossier scores: `48px / 700` sans tabular-nums.
- Eyebrow = 13px uppercase tracked 0.08em, not 10px.
- Line length 45-75ch; dossier tables use `font-variant-numeric: tabular-nums`.

---

### 4. Component Stylings

**All colors via CSS vars. Zero hard-coded hex in components.**

#### Button — Primary (Risk) — for "Run check" / "Get Started"
```css
.btn-primary {
  background: var(--risk); color: white; border: 1px solid var(--risk);
  border-radius: 8px; padding: 12px 20px; font: 14px/1 Inter 600;
  box-shadow: 0 1px 2px rgba(15,27,46,0.08);
  transition: background 150ms, transform 150ms, box-shadow 150ms;
}
.btn-primary:hover { background: var(--risk-600); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(224,122,95,0.25); }
.btn-primary:active { transform: translateY(0); background: var(--risk-600); }
.btn-primary:focus-visible { outline: 2px solid var(--line); outline-offset: 2px; }
.btn-primary:disabled { opacity: 0.5; pointer-events: none; }
```

#### Button — Secondary (Ink) — for "View methodology"
```css
.btn-secondary {
  background: transparent; color: var(--ink); border: 1px solid rgba(var(--ink-rgb)/0.15);
  border-radius: 8px; padding: 12px 20px; font: 14px/600 Inter;
}
.btn-secondary:hover { background: rgba(var(--ink-rgb)/0.04); border-color: rgba(var(--ink-rgb)/0.2); }
.btn-secondary:active { background: rgba(var(--ink-rgb)/0.06); }
.btn-secondary:focus-visible { outline: 2px solid var(--line); outline-offset: 2px; }
```

#### Button — Ghost — for nav, table actions
```css
.btn-ghost { background: transparent; color: var(--ink-600); border: 1px solid transparent; border-radius: 8px; padding: 8px 12px; font: 14px/500 Inter; }
.btn-ghost:hover { background: rgba(var(--ink-rgb)/0.06); color: var(--ink); }
```

#### Card — Marketing (landing, bento)
```css
.card-marketing {
  background: var(--paper); border: 1px solid rgba(var(--ink-rgb)/0.08);
  border-radius: 16px; padding: 28px; 
  box-shadow: 0 1px 2px rgba(15,27,46,0.06), 0 4px 16px rgba(15,27,46,0.04);
  transition: transform 180ms cubic-bezier(0.4,0,0.2,1), box-shadow 180ms;
}
.card-marketing:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,27,46,0.08); }
```

#### Card — Audit (dossier, dashboard)
```css
.card-audit {
  background: #FFFFFF; border: 1px solid var(--slate-200);
  border-radius: 8px; padding: 20px 22px;
  box-shadow: 0 1px 2px rgba(15,27,46,0.04);
}
.card-audit + .card-audit { margin-top: 12px; } /* dense stack, not bento gap */
```

#### Navbar
```css
.navbar {
  height: 72px; backdrop-filter: blur(12px); /* ≤14px */
  background: rgba(var(--paper-rgb)/0.85); border-bottom: 1px solid rgba(var(--ink-rgb)/0.08);
}
.navbar a { font: 14px/500 Inter; color: var(--ink-600); }
.navbar a:hover { color: var(--ink); }
.navbar a:focus-visible { outline: 2px solid var(--line); outline-offset: 2px; }
```

#### Score Chip
```css
.chip { border-radius: 9999px; padding: 4px 10px; font: 13px/600 Inter; border: 1px solid; }
.chip-good { background: var(--score-good-bg); color: var(--score-good); border-color: rgba(5,150,105,0.2); }
.chip-warn { background: var(--score-warn-bg); color: var(--score-warn); border-color: rgba(217,119,6,0.2); }
.chip-risk { background: var(--score-risk-bg); color: var(--score-risk); border-color: rgba(220,38,38,0.2); }
```

#### Input
```css
.input {
  background: #FFF; border: 1px solid var(--slate-300); border-radius: 8px;
  padding: 12px 14px; font: 16px/1.4 Inter; color: var(--ink);
}
.input:focus { border-color: var(--line); box-shadow: 0 0 0 3px rgba(var(--line-rgb)/0.15); outline: none; }
.input:disabled { background: var(--paper-100); color: var(--zinc-400); }
```

---

### 5. Layout Principles

**Containers:** `max-w-7xl (1280px)` marketing, `max-w-[1150px]` dossier/audit (per CreatorIQ lineage), `max-w-3xl` prose/legal. Padding `2rem` desktop, `1rem` mobile. Centered with `margin: 0 auto`.

**Grid:**
- Hero: 12-col, content 7 + UGC masonry 5 (desktop), stack mobile
- Bento: 12-col, patterns `8+4 / 4+8 / 6+6` — never uniform 3-col or 4-col equal cards
- Dossier: single column dense stack (card-audit), 2-col only for score + verdict top
- Pricing: 4-col desktop → 2-col tablet → 1-col mobile (procurement table, not cards-only)

**Spacing scale (4pt):** `4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 80, 96, 128`. Section padding `80px` desktop / `48px` mobile. Card gap `16px` marketing, `12px` audit.

**Density rule:** marketing sections breathable (80px), dossier sections dense (12px between audit cards, 20px padding).

---

### 6. Depth & Elevation

**Shadow scale — restrained, no shadow-2xl:**
- `--shadow-sm: 0 1px 2px rgba(15,27,46,0.06)` — audit cards, inputs
- `--shadow-md: 0 4px 16px rgba(15,27,46,0.06), 0 1px 2px rgba(15,27,46,0.04)` — marketing cards
- `--shadow-lg: 0 8px 24px rgba(15,27,46,0.08), 0 4px 12px rgba(15,27,46,0.04)` — hover, dropdowns
- No `shadow-2xl`, no `shadow-orange/risk` glow except subtle `0 4px 12px rgba(224,122,95,0.12)` on primary hover only.

**Borders > shadows for audit:** audit cards rely on `1px solid var(--slate-200)` + `shadow-sm`, not elevation.

---

### 7. Animation & Interaction — L2 (Fluent)

**Tier:** L2. L1 fallback via `prefers-reduced-motion`.

**Tokens:**
```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--duration-fast: 150ms;
--duration-base: 220ms;
--duration-slow: 350ms;
```

**Entry (once, on load/scroll):**
```css
.reveal { opacity: 0; transform: translateY(12px); }
.reveal.in { opacity: 1; transform: none; transition: opacity var(--duration-base) var(--ease-default), transform var(--duration-base) var(--ease-default); }
```
- Stagger `80ms` max 4 items (not 12-card stagger). `IntersectionObserver` threshold 0.15, rootMargin `0px 0px -10% 0px`.
- Hero H1: split-word mask reveal (clip-path) + 120ms stagger, 600ms total.
- Score: count-up 800ms + chip fade.

**Scroll:**
- Nav: `ink` bg opacity 0.85 → 0.98 + border on `scrollY > 8`.
- Section H2: `reveal` on enter (16px translate, not 40px).
- Bento: sequential reveal 80ms, no parallax on mobile.
- No L3 pin/scrub, no Lenis, no cursor follow (per Q17=B restraint).

**Hover:**
- Cards: `translateY(-2px)` + `shadow-md→lg` in 180ms (not -4px lift).
- Buttons: `translateY(-1px)` + shadow tint.
- Links: underline `1px solid rgba(var(--line-rgb)/0.4)` → `var(--line)` on hover.

**Focus:** `outline: 2px solid var(--line); outline-offset: 2px` everywhere.

**Reduced motion:**
```css
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; }
  .reveal.in { transition: none; }
  * { animation-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

**Signature moments (L2 requires 6):** 1) Hero word-mask, 2) UGC masonry stagger, 3) Score count-up, 4) Citation footnote reveal, 5) Pricing table row hover, 6) Method diagram line draw (SVG stroke-dashoffset).

---

### 8. Do's and Don'ts

**Do (≥8):**
1. Do use `ink/paper` for large surfaces, `risk` only for risk CTA/badges, `line` only for links/focus.
2. Do pair serif H1-H3 with Inter body/tables — audit tables are Inter tabular-nums.
3. Do source-link every metric ("50 comments via YouTube Data API v3 — 90d cache").
4. Do label synthetic demos "Example: anonymized gaming creator — not a real report".
5. Do use UGC thumbnails + dossier screenshots as imagery, not lucide grids.
6. Do keep audit density tight (8px radius, 12px gap) vs marketing breathable (16px, 80px sections).
7. Do make pricing a procurement table (rows, comparison, billing toggle) not 4 flashy cards.
8. Do reveal method via diagram: `YouTube transcript + 50 comments + channel API + web search → Gemini/Groq → PII-scrub → hashed cache`.

**Don't (≥5):**
1. Don't use `zinc-950/cyan-400/orange-600` gradients or `bg-zinc-950 border-zinc-800` everywhere.
2. Don't set `font-black 7xl` headlines or `Space Grotesk` on every heading.
3. Don't add `rounded-xl hover:-translate-y-1 hover:scale-[1.02] shadow-2xl` to every card.
4. Don't use `lucide-react` icons as sole illustration (max 1 icon per 2 sections, functional only).
5. Don't blur a fake dossier with lock overlay as primary proof — show excerpt or don't show.
6. Don't write `AI-POWERED / 360° / Bulletproof / Multi-Pass AI Research` buzzwords.
7. Don't animate with `filter: blur()` on moving elements or `backdrop-filter >14px` on scroll.
8. Don't add Three.js hero, Lenis, or cursor replacement — L2 only.

---

### 9. Responsive Behavior

**Breakpoints:** `360, 768, 1024, 1280` (via `responsive-web-design` + `web-design-reviewer`).
- Mobile (360-767): single column, `16px` body, hero `40px` display, masonry 2-col, pricing 1-col, dossier stacked, nav hamburger.
- Tablet (768-1023): 2-col bento, pricing 2-col, dossier 2-col top.
- Desktop (1024-1279): 12-col marketing, dossier `1150px`, nav full.
- Large (1280+): `1280px` max, hero 7+5.

**Touch:** min `44×44px` (prefer `48px`), `16px` input (no iOS zoom), `16px` horizontal padding mobile.

**Overflow guards:** `overflow-wrap: anywhere` on URLs/hashed IDs, `max-width: 100%` on tables, no `600px` horizontal scroll.

**QA:** `web-design-reviewer` at 375/768/1280/1920 per Q21, `web-design-guidelines` WCAG AA (contrast `ink #0F1B2E` on `paper #F6F2EF` = 15.4:1, `risk #E07A5F` on ink = 4.6:1, `line #49A9DE` on paper = 3.2:1 — use line only for large text/links, not body).

---

### Appendix: Implementation Order (Q7/Q18/Q22)

**Phase 1 funnel (now):** `app/globals.css` tokens → `app/layout.tsx` fonts (Instrument Serif + Inter) → `components/Navbar.tsx` (ink/paper, wordmark) → `app/page.tsx` hero (UGC masonry + word-mask) + bento (auditor) + pricing table + FAQ → `app/dashboard/dossier-viewer.tsx` (8px audit cards, footnotes) → `components/MethodDiagram.tsx` (B) + anonymized case (C) → motion (L2) → 5 AI critics.

**Phase 2 (after 4/5):** `app/dashboard/page.tsx` history/batch → `app/brand-safety/*/page.tsx` (PlatformPage) → `app/blog` → legal — token swap + full redesign per hybrid.

**References explicitly used:** archive.com (editorial beige + UGC masonry), Modash (indigo/sand friendly), CreatorIQ (navy/orange photo + flat) — tokens measured 2026-08-22, not guessed.

