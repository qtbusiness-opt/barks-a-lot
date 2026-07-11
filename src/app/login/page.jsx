"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setUnverified(false);
    setResent(false);
    setLoading(true);
    try {
      const user = await login(email, password);
      router.push(user?.role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(err.message || "Invalid email or password");
      setUnverified(err.code === "email-unverified");
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

  return (
    <div className="max-w-md mx-auto safe-x py-10 sm:py-16">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-[#2A4A52] text-center mb-6">
          Welcome Back
        </h1>
        {error && (
          <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</p>
        )}
        {unverified && (
          <button
            type="button"
            onClick={handleResend}
            className="w-full border-2 border-[#C8722A] text-[#C8722A] py-2.5 rounded-lg font-semibold hover:bg-[#C8722A] hover:text-white transition mb-4"
          >
            Resend Verification Email
          </button>
        )}
        {resent && (
          <p className="text-green-700 text-sm bg-green-50 p-3 rounded-lg mb-4">
            A new verification link is on its way — check your inbox.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="l-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="l-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="l-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="l-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[#4A7C8A] font-medium hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
