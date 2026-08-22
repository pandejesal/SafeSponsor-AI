import { Navbar } from '@/components/Navbar';

export const metadata = {
  title: 'Privacy Policy | SafeSponsor AI',
  description: 'Privacy policy for SafeSponsor AI brand safety analysis platform.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
        <h1 className="text-[28px] leading-[1.1] mb-8" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>Privacy Policy</h1>
        <div className="space-y-6 text-sm leading-relaxed" style={{ fontFamily: "var(--font-sans)", color: "var(--ink-600)" }}>
          <p><em>Last updated: August 15, 2026</em></p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>1. Information We Collect</h2>
          <p>
            When you use SafeSponsor AI, we collect your Firebase Authentication credentials (email, display name, profile photo) 
            and payment information processed through our payment provider (Dodo Payments). We do not store credit card details directly.
          </p>
          <p>
            When you run a brand safety audit, we process publicly available video data, channel metadata, 
            video transcripts, and public comment data. Audit results are cached in a shared, indexed
            cache to serve paying users quickly (fresh for 90 days, refreshed until 180 days).
          </p>
          <p>
            The free score teaser runs the same analysis but its result is <strong>not stored</strong>:
            we keep only the fact that your account used its one free check.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>2. How We Use Your Information</h2>
          <p>
            We use your information to provide brand safety analysis services, process payments, 
            and improve our platform. We do not sell your personal data to third parties.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>3. Data Storage</h2>
          <p>
            Your account data and audit history are stored in Firebase (Google Cloud). 
            Audit results are retained until you delete them or your account is terminated.
            Operational logs (usage and cost records) are retained for cost management and
            are not sold or shared.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>4. Creator Assessments & Takedowns</h2>
          <p>
            Brand safety assessments reference publicly available information about creator profiles.
            If you are a creator and believe an assessment is inaccurate or should be removed, you may
            submit a takedown request (see our Terms of Service). Removed assessments are not re-served.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>5. Third-Party Services</h2>
          <p>
            We use Firebase (Google), Dodo Payments, and Vercel to operate our platform. 
            Each service has its own privacy policy governing data handling.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>6. Data Security</h2>
          <p>
            We implement industry-standard security measures including HTTPS encryption, 
            Firebase App Check, and server-side authentication verification.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>7. Your Rights</h2>
          <p>
            You can request deletion of your account and all associated data by contacting us. 
            You can also export your audit history from the dashboard.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>8. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Significant changes will be communicated via email.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>9. Contact</h2>
          <p>
            For privacy-related inquiries, contact us at{' '}
            <a href="mailto:pandejesal@gmail.com" className="hover:underline" style={{ color: "var(--line)" }}>
              pandejesal@gmail.com
            </a>.
          </p>
        </div>
      </main>
    </div>
  );
}