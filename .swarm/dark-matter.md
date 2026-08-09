## Dark Matter: Hidden Couplings

Found 20 file pairs that frequently co-change but have no import relationship:

| File A | File B | NPMI | Co-Changes | Lift |
|--------|--------|------|------------|------|
| .gitignore | next-env.d.ts | 1.000 | 3 | 17.33 |
| .env.example | app/layout.tsx | 0.899 | 3 | 13.00 |
| public/favicon.svg | public/logo-hybrid-a.svg | 0.867 | 7 | 5.69 |
| .env.example | README.md | 0.821 | 3 | 10.40 |
| app/login/page.tsx | components/Navbar.tsx | 0.782 | 4 | 7.43 |
| app/page.tsx | components/Navbar.tsx | 0.782 | 4 | 7.43 |
| app/layout.tsx | app/page.tsx | 0.782 | 4 | 7.43 |
| app/globals.css | app/page.tsx | 0.782 | 4 | 7.43 |
| bun.lock | package.json | 0.757 | 3 | 8.67 |
| .gitignore | package.json | 0.757 | 3 | 8.67 |
| next-env.d.ts | package.json | 0.757 | 3 | 8.67 |
| app/layout.tsx | next.config.ts | 0.720 | 3 | 7.80 |
| app/api/checkout/route.ts | app/globals.css | 0.720 | 3 | 7.80 |
| README.md | app/layout.tsx | 0.720 | 3 | 7.80 |
| app/api/webhook/route.ts | lib/seeded_audits.ts | 0.703 | 3 | 7.43 |
| .env.example | app/page.tsx | 0.703 | 3 | 7.43 |
| app/globals.css | app/login/page.tsx | 0.602 | 3 | 5.57 |
| app/page.tsx | next.config.ts | 0.524 | 3 | 4.46 |
| app/api/checkout/route.ts | app/page.tsx | 0.524 | 3 | 4.46 |
| README.md | app/page.tsx | 0.524 | 3 | 4.46 |

These pairs likely share an architectural concern invisible to static analysis.
Consider adding explicit documentation or extracting the shared concern.