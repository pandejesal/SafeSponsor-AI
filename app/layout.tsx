import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://safe-sponsor-ai.vercel.app'),
  title: 'SafeSponsor AI | Creator Brand Safety & Sponsorship Vetting',
  description: 'AI-powered brand safety analysis and risk scoring for YouTube & Instagram creators, video transcripts, and community comment sentiment.',
  openGraph: {
    title: 'SafeSponsor AI | Creator Brand Safety & Sponsorship Vetting',
    description: 'AI-powered brand safety analysis and risk scoring for YouTube & Instagram creators, video transcripts, and community comment sentiment.',
    type: 'website',
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
      </head>
      <body className="antialiased font-sans transition-colors duration-300">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
