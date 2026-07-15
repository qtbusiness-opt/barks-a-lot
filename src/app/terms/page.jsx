export const metadata = {
  title: "Terms of Service — Barks-A-Lot Treats & More",
  description:
    "The terms that govern your use of the Barks-A-Lot Treats & More website and purchases made through it.",
};

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[#2A4A52] mb-3">{title}</h2>
      <div className="space-y-3 text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto safe-x py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52]">
        Terms of Service
      </h1>
      <p className="text-gray-500 mt-2">
        Barks-A-Lot Treats &amp; More &middot; Effective Date: [Insert Date]
      </p>

      <p className="mt-6 text-gray-700 leading-relaxed">
        Welcome to Barks-A-Lot Treats &amp; More (&quot;Barks-A-Lot,&quot;
        &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms of
        Service (&quot;Terms&quot;) govern your use of our website and any
        purchases made through it. By accessing our website or placing an
        order, you agree to these Terms. If you do not agree, please do not
        use our website.
      </p>

      <Section title="1. About Our Products">
        <p>
          Barks-A-Lot sells handmade, organic dog treats and handmade dog
          bandanas. Our treats are made in small batches and are intended for
          canine consumption only.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Ingredient lists are provided for each product. It is the
            customer&apos;s responsibility to review ingredients for any known
            allergies or dietary restrictions their pet may have before
            purchasing or feeding a product.
          </li>
          <li>
            Our products are not a substitute for veterinary advice. If your
            pet has a medical condition, dietary restriction, or known
            allergy, please consult your veterinarian before introducing a new
            treat.
          </li>
          <li>
            Product appearance, size, and color may vary slightly, as items
            are handmade in small batches.
          </li>
        </ul>
      </Section>

      <Section title="2. Accounts">
        <ul className="list-disc pl-6 space-y-2">
          <li>You may create an account or check out as a guest.</li>
          <li>
            If you create an account, you are responsible for maintaining the
            confidentiality of your login credentials and for all activity
            that occurs under your account.
          </li>
          <li>
            You agree to provide accurate and current information when
            creating an account or placing an order.
          </li>
          <li>
            Please notify us immediately at{" "}
            <a
              href="mailto:info@barks-a-lot.com"
              className="text-[#4A7C8A] underline hover:text-[#2A4A52]"
            >
              info@barks-a-lot.com
            </a>{" "}
            if you suspect unauthorized use of your account.
          </li>
        </ul>
      </Section>

      <Section title="3. Orders and Payment">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            All orders are subject to acceptance and product availability. We
            reserve the right to refuse or cancel any order at our discretion,
            including in cases of suspected fraud or pricing errors.
          </li>
          <li>
            Prices are listed in U.S. dollars and are subject to change
            without notice. The price charged will be the price displayed at
            the time of purchase.
          </li>
          <li>
            Payment is processed securely through our third-party payment
            processor at the time of purchase.
          </li>
        </ul>
      </Section>

      <Section title="4. Order Pickup">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            All online orders are fulfilled by pickup at one of our markets or
            events. We do not offer shipping at this time.
          </li>
          <li>
            At checkout you select the market or event where you will pick up
            your order. Please bring your order confirmation number (from your
            confirmation email or your account&apos;s orders page) to the
            booth.
          </li>
          <li>
            We will make reasonable efforts to have your order ready at the
            selected event. If we are unable to attend an event, we will
            notify you and arrange pickup at another upcoming event.
          </li>
          <li>
            If you are unable to attend your selected event, contact us at{" "}
            <a
              href="mailto:info@barks-a-lot.com"
              className="text-[#4A7C8A] underline hover:text-[#2A4A52]"
            >
              info@barks-a-lot.com
            </a>{" "}
            and we will arrange pickup at an upcoming event.
          </li>
          <li>
            Risk of loss and title for products pass to you upon pickup at the
            event or market.
          </li>
        </ul>
      </Section>

      <Section title="5. Returns, Refunds, and Cancellations">
        <p>
          <strong>Returns:</strong> Due to their perishable nature, our
          treats and other edible products cannot be returned. All other
          items (such as bandanas and accessories) may be returned within
          thirty (30) days of pickup in unused condition — contact us at{" "}
          <a
            href="mailto:info@barks-a-lot.com"
            className="text-[#4A7C8A] underline hover:text-[#2A4A52]"
          >
            info@barks-a-lot.com
          </a>{" "}
          with your order number to arrange a return.
        </p>
        <p>
          <strong>Refunds:</strong> Approved returns are refunded to your
          original payment method. Perishable items are not eligible for
          refunds once an order has been picked up.
        </p>
        <p>
          <strong>Cancellations:</strong> Orders may be cancelled at any time
          before pickup — from the My Orders page of your account, or by
          contacting us at{" "}
          <a
            href="mailto:info@barks-a-lot.com"
            className="text-[#4A7C8A] underline hover:text-[#2A4A52]"
          >
            info@barks-a-lot.com
          </a>{" "}
          with your order number. Once an order has been picked up, it can no
          longer be cancelled. Any payment made for an order cancelled before
          pickup will be returned to your original payment method.
        </p>
        <p>
          Nothing in this section limits any non-waivable rights you may have
          under applicable consumer protection law.
        </p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>
          All website content, including but not limited to our logo, product
          photography, written content, and branding, is the property of
          Barks-A-Lot Treats &amp; More and may not be copied, reproduced, or
          used without our prior written permission.
        </p>
      </Section>

      <Section title="7. Prohibited Uses">
        <p>When using our website, you agree not to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Use the site for any unlawful purpose or in violation of these
            Terms
          </li>
          <li>
            Attempt to gain unauthorized access to our systems or another
            user&apos;s account
          </li>
          <li>Interfere with or disrupt the operation of the website</li>
          <li>Submit false or fraudulent orders or payment information</li>
        </ul>
      </Section>

      <Section title="8. Disclaimer of Warranties">
        <p>
          Our website and products are provided &quot;as is&quot; without
          warranties of any kind, express or implied, except as expressly
          stated in these Terms. We do not guarantee that our website will be
          uninterrupted, error-free, or secure at all times.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Barks-A-Lot Treats &amp;
          More shall not be liable for any indirect, incidental, special, or
          consequential damages arising out of your use of our website or
          products, including any adverse reaction by a pet to a product,
          provided the product was used as intended and in accordance with any
          provided instructions or ingredient disclosures. Our total liability
          for any claim arising from a purchase shall not exceed the amount
          you paid for the product giving rise to the claim.
        </p>
      </Section>

      <Section title="10. Indemnification">
        <p>
          You agree to indemnify and hold harmless Barks-A-Lot Treats &amp;
          More from any claims, damages, or expenses arising from your
          violation of these Terms or misuse of our website or products.
        </p>
      </Section>

      <Section title="11. Governing Law">
        <p>
          These Terms are governed by the laws of the State of Idaho, without
          regard to its conflict of law principles. Any disputes arising from
          these Terms or your use of our website shall be resolved in the
          courts located in Idaho.
        </p>
      </Section>

      <Section title="12. Changes to These Terms">
        <p>
          We may update these Terms from time to time. Changes will be posted
          on this page with an updated effective date. Continued use of our
          website after changes are posted constitutes acceptance of the
          updated Terms.
        </p>
      </Section>

      <Section title="13. Contact Us">
        <p>If you have questions about these Terms, please contact us:</p>
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
