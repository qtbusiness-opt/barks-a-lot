export const metadata = {
  title: "Privacy Policy — Barks-A-Lot Treats & More",
  description:
    "How Barks-A-Lot Treats & More collects, uses, and protects your information.",
};

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[#2A4A52] mb-3">{title}</h2>
      <div className="space-y-3 text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto safe-x py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52]">
        Privacy Policy
      </h1>
      <p className="text-gray-500 mt-2">
        Barks-A-Lot Treats &amp; More &middot; Effective Date: [Insert Date]
      </p>

      <p className="mt-6 text-gray-700 leading-relaxed">
        Barks-A-Lot Treats &amp; More (&ldquo;Barks-A-Lot,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy. This Privacy
        Policy explains what information we collect when you visit our website
        or make a purchase, how we use it, and the choices you have. By using
        our website, you agree to the practices described below.
      </p>

      <Section title="1. Information We Collect">
        <p className="font-medium text-[#2A4A52]">
          Information you provide to us:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Account creation:</strong> If you create an account, we
            collect your name and email address, and a password (stored
            securely, never in plain text).
          </li>
          <li>
            <strong>Guest checkout:</strong> If you check out as a guest, we
            collect your name, email address, and order details — including
            the market or event you choose for pickup — for that transaction.
          </li>
          <li>
            <strong>Payment information:</strong> Payment is processed by a
            third-party payment processor. We do not store your full card
            number on our servers.
          </li>
          <li>
            <strong>Communications:</strong> If you contact us directly
            (email, contact form, in person at a market or event), we retain
            that correspondence to respond to you.
          </li>
        </ul>
        <p className="font-medium text-[#2A4A52]">
          Information collected automatically:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Standard server logs, including your IP address, browser type,
            device type, and pages visited. We use this information to keep
            the site secure (for example, limiting repeated login attempts)
            and to maintain and improve the site.
          </li>
          <li>
            Essential cookies and similar browser storage needed for the site
            to work — see Section 4.
          </li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Create and manage your account</li>
          <li>
            Process and fulfill orders, including sending order confirmation
            and order status emails (such as ready-for-pickup and cancellation
            notices)
          </li>
          <li>Send account verification emails when you sign up</li>
          <li>Respond to customer service inquiries</li>
          <li>Maintain the security and functionality of our website</li>
          <li>
            Comply with legal obligations (e.g., tax and accounting records)
          </li>
        </ul>
        <p>
          We do not use your information for automated decision-making that
          produces legal or similarly significant effects.
        </p>
      </Section>

      <Section title="3. How We Share Your Information">
        <p>We do not sell your personal information to third parties.</p>
        <p>
          We do share limited information with trusted service providers who
          help us operate our business, including:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Payment processors, to securely process transactions</li>
          <li>
            Email service providers, to send account verification, order
            confirmation, and order status emails
          </li>
        </ul>
        <p>
          These providers are only given the information necessary to perform
          their function and are not permitted to use it for their own
          marketing purposes.
        </p>
        <p>
          We may also disclose information if required by law, to protect our
          legal rights, or in connection with a business transfer (such as a
          sale of the business), in which case customers would be notified.
        </p>
      </Section>

      <Section title="4. Cookies and Tracking Technologies">
        <p>
          We use only the cookies and browser storage needed for the site to
          function:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Login session cookies</strong> keep you signed in to your
            account. They are httpOnly (not readable by scripts) and expire
            automatically.
          </li>
          <li>
            <strong>Security cookies</strong> protect forms and checkout
            against cross-site request forgery.
          </li>
          <li>
            <strong>Your shopping cart</strong> is saved in your browser&rsquo;s
            local storage so it survives page reloads. It stays on your device
            and is not sent to us until you place an order.
          </li>
        </ul>
        <p>
          We do not use advertising cookies or third-party analytics trackers.
          You can disable cookies through your browser settings, though you
          will not be able to log in or check out with an account while they
          are disabled.
        </p>
      </Section>

      <Section title="5. Data Security">
        <p>
          We use reasonable administrative and technical safeguards to protect
          your information, including secure password storage and encrypted
          data transmission (HTTPS). No online system is 100% secure, but we
          work to protect your data and will notify affected customers if we
          become aware of a breach involving personal information, as required
          by law.
        </p>
      </Section>

      <Section title="6. Data Retention">
        <p>
          We retain account and order information for as long as your account
          is active or as needed to fulfill the purposes described in this
          policy, including recordkeeping required for tax and accounting
          purposes. You may request deletion of your account information at
          any time (see Section 7).
        </p>
      </Section>

      <Section title="7. Your Rights and Choices">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Access or correction:</strong> You can review and update
            your account information by logging into your account, or by
            contacting us directly.
          </li>
          <li>
            <strong>Account deletion:</strong> You may request that we delete
            your account and associated personal information by emailing us at{" "}
            <a
              href="mailto:info@barks-a-lot.com"
              className="text-[#4A7C8A] underline hover:text-[#2A4A52]"
            >
              info@barks-a-lot.com
            </a>
            . We may retain certain information as required by law (e.g.,
            order records for tax purposes).
          </li>
          <li>
            <strong>Marketing emails:</strong> If we send promotional emails,
            you may unsubscribe at any time using the link in the email. This
            will not affect transactional emails like order confirmations.
          </li>
          <li>
            <strong>California residents:</strong> Depending on applicable
            law, you may have additional rights regarding your personal
            information, including the right to know what information we
            collect and to request its deletion. Contact us at{" "}
            <a
              href="mailto:info@barks-a-lot.com"
              className="text-[#4A7C8A] underline hover:text-[#2A4A52]"
            >
              info@barks-a-lot.com
            </a>{" "}
            to make a request.
          </li>
        </ul>
      </Section>

      <Section title="8. Children's Privacy">
        <p>
          Our website is not directed to children under 13, and we do not
          knowingly collect personal information from children under 13. If
          you believe a child has provided us with personal information,
          please contact us and we will delete it.
        </p>
      </Section>

      <Section title="9. Third-Party Links">
        <p>
          Our website may contain links to third-party sites (such as social
          media). We are not responsible for the privacy practices of those
          sites, and we encourage you to review their privacy policies.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Changes will be
          posted on this page with an updated effective date. Continued use of
          our website after changes are posted constitutes acceptance of the
          updated policy.
        </p>
      </Section>

      <Section title="11. Contact Us">
        <p>
          If you have questions about this Privacy Policy or how we handle
          your information, please contact us:
        </p>
        <p>
          Barks-A-Lot Treats &amp; More
          <br />
          Email:{" "}
          <a
            href="mailto:info@barks-a-lot.com"
            className="text-[#4A7C8A] underline hover:text-[#2A4A52]"
          >
            info@barks-a-lot.com
          </a>
        </p>
      </Section>
    </div>
  );
}
