"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import { formatDate } from "@/lib/format-date";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

export default function AdminCustomersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [customers, setCustomers] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const search = (q) => {
    api
      .get(`/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((res) => setCustomers(res.data.customers))
      .catch(() => setError("Failed to load customers."));
  };

  useEffect(() => {
    if (isAdmin) search("");
  }, [isAdmin]);

  const handleSearch = (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    search(query.trim());
  };

  const sendReset = async (customer) => {
    setError("");
    setNotice("");
    try {
      const res = await api.post(`/admin/customers/${customer.id}`);
      setNotice(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send reset link.");
    }
  };

  const remove = async (customer) => {
    if (
      !window.confirm(
        `Delete ${customer.name} (${customer.email})? Their order history is kept as guest records. This can't be undone.`
      )
    )
      return;
    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/customers/${customer.id}`);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      setNotice(`${customer.email} deleted.`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete customer.");
    }
  };

  return (
    <AdminShell title="Customers" backTo="/admin">
      <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-xl">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search customers"
          className={inputClass}
        />
        <button
          type="submit"
          className="shrink-0 bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] text-white px-5 rounded-lg font-semibold transition"
        >
          Search
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-green-700 text-sm bg-green-50 p-3 rounded-lg mb-4"
        >
          {notice}
        </p>
      )}

      {customers === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading customers…</p>
      ) : customers?.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          No customers match that search.
        </p>
      ) : (
        <div className="space-y-3">
          {customers?.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#2A4A52] truncate">
                  {c.name}
                  {!c.emailVerified && (
                    <span className="ml-2 text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                      Unverified
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500 truncate">{c.email}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c._count.orders} {c._count.orders === 1 ? "order" : "orders"}{" "}
                  · joined {formatDate(c.createdAt)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => sendReset(c)}
                  className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
                >
                  Send Password Reset
                </button>
                <button
                  onClick={() => remove(c)}
                  className="min-h-11 px-3 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
