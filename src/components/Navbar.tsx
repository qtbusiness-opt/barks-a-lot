"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-[#4A7C8A] text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <img src="/images/logo.svg" alt="Barks-A-Lot" className="h-10 w-10 rounded-full" />
            <span className="hidden sm:inline">Barks-A-Lot</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="hover:text-[#E8DFC8] transition">Home</Link>
            <Link href="/products" className="hover:text-[#E8DFC8] transition">Shop</Link>
            {user && (
              <Link href="/orders" className="hover:text-[#E8DFC8] transition">Orders</Link>
            )}
            <Link href="/cart" className="relative hover:text-[#E8DFC8] transition">
              Cart
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-4 bg-[#C8722A] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-[#E8DFC8] text-sm">Hi, {user.name}</span>
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

          <button
            className="md:hidden text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/" className="block py-2 hover:text-[#E8DFC8]" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link href="/products" className="block py-2 hover:text-[#E8DFC8]" onClick={() => setMenuOpen(false)}>Shop</Link>
            {user && (
              <Link href="/orders" className="block py-2 hover:text-[#E8DFC8]" onClick={() => setMenuOpen(false)}>Orders</Link>
            )}
            <Link href="/cart" className="block py-2 hover:text-[#E8DFC8]" onClick={() => setMenuOpen(false)}>
              Cart {itemCount > 0 && `(${itemCount})`}
            </Link>
            {user ? (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="block py-2 hover:text-[#E8DFC8]">Logout</button>
            ) : (
              <Link href="/login" className="block py-2 hover:text-[#E8DFC8]" onClick={() => setMenuOpen(false)}>Login</Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
