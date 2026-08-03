import { Navbar } from '@/components/Navbar';

export const metadata = {
  title: 'Privacy Policy | SafeSponsor AI',
  description: 'Privacy policy for SafeSponsor AI brand safety analysis platform.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-zinc-400 text-sm leading-relaxed">
          <p><em>Last updated: August 4, 2026</em></p>

          <h2 className="text-lg font-semibold text-zinc-200 pt-4">1. Information We Collect</h2>
          <p>
            When you use SafeSponsor AI, we collect your Firebase Authentication credentials (email, display name, profile photo) 
            and payment information processed through our payment provider (Dodo Payments). We do not store credit card details directly.
          </p>
          <p>
            When you run a brand safety audit, we process publicly available YouTube video data, channel metadata, 
            video transcripts, and public comment data. This data is cached for 7 days to improve performance.
          </p>

          <h2 className="text-lg font-semibold text-zinc-200 pt-4">2. How We Use Your Information</h2>
          <p>
            We use your information to provide brand safety analysis services, process payments, 
            and improve our platform. We do not sell your personal data to third parties.
          </p>

          <h2 className="text-lg font-semibold text-zinc-200 pt-4">3. Data Storage</h2>
          <p>
            Your account data and audit history are stored in Firebase (Google Cloud). 
            Audit results are retained until you delete them or your account is terminated.
          </p>

          <h2 className="text-lg font-semibold text-zinc-200 pt-4">4. Third-Party Services</h2>
          <p>
            We use Firebase (Google), Dodo Payments, and Vercel to operate our platform. 
            Each service has its own privacy policy governing data handling.
          </p>

          <h2 className="text-lg font-semibold text-zinc-200 pt-4">5. Data Security</h2>
          <p>
            We implement industry-standard security measures including HTTPS encryption, 
            Firebase App Check, and server-side authentication verification.
          </p>

          <h2 className="text-lg font-semibold text-zinc-200 pt-4">6. Your Rights</h2>
          <p>
            You can request deletion of your account and all associated data by contacting us. 
            You can also export your audit history from the dashboard.
          </p>

          <h2 className="text-lg font-semibold text-zinc-200 pt-4">7. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Significant changes will be communicated via email.
          </p>

          <h2 className="text-lg font-semibold text-zinc-200 pt-4">8. Contact</h2>
          <p>
            For privacy-related inquiries, contact us at{' '}
            <a href="mailto:pandejesal@gmail.com" className="text-cyan-400 hover:underline">
              pandejesal@gmail.com
            </a>.
          </p>
        </div>
      </main>
    </div>
  );
}
