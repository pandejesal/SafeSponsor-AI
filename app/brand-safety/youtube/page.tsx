import type { Metadata } from 'next';
import PlatformPage from '@/components/PlatformPage';

export const metadata: Metadata = {
  title: 'YouTube Creator Brand Safety Check — Vet Sponsorships Before You Sign',
  description: 'Free YouTube creator brand safety check: score any channel or video for sponsorship risk — controversies, toxic comments, scam history, competitor conflicts — before you sign the deal.',
  alternates: {
    canonical: '/brand-safety/youtube',
  },
  openGraph: {
    title: 'YouTube Creator Brand Safety Check | SafeSponsor AI',
    description: 'Free once-per-account YouTube creator brand safety score: controversies, toxic comments, and scam history before you sponsor.',
  },
};

export default function YouTubePage() {
  return (
    <PlatformPage
      platform="YouTube"
      eyebrow="YOUTUBE CREATOR VETTING"
      title="Check a YouTube Creator&apos;s Brand Safety Before You Sponsor"
      subtitle="Paste any YouTube channel or video URL for a free AI brand safety score. We scan transcripts, the latest comments for toxicity, press history, and sponsorship conflicts — then show you the top red flags."
      platformHint="YouTube"
      bullets={[
        'Full video transcript analysis for undisclosed sponsor conflicts',
        'Top 50 recent comments scored for toxicity, scam complaints, and bot spam',
        'Press and social controversy history across the web',
        'Past crypto, gambling, and fintech promotion detection',
        'Competitor brand conflict check before you commit',
        'Contractual safeguard suggestions for safe sponsorships',
      ]}
      faq={[
        { q: 'How accurate is the YouTube brand safety score?', a: 'Our multi-pass AI pipeline scores the creator from transcripts, comment sentiment, web press, and sponsorship history. Independent benchmarks hold 96% precision and recall on known-risk cases.' },
        { q: 'Can I check a YouTube Shorts creator?', a: 'Yes — paste any video, Shorts, or channel URL. Channel audits go deeper: full upload history themes and community sentiment.' },
        { q: 'What does the free check show?', a: 'One free check per account returns the headline score, risk level, and the 2–3 most serious red-flag headers. The $8 Single Report unlocks the complete dossier.' },
        { q: 'How fast is it?', a: 'The free check runs the full pipeline in about a minute. Cached results for popular creators are instant for paying users.' },
      ]}
    />
  );
}