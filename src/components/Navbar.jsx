"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useState } from "react";
import StoreImage from "@/components/StoreImage";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDev = process.env.NODE_ENV === "development";
  const isQual = process.env.NODE_ENV === "qual";

  return (
    <nav
      aria-label="Main"
      className="bg-[#4A7C8A] text-white shadow-lg sticky top-0 z-50 safe-top"
    >
      <div className="max-w-7xl mx-auto safe-x sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <StoreImage
              src="/images/barks-a-lot-logo.png"
              alt="Barks-A-Lot"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full"
            />
            <span className="wordmark hidden sm:inline">Barks-A-Lot</span>
            {isDev ? (
              <span className="ml-3 inline-flex items-center rounded-md bg-yellow-400/10 px-2 py-1 text-sm font-medium text-yellow-500 inset-ring-yellow-400/20">
                DEV
              </span>
            ) : isQual ? (
              <span className="ml-3 inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-sm font-medium text-red-500 inset-ring-red-400/20">
                QUAL
              </span>
            ) : null}
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="hover:text-[#E8DFC8] transition">
              Home
            </Link>
            <Link href="/products" className="hover:text-[#E8DFC8] transition">
              Shop
            </Link>
            <Link href="/events" className="hover:text-[#E8DFC8] transition">
              Events
            </Link>
            <Link href="/about" className="hover:text-[#E8DFC8] transition">
              About
            </Link>
            <Link href="/contact" className="hover:text-[#E8DFC8] transition">
              Contact
            </Link>
            {user && (
              <Link href="/orders" className="hover:text-[#E8DFC8] transition">
                Orders
              </Link>
            )}
            {user?.role === "admin" && (
              <Link href="/admin" className="hover:text-[#E8DFC8] transition">
                Admin
              </Link>
            )}
            <Link
              href="/cart"
              aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
              className="relative hover:text-[#E8DFC8] transition"
            >
              Cart
              {itemCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-4 bg-[#C8722A] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
                >
                  {itemCount}
                </span>
              )}
            </Link>
            {user ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/profile"
                  className="text-white text-sm font-medium hover:underline transition"
                >
                  Hi, {user.name}
                </Link>
                <button
                  onClick={logout}
                  className="bg-[#E8DFC8] text-[#4A7C8A] px-3 py-1 rounded-md text-sm font-medium hover:bg-white transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-[#E8DFC8] text-[#4A7C8A] px-4 py-1.5 rounded-md text-sm font-medium hover:bg-white transition"
              >
                Login
              </Link>
            )}
          </div>

          {/* On phones the cart stays one tap away instead of hiding
              behind the menu. */}
          <div className="flex items-center md:hidden">
            <Link
              href="/cart"
              aria-label={`Cart, ${itemCount} items`}
              className="relative flex items-center justify-center h-11 w-11 active:bg-white/10 rounded-lg"
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
                <span className="absolute top-0.5 right-0.5 bg-[#C8722A] text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            <button
              className="flex items-center justify-center h-11 w-11 active:bg-white/10 rounded-lg"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
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
          <div className="md:hidden pb-4 divide-y divide-white/10">
            <Link
              href="/"
              className="block py-3 active:text-[#E8DFC8]"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/products"
              className="block py-3 active:text-[#E8DFC8]"
              onClick={() => setMenuOpen(false)}
            >
              Shop
            </Link>
            <Link
              href="/events"
              className="block py-3 active:text-[#E8DFC8]"
              onClick={() => setMenuOpen(false)}
            >
              Events
            </Link>
            <Link
              href="/about"
              className="block py-3 active:text-[#E8DFC8]"
              onClick={() => setMenuOpen(false)}
            >
              About
            </Link>
            <Link
              href="/contact"
              className="block py-3 active:text-[#E8DFC8]"
              onClick={() => setMenuOpen(false)}
            >
              Contact
            </Link>
            {user && (
              <Link
                href="/orders"
                className="block py-3 active:text-[#E8DFC8]"
                onClick={() => setMenuOpen(false)}
              >
                Orders
              </Link>
            )}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="block py-3 active:text-[#E8DFC8]"
                onClick={() => setMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            <Link
              href="/cart"
              className="block py-3 active:text-[#E8DFC8]"
              onClick={() => setMenuOpen(false)}
            >
              Cart {itemCount > 0 && `(${itemCount})`}
            </Link>
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="block py-3 active:text-[#E8DFC8]"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left py-3 active:text-[#E8DFC8]"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block py-3 active:text-[#E8DFC8]"
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
