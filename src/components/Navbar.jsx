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

const isDev = process.env.NODE_ENV === "development";
const isQual = process.env.NODE_ENV === "qual";

const pillClass =
  "bg-brand-paper text-brand-ink px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-brand-paper-2 transition-colors duration-(--dur-micro) ease-(--ease-out)";

function isCurrentPath(pathname, href) {
  return pathname === href || pathname?.startsWith(`${href}/`);
}

function ariaCurrent(pathname, href) {
  if (pathname === href) return "page";
  return isCurrentPath(pathname, href) ? "true" : undefined;
}

// Hover and "you are here" both use an underline, not a colour change:
// paper text is the only light colour that clears 4.5:1 on the teal bar.
function linkClass(pathname, href) {
  return `underline-offset-8 decoration-2 hover:underline ${
    isCurrentPath(pathname, href) ? "underline" : ""
  }`;
}

function mobileLinkClass(pathname, href) {
  return `block py-3 underline-offset-4 decoration-2 active:underline ${
    isCurrentPath(pathname, href) ? "underline" : ""
  }`;
}

function cartLabelFor(itemCount) {
  return `Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`;
}

function homeLabel() {
  if (isDev) return "Barks-A-Lot home (development)";
  if (isQual) return "Barks-A-Lot home (qual)";
  return "Barks-A-Lot home";
}

function EnvBadge() {
  if (isDev) {
    return (
      <span className="ml-3 inline-flex items-center rounded-md bg-brand-paper px-2 py-1 text-sm font-medium text-brand-ink">
        DEV
      </span>
    );
  }
  if (isQual) {
    return (
      <span className="ml-3 inline-flex items-center rounded-md bg-brand-paper px-2 py-1 text-sm font-medium text-brand-error">
        QUAL
      </span>
    );
  }
  return null;
}

// The count is visual only; the link's own label already says it.
function CartCount({ count, className }) {
  if (count <= 0) return null;
  return (
    <span aria-hidden="true" className={className}>
      {count}
    </span>
  );
}

// Escape closes the phone menu and hands focus back to its button.
function useMobileMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);

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

  return { menuOpen, setMenuOpen, menuButtonRef };
}

function DesktopAccount({ pathname, user, logout, itemCount }) {
  return (
    <div className="hidden lg:flex items-center justify-end gap-6">
      {user && (
        <Link
          href="/orders"
          aria-current={ariaCurrent(pathname, "/orders")}
          className={linkClass(pathname, "/orders")}
        >
          Orders
        </Link>
      )}
      {user?.role === "admin" && (
        <Link
          href="/admin"
          aria-current={ariaCurrent(pathname, "/admin")}
          className={linkClass(pathname, "/admin")}
        >
          Admin
        </Link>
      )}
      <Link
        href="/cart"
        aria-label={cartLabelFor(itemCount)}
        aria-current={ariaCurrent(pathname, "/cart")}
        className={`relative ${linkClass(pathname, "/cart")}`}
      >
        Cart
        <CartCount
          count={itemCount}
          className="absolute -top-2 -right-4 bg-brand-accent-strong text-brand-on text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center tabular"
        />
      </Link>
      {user ? (
        <div className="flex items-center gap-4">
          <Link
            href="/profile"
            title={user.name}
            aria-current={ariaCurrent(pathname, "/profile")}
            className={`block max-w-36 truncate text-sm font-medium ${linkClass(pathname, "/profile")}`}
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
  );
}

function MenuIcon({ open }) {
  return (
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
        d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
      />
    </svg>
  );
}

// On phones the cart stays one tap away instead of hiding behind the menu.
function PhoneControls({ itemCount, menuOpen, onToggle, menuButtonRef }) {
  return (
    <div className="flex items-center lg:hidden">
      <Link
        href="/cart"
        aria-label={cartLabelFor(itemCount)}
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
        <CartCount
          count={itemCount}
          className="absolute top-0.5 right-0.5 bg-brand-accent-strong text-brand-on text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center tabular"
        />
      </Link>
      <button
        ref={menuButtonRef}
        className="flex items-center justify-center h-11 w-11 active:bg-brand-deep rounded-lg"
        onClick={onToggle}
        aria-expanded={menuOpen}
        aria-controls="mobile-menu"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
      >
        <MenuIcon open={menuOpen} />
      </button>
    </div>
  );
}

function MobileLink({ pathname, href, close, children }) {
  return (
    <Link
      href={href}
      aria-current={ariaCurrent(pathname, href)}
      className={mobileLinkClass(pathname, href)}
      onClick={close}
    >
      {children}
    </Link>
  );
}

function MobileMenu({ pathname, user, logout, itemCount, close }) {
  return (
    <div id="mobile-menu" className="lg:hidden pb-4 divide-y divide-white/10">
      {CENTRE_LINKS.map(({ href, label }) => (
        <MobileLink key={href} href={href} pathname={pathname} close={close}>
          {label}
        </MobileLink>
      ))}
      {user && (
        <MobileLink href="/orders" pathname={pathname} close={close}>
          Orders
        </MobileLink>
      )}
      {user?.role === "admin" && (
        <MobileLink href="/admin" pathname={pathname} close={close}>
          Admin
        </MobileLink>
      )}
      <MobileLink href="/cart" pathname={pathname} close={close}>
        Cart {itemCount > 0 && `(${itemCount})`}
      </MobileLink>
      {user ? (
        <>
          <MobileLink href="/profile" pathname={pathname} close={close}>
            Profile
          </MobileLink>
          <button
            onClick={() => {
              logout();
              close();
            }}
            className="block w-full text-left py-3 underline-offset-4 decoration-2 active:underline"
          >
            Logout
          </button>
        </>
      ) : (
        <MobileLink href="/login" pathname={pathname} close={close}>
          Login
        </MobileLink>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const pathname = usePathname();
  const { menuOpen, setMenuOpen, menuButtonRef } = useMobileMenu();

  return (
    <nav
      aria-label="Main"
      className="bg-brand-teal text-brand-on shadow-lg sticky top-0 z-50 safe-top"
    >
      <div className="max-w-7xl mx-auto safe-x sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <Link
            href="/"
            aria-label={homeLabel()}
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
            <EnvBadge />
          </Link>

          <div className="hidden lg:flex items-center gap-8 font-medium">
            {CENTRE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={ariaCurrent(pathname, href)}
                className={linkClass(pathname, href)}
              >
                {label}
              </Link>
            ))}
          </div>

          <DesktopAccount
            pathname={pathname}
            user={user}
            logout={logout}
            itemCount={itemCount}
          />

          <PhoneControls
            itemCount={itemCount}
            menuOpen={menuOpen}
            onToggle={() => setMenuOpen(!menuOpen)}
            menuButtonRef={menuButtonRef}
          />
        </div>

        {menuOpen && (
          <MobileMenu
            pathname={pathname}
            user={user}
            logout={logout}
            itemCount={itemCount}
            close={() => setMenuOpen(false)}
          />
        )}
      </div>
    </nav>
  );
}
