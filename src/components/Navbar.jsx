"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useEffect, useRef, useState } from "react";
import StoreImage from "@/components/StoreImage";

// The four places a shopper goes; the logo is the way home. Account and cart
// controls sit in the right-hand cluster.
const CENTRE_LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/events", label: "Events" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const isDev = process.env.NODE_ENV === "development";
  const isQual = process.env.NODE_ENV === "qual";
  const cartLabel = `Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`;

  // Escape closes the phone menu and hands focus back to its button.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const isCurrent = (href) =>
    pathname === href || pathname?.startsWith(`${href}/`);
  const current = (href) =>
    pathname === href ? "page" : isCurrent(href) ? "true" : undefined;

  // Hover and "you are here" both use an underline, not a colour change:
  // paper text is the only light colour that clears 4.5:1 on the teal bar.
  const linkClass = (href) =>
    `underline-offset-8 decoration-2 hover:underline ${
      isCurrent(href) ? "underline" : ""
    }`;
  const mobileLinkClass = (href) =>
    `block py-3 underline-offset-4 decoration-2 active:underline ${
      isCurrent(href) ? "underline" : ""
    }`;

  const pillClass =
    "bg-brand-paper text-brand-ink px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-brand-paper-2 transition-colors duration-(--dur-micro) ease-(--ease-out)";

  return (
    <nav
      aria-label="Main"
      className="bg-brand-teal text-brand-on shadow-lg sticky top-0 z-50 safe-top"
    >
      <div className="max-w-7xl mx-auto safe-x sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <Link
            href="/"
            aria-label={`Barks-A-Lot home${isDev ? " (development)" : isQual ? " (qual)" : ""}`}
            className="flex items-center gap-2 text-xl justify-self-start"
          >
            <StoreImage
              src="/images/barks-a-lot-logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full"
            />
            <span className="wordmark hidden sm:inline">Barks-A-Lot</span>
            {isDev ? (
              <span className="ml-3 inline-flex items-center rounded-md bg-brand-paper px-2 py-1 text-sm font-medium text-brand-ink">
                DEV
              </span>
            ) : isQual ? (
              <span className="ml-3 inline-flex items-center rounded-md bg-brand-paper px-2 py-1 text-sm font-medium text-brand-error">
                QUAL
              </span>
            ) : null}
          </Link>

          <div className="hidden lg:flex items-center gap-8 font-medium">
            {CENTRE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={current(href)}
                className={linkClass(href)}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center justify-end gap-6">
            {user && (
              <Link
                href="/orders"
                aria-current={current("/orders")}
                className={linkClass("/orders")}
              >
                Orders
              </Link>
            )}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                aria-current={current("/admin")}
                className={linkClass("/admin")}
              >
                Admin
              </Link>
            )}
            <Link
              href="/cart"
              aria-label={cartLabel}
              aria-current={current("/cart")}
              className={`relative ${linkClass("/cart")}`}
            >
              Cart
              {itemCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-4 bg-brand-accent-strong text-brand-on text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center tabular"
                >
                  {itemCount}
                </span>
              )}
            </Link>
            {user ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/profile"
                  title={user.name}
                  aria-current={current("/profile")}
                  className={`block max-w-36 truncate text-sm font-medium ${linkClass("/profile")}`}
                >
                  Hi, {user.name}
                </Link>
                <button onClick={logout} className={pillClass}>
                  Logout
                </button>
              </div>
            ) : (
              <Link href="/login" className={pillClass}>
                Login
              </Link>
            )}
          </div>

          {/* On phones the cart stays one tap away instead of hiding
              behind the menu. */}
          <div className="flex items-center lg:hidden">
            <Link
              href="/cart"
              aria-label={cartLabel}
              className="relative flex items-center justify-center h-11 w-11 active:bg-brand-deep rounded-lg"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6a1 1 0 00.9 1.4h12M10 21a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z"
                />
              </svg>
              {itemCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 right-0.5 bg-brand-accent-strong text-brand-on text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center tabular"
                >
                  {itemCount}
                </span>
              )}
            </Link>
            <button
              ref={menuButtonRef}
              className="flex items-center justify-center h-11 w-11 active:bg-brand-deep rounded-lg"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {menuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="lg:hidden pb-4 divide-y divide-white/10">
            {CENTRE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={current(href)}
                className={mobileLinkClass(href)}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            {user && (
              <Link
                href="/orders"
                aria-current={current("/orders")}
                className={mobileLinkClass("/orders")}
                onClick={() => setMenuOpen(false)}
              >
                Orders
              </Link>
            )}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                aria-current={current("/admin")}
                className={mobileLinkClass("/admin")}
                onClick={() => setMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            <Link
              href="/cart"
              aria-current={current("/cart")}
              className={mobileLinkClass("/cart")}
              onClick={() => setMenuOpen(false)}
            >
              Cart {itemCount > 0 && `(${itemCount})`}
            </Link>
            {user ? (
              <>
                <Link
                  href="/profile"
                  aria-current={current("/profile")}
                  className={mobileLinkClass("/profile")}
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left py-3 underline-offset-4 decoration-2 active:underline"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                aria-current={current("/login")}
                className={mobileLinkClass("/login")}
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
