"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(
        err.response?.data?.error || "Something went wrong — please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <div className="text-4xl mb-3">😕</div>
        <h1 className="text-2xl font-bold text-[#2A4A52] mb-3">
          Invalid Reset Link
        </h1>
        <p className="text-gray-600 mb-6">
          This link is missing its reset code. Request a fresh one below.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-2.5 rounded-lg font-semibold transition"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h1 className="text-2xl font-bold text-[#2A4A52] mb-3">
          Password Updated
        </h1>
        <p className="text-gray-600 mb-6">
          Your new password is set — log in to start shopping.
        </p>
        <Link
          href="/login"
          className="block w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-2.5 rounded-lg font-semibold transition"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-8">
      <h1 className="text-2xl font-bold text-[#2A4A52] text-center mb-6">
        Choose a New Password
      </h1>
      {error && (
        <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="rp-password" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="rp-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rp-confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="rp-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
        >
          {loading ? "Saving..." : "Set New Password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="max-w-md mx-auto safe-x py-10 sm:py-16">
      <Suspense
        fallback={<p className="text-center text-gray-500">Loading...</p>}
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
