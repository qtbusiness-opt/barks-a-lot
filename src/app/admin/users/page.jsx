"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

const EMPTY_FORM = { name: "", email: "", password: "" };

export default function AdminUsersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [admins, setAdmins] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/users")
        .then((res) => setAdmins(res.data.admins))
        .catch(() => setError("Failed to load admin accounts."));
    }
  }, [isAdmin]);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await api.post("/admin/users", form);
      setAdmins((prev) => [...(prev ?? []), res.data.admin]);
      setForm(EMPTY_FORM);
      setSuccess(
        `Admin account created for ${res.data.admin.email} — they can log in right away.`
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create admin account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminShell title="Admin Accounts" backTo="/admin">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4 self-start"
        >
          <h2 className="text-xl font-semibold text-[#2A4A52]">New Admin</h2>
          <p className="text-sm text-gray-500">
            Admin accounts can manage products, orders, events,
            announcements, and other admins. No email verification needed —
            they can log in immediately.
          </p>
          {error && (
            <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
          )}
          {success && (
            <p role="status" className="text-green-700 text-sm bg-green-50 p-3 rounded-lg">{success}</p>
          )}
          <div>
            <label htmlFor="u-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="u-name"
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="u-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="u-email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="u-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="u-password"
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
              minLength={8}
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              At least 8 characters, including a letter and a number.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Admin Account"}
          </button>
        </form>

        <div>
          <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">
            Current Admins ({admins?.length ?? "…"})
          </h2>
          {admins === null ? (
            <p className="text-gray-500">Loading admin accounts...</p>
          ) : (
            <div className="space-y-3">
              {admins.map((a) => (
                <div
                  key={a.id}
                  className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#2A4A52] truncate">
                      {a.name}
                      {a.id === user?.id && (
                        <span className="ml-2 text-xs font-medium text-[#4A7C8A]">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{a.email}</p>
                  </div>
                  <p className="text-xs text-gray-500 shrink-0">
                    Since {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
