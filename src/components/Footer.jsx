import Link from "next/link";
import { PawIcon } from "@/components/Icons";

const LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/events", label: "Events" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

// Statement footer: one sentence in the display face closes the page, with
// the wordmark, a short link row and the email address beneath it in small
// type. Text is paper (6.48:1) and sand (5.01:1) on the deep-teal band.
export default function Footer() {
  return (
    <footer className="bg-brand-deep text-brand-paper mt-auto">
      <div className="max-w-7xl mx-auto safe-x py-10 sm:py-14">
        <p className="font-heading font-semibold text-3xl sm:text-4xl leading-[1.1] max-w-[28ch]">
          Baked by our family for yours.
        </p>

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-t border-brand-paper/25 pt-6">
          <Link
            href="/"
            className="wordmark inline-flex items-center gap-2 text-lg self-start whitespace-nowrap"
          >
            <PawIcon className="h-5 w-5 text-brand-paper-3" />
            Barks-A-Lot Treats &amp; More
          </Link>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-block py-1 underline-offset-4 hover:underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="mailto:info@barks-a-lot.com"
                  className="inline-block py-1 underline-offset-4 hover:underline"
                >
                  info@barks-a-lot.com
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-6 text-sm text-brand-paper-3 safe-bottom">
          {`© ${new Date().getFullYear()} Barks-A-Lot Treats & More`}
        </p>
      </div>
    </footer>
  );
}
