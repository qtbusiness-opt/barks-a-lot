"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

export default function ContactPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/contact", form);
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.error || "Couldn't send your message. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-xl mx-auto safe-x py-16 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-4">
          Thanks for reaching out!
        </h1>
        <p className="text-gray-600">
          We&rsquo;ve got your message and will get back to you at{" "}
          <span className="font-medium">{form.email}</span> as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto safe-x py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52]">Contact Us</h1>
      <p className="text-gray-600 mt-2 mb-6">
        Questions about an order, an ingredient, or a custom bandana? Send us a
        note and we&rsquo;ll reply by email. You can also reach us directly at{" "}
        <a
          href="mailto:info@barks-a-lot.com"
          className="text-[#4A7C8A] underline hover:text-[#2A4A52]"
        >
          info@barks-a-lot.com
        </a>
        .
      </p>

      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
        <div>
          <label htmlFor="c-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="c-name"
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="c-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="c-email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
            maxLength={200}
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="c-message" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            id="c-message"
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            required
            rows={5}
            maxLength={5000}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send Message"}
        </button>
        {user && (
          <p className="text-xs text-gray-500">
            Sending as {user.name}. Prefer we reply somewhere else? Just change
            the email above.
          </p>
        )}
      </form>
    </div>
  );
}
