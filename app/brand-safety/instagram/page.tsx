import type { Metadata } from 'next';
import PlatformPage from '@/components/PlatformPage';

export const metadata: Metadata = {
  title: 'Instagram Creator Brand Safety Check — Vet Sponsorships Before You Sign',
  description: 'Free Instagram creator brand safety check: score any creator or brand profile for sponsorship risk — controversies, toxic comment sections, scam history, competitor conflicts — before you sign the deal.',
  alternates: {
    canonical: '/brand-safety/instagram',
  },
  openGraph: {
    title: 'Instagram Creator Brand Safety Check | SafeSponsor AI',
    description: 'Free once-per-account Instagram creator brand safety score: controversies, toxic comments, and scam history before you sponsor.',
  },
};

export default function InstagramPage() {
  return (
    <PlatformPage
      platform="Instagram"
      eyebrow="INSTAGRAM CREATOR VETTING"
      title="Check an Instagram Creator&apos;s Brand Safety Before You Sponsor"
      subtitle="Paste any Instagram creator or brand profile URL for a free AI brand safety score. We scan their content, comment sentiment, press history, and sponsorship conflicts — then show you the top red flags."
      platformHint="Instagram"
      bullets={[
        'Creator profile and post-caption analysis for undisclosed sponsorships',
        'Comment-section sentiment sampled for toxicity and scam complaints',
        'Press and social controversy history across the web',
        'Past crypto, gambling, and fintech promotion detection',
        'Competitor brand conflict check before you commit',
        'Contractual safeguard suggestions for safe sponsorships',
      ]}
      faq={[
        { q: 'Can SafeSponsor AI analyze Instagram creators?', a: 'Yes — paste an Instagram creator or brand profile URL. We combine available public data with a web-search-backed backlash scan and flag data-quality limits honestly.' },
        { q: 'How is the Instagram brand safety score computed?', a: 'The same multi-pass AI pipeline as our YouTube checks: content history, comment sentiment, press coverage, and sponsorship patterns — benchmarked at 96% precision and recall.' },
        { q: 'What does the free check show?', a: 'One free check per account returns the headline score, risk level, and the 2–3 most serious red-flag headers. The $8 Single Report unlocks the complete dossier.' },
        { q: 'How fast is it?', a: 'The free check runs the full pipeline in about a minute. Cached results for popular creators are instant for paying users.' },
      ]}
    />
  );
}