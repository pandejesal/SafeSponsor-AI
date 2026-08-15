import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  metadataBase: new URL('https://safe-sponsor-ai.vercel.app'),
  title: { default: 'SafeSponsor AI | Creator Brand Safety Check & Sponsorship Vetting', template: '%s | SafeSponsor AI' },
  description: 'Free AI creator brand safety check: score YouTube, TikTok, Instagram & Twitch creators for sponsorship risk — controversies, toxic comments, scam history, competitor conflicts — before you sign.',
  keywords: ['brand safety check', 'creator vetting', 'sponsorship analysis', 'YouTube sponsor', 'TikTok creator check', 'Instagram creator', 'Twitch streamer', 'brand risk assessment', 'influencer marketing', 'creator due diligence'],
  openGraph: {
    title: 'SafeSponsor AI | Creator Brand Safety Check & Sponsorship Vetting',
    description: 'Free AI creator brand safety check: score YouTube, TikTok, Instagram & Twitch creators for sponsorship risk before you sign.',
    url: 'https://safe-sponsor-ai.vercel.app',
    siteName: 'SafeSponsor AI',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og.svg',
        width: 1200,
        height: 630,
        alt: 'SafeSponsor AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SafeSponsor AI | Creator Brand Safety Check & Sponsorship Vetting',
    description: 'Free AI creator brand safety check: score YouTube, TikTok, Instagram & Twitch creators for sponsorship risk before you sign.',
    images: ['/og.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('safesponsor-theme');if(t==='light')document.documentElement.classList.remove('dark');}catch(e){}`,
          }}
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#09090b" />
        <Script
          defer
          data-domain="safe-sponsor-ai.vercel.app"
          src="https://plausible.io/js/script.tagged-events.js"
          strategy="afterInteractive"
        />
      </head>
      <body className="antialiased font-sans transition-colors duration-300">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "SafeSponsor AI",
              "url": "https://safe-sponsor-ai.vercel.app",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "AI-powered brand safety analysis and risk scoring for YouTube & Instagram creators.",
              "offers": [
                {
                  "@type": "Offer",
                  "name": "Single Report",
                  "price": "8",
                  "priceCurrency": "USD"
                },
                {
                  "@type": "Offer",
                  "name": "Channel Report",
                  "price": "19",
                  "priceCurrency": "USD"
                },
                {
                  "@type": "Offer",
                  "name": "Unlimited Pro",
                  "price": "149",
                  "priceCurrency": "USD",
                  "billingIncrement": "P1M"
                }
              ]
            }),
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
