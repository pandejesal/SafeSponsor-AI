import { Navbar } from '@/components/Navbar';

export const metadata = {
  title: 'Terms of Service | SafeSponsor AI',
  description: 'Terms of service for SafeSponsor AI brand safety analysis platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
        <h1 className="text-[28px] leading-[1.1] mb-8" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>Terms of Service</h1>
        <div className="space-y-6 text-sm leading-relaxed" style={{ fontFamily: "var(--font-sans)", color: "var(--ink-600)" }}>
          <p><em>Last updated: August 15, 2026</em></p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>1. Acceptance of Terms</h2>
          <p>
            By accessing or using SafeSponsor AI, you agree to be bound by these Terms of Service. 
            If you do not agree, do not use the platform.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>2. Service Description</h2>
          <p>
            SafeSponsor AI provides AI-powered brand safety analysis for YouTube, TikTok, Instagram, 
            and Twitch creators. Our tool analyzes publicly available data to generate risk assessments 
            for sponsorship decisions. Results are informational and do not constitute legal or financial advice.
          </p>
          <p>
            SafeSponsor AI is operated by a sole proprietor. The contact details in Section 12 are the
            operator&apos;s business contact.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>3. Account Registration</h2>
          <p>
            You must create an account using Google Sign-In to access the platform. 
            You are responsible for maintaining the security of your account.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>4. Free Score Teaser</h2>
          <p>
            Each account may run one free score teaser: a headline brand safety score with the top
            red-flag headers only. The teaser requires sign-in, is limited to one run per account, and
            its result is discarded after display — it is not stored and does not grant access to any
            full report. Full reports require a paid plan.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>5. Payments</h2>
          <p>
            Paid plans are processed through Dodo Payments. All prices are in USD. 
            Subscriptions renew automatically unless cancelled before the billing period ends. 
            Single and channel report credits do not expire.
          </p>
          <p>
            During the preview phase, payments are processed in <strong>test mode</strong> by our
            payment provider: no real charges are made and no real payouts occur. Test-mode
            transactions do not create real financial obligations. We will notify users before
            switching to live payments.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>6. Refund Policy</h2>
          <p>
            Due to the digital nature of our services, refunds are handled on a case-by-case basis. 
            Contact us within 7 days of purchase if you experience issues with your order.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>7. Takedown Requests</h2>
          <p>
            If you are a creator whose brand safety assessment is displayed by the platform, you may
            request removal of that assessment. Send a takedown request to the contact address in
            Section 12 identifying the creator profile and the assessment in question. We will review
            the request and, where warranted, remove or restrict the assessment within 48 hours of
            confirmation. Assessments removed via takedown are not re-served or re-generated.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>8. Acceptable Use</h2>
          <p>
            You agree not to abuse the platform, attempt unauthorized access, 
            use automated scripts to bypass rate limits, or use the service for any unlawful purpose.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>9. Intellectual Property</h2>
          <p>
            Audit reports generated by SafeSponsor AI are yours to use. 
            The platform, its code, and design are the intellectual property of SafeSponsor AI.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>10. Limitation of Liability</h2>
          <p>
            SafeSponsor AI is provided &quot;as is&quot; without warranties. We are not liable for any damages 
            arising from the use of our platform or reliance on audit results.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>11. Termination</h2>
          <p>
            We reserve the right to terminate accounts that violate these terms. 
            You may delete your account at any time from the dashboard.
          </p>

          <h2 className="text-[18px] font-semibold pt-4" style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>12. Contact</h2>
          <p>
            For questions about these terms or to submit a takedown request, contact{' '}
            <a href="mailto:pandejesal@gmail.com" className="hover:underline" style={{ color: "var(--line)" }}>
              pandejesal@gmail.com
            </a>.
          </p>
        </div>
      </main>
    </div>
  );
}