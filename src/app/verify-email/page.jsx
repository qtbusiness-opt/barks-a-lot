"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // A link without a token can never verify — start in the error state.
  const [status, setStatus] = useState(token ? "verifying" : "error");
  const [message, setMessage] = useState("");
  // React 18+ dev runs effects twice; the token is single-use, so make
  // sure we only consume it once.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    api
      .post("/auth/verify", { token })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.error || "");
      });
  }, [token]);

  return (
    <div className="max-w-md mx-auto safe-x py-10 sm:py-16">
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        {status === "verifying" ? (
          <>
            <div className="text-4xl mb-3">⏳</div>
            <h1 className="text-2xl font-bold text-[#2A4A52]">
              Verifying your email...
            </h1>
          </>
        ) : status === "success" ? (
          <>
            <div className="text-4xl mb-3">🎉</div>
            <h1 className="text-2xl font-bold text-[#2A4A52] mb-3">
              Email Verified!
            </h1>
            <p className="text-gray-600 mb-6">
              Your account is ready — log in to start shopping.
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-3 rounded-lg font-semibold transition"
            >
              Log In
            </Link>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">😕</div>
            <h1 className="text-2xl font-bold text-[#2A4A52] mb-3">
              Verification Failed
            </h1>
            <p className="text-gray-600 mb-6">
              {message || "This verification link is invalid or has expired."}{" "}
              You can request a fresh link from the login page.
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-3 rounded-lg font-semibold transition"
            >
              Go to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto safe-x py-16 text-center text-gray-500">
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
