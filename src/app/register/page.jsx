"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(null);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await register(name, email, password);
      setRegistered(data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Registration failed. Email may already be in use."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResent(false);
    try {
      await api.post("/auth/resend-verification", { email });
      setResent(true);
    } catch {
      setError("Couldn't resend the email — please try again in a minute.");
    }
  };

  if (registered) {
    return (
      <div className="max-w-md mx-auto safe-x py-10 sm:py-16">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="text-4xl mb-3">📬</div>
          <h1 className="text-2xl font-bold text-[#2A4A52] mb-3">
            Check Your Email
          </h1>
          <p className="text-gray-600">
            We sent a verification link to{" "}
            <span className="font-semibold text-[#2A4A52]">{email}</span>.
            Click it to activate your account, then log in.
          </p>
          {registered.devVerificationUrl && (
            <p className="text-xs text-gray-500 bg-[#F5F0E8] p-3 rounded-lg mt-4 break-all">
              Dev mode (no email provider configured):{" "}
              <a
                href={registered.devVerificationUrl}
                className="text-[#4A7C8A] font-medium hover:underline"
              >
                verify now
              </a>
            </p>
          )}
          {resent && (
            <p role="status" className="text-green-700 text-sm bg-green-50 p-3 rounded-lg mt-4">
              A new verification link is on its way.
            </p>
          )}
          {error && (
            <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mt-4">{error}</p>
          )}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleResend}
              className="w-full border-2 border-[#4A7C8A] text-[#4A7C8A] py-2.5 rounded-lg font-semibold hover:bg-[#4A7C8A] hover:text-white transition"
            >
              Resend Verification Email
            </button>
            <Link
              href="/login"
              className="block w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-2.5 rounded-lg font-semibold transition"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto safe-x py-10 sm:py-16">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-[#2A4A52] text-center mb-6">
          Create Account
        </h1>
        {error && (
          <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="r-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="r-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="r-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="r-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="r-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="r-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#4A7C8A] font-medium hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
