import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'SafeSponsor AI | Creator Brand Safety & Sponsorship Vetting',
  description: 'AI-powered brand safety analysis and risk scoring for YouTube & Instagram creators, video transcripts, and community comment sentiment.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased font-sans transition-colors duration-300">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
