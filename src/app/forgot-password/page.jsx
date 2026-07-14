"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setSent(res.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Something went wrong — please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-md mx-auto safe-x py-10 sm:py-16">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="text-4xl mb-3">📬</div>
          <h1 className="text-2xl font-bold text-[#2A4A52] mb-3">
            Check Your Email
          </h1>
          <p className="text-gray-600">
            If <span className="font-semibold text-[#2A4A52]">{email}</span>{" "}
            has an account, a password reset link is on its way. It expires
            in 1 hour.
          </p>
          {sent.devResetUrl && (
            <p className="text-xs text-gray-500 bg-[#F5F0E8] p-3 rounded-lg mt-4 break-all">
              Dev mode (no email provider configured):{" "}
              <a
                href={sent.devResetUrl}
                className="text-[#4A7C8A] font-medium hover:underline"
              >
                reset now
              </a>
            </p>
          )}
          <Link
            href="/login"
            className="mt-6 block w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-2.5 rounded-lg font-semibold transition"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto safe-x py-10 sm:py-16">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-[#2A4A52] text-center mb-3">
          Forgot Password
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Enter your account email and we&apos;ll send you a link to choose a
          new password.
        </p>
        {error && (
          <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="f-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="f-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Remembered it?{" "}
          <Link href="/login" className="text-[#4A7C8A] font-medium hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
