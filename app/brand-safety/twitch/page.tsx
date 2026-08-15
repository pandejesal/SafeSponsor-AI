import type { Metadata } from 'next';
import PlatformPage from '@/components/PlatformPage';

export const metadata: Metadata = {
  title: 'Twitch Streamer Brand Safety Check — Vet Sponsorships Before You Sign',
  description: 'Free Twitch streamer brand safety check: score any streamer for sponsorship risk — controversies, toxic chat, scam history, competitor conflicts — before you sign the deal.',
  alternates: {
    canonical: '/brand-safety/twitch',
  },
  openGraph: {
    title: 'Twitch Streamer Brand Safety Check | SafeSponsor AI',
    description: 'Free once-per-account Twitch streamer brand safety score: controversies, toxic chat, and scam history before you sponsor.',
  },
};

export default function TwitchPage() {
  return (
    <PlatformPage
      platform="Twitch"
      eyebrow="TWITCH STREAMER VETTING"
      title="Check a Twitch Streamer&apos;s Brand Safety Before You Sponsor"
      subtitle="Paste any Twitch channel or clip URL for a free AI brand safety score. We scan stream titles, public chat samples, press history, and sponsorship conflicts — then show you the top red flags."
      platformHint="Twitch"
      bullets={[
        'Channel history and stream-title analysis for undisclosed sponsorships',
        'Public chat samples scored for toxicity and scam complaints',
        'Press and social controversy history across the web',
        'Past crypto, gambling, and fintech promotion detection',
        'Competitor brand conflict check before you commit',
        'Contractual safeguard suggestions for safe sponsorships',
      ]}
      faq={[
        { q: 'Can SafeSponsor AI analyze Twitch streamers?', a: 'Yes — paste a Twitch channel or clip URL. We combine public channel data with a web-search-backed backlash scan and flag data-quality limits honestly.' },
        { q: 'How is the Twitch brand safety score computed?', a: 'The same multi-pass AI pipeline as our YouTube checks: channel history, chat sentiment, press coverage, and sponsorship patterns — benchmarked at 96% precision and recall.' },
        { q: 'What does the free check show?', a: 'One free check per account returns the headline score, risk level, and the 2–3 most serious red-flag headers. The $8 Single Report unlocks the complete dossier.' },
        { q: 'How fast is it?', a: 'The free check runs the full pipeline in about a minute. Cached results for popular creators are instant for paying users.' },
      ]}
    />
  );
}