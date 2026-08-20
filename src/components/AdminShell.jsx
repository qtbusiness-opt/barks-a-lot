"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import pkg from "../../package.json";

// Shared frame for /admin pages: handles the loading/role gate once so
// each page only renders its content. The real security boundary is the
// server-side role check in every admin API route.
export default function AdminShell({ title, backTo, children }) {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto safe-x py-20 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto safe-x py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">Admin</h1>
        <p className="text-gray-500 mb-6">
          You need an admin account to view this page.
        </p>
        <Link
          href="/login"
          className="inline-block bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto safe-x py-6 sm:py-10">
      {backTo && (
        <Link
          href={backTo}
          className="inline-flex items-center min-h-11 text-[#4A7C8A] hover:underline mb-1"
        >
          &larr; Dashboard
        </Link>
      )}
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-6 sm:mb-8">
        {title}
      </h1>
      {children}
      <p className="text-center text-xs text-gray-400 mt-10">
        Barks-A-Lot v{pkg.version}
      </p>
    </div>
  );
}
