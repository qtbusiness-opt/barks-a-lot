"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { SHIPPING_ENABLED } from "@/lib/features";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

function AddressRow({ addr, onSaved, onDeleted, onError }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const startEdit = () => {
    setForm({
      address: addr.address,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
    });
    setEditing(true);
  };

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const res = await api.patch(`/profile/addresses/${addr.id}`, form);
      onSaved(res.data.address);
      setEditing(false);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to update address.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove this address from your address book?")) return;
    onError("");
    try {
      await api.delete(`/profile/addresses/${addr.id}`);
      onDeleted(addr.id);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to delete address.");
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#2A4A52]">
          {addr.address}, {addr.city}, {addr.state} {addr.zip}
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={editing ? () => setEditing(false) : startEdit}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            onClick={remove}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition"
          >
            Delete
          </button>
        </div>
      </div>
      {editing && form && (
        <form onSubmit={save} className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          <input
            type="text"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            aria-label="Street address"
            required
            className={inputClass}
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              aria-label="City"
              required
              className={inputClass}
            />
            <input
              type="text"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              aria-label="State"
              required
              className={inputClass}
            />
            <input
              type="text"
              value={form.zip}
              onChange={(e) => update("zip", e.target.value)}
              aria-label="ZIP code"
              required
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-2.5 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Address"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const { update: updateSession } = useSession();
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (user) {
      api
        .get("/profile")
        .then((res) => {
          setProfile(res.data);
          setName(res.data.user.name);
        })
        .catch(() => setError("Failed to load your profile."));
    }
  }, [user]);

  if (loading || (user && profile === null && !error)) {
    return (
      <div className="max-w-2xl mx-auto safe-x py-20 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto safe-x py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">My Profile</h1>
        <p className="text-gray-500 mb-6">Please log in to view your profile.</p>
        <Link
          href="/login"
          className="inline-block bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Log In
        </Link>
      </div>
    );
  }

  const isCustomer = profile?.user.role === "customer";

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    setError("");
    setNotice("");
    try {
      const res = await api.patch("/profile", { name });
      setProfile((prev) => ({ ...prev, user: res.data.user }));
      // Reflect the new name in the live session (navbar greeting).
      await updateSession({ name: res.data.user.name });
      setEditingName(false);
      setNotice("Name updated.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update your name.");
    } finally {
      setSavingName(false);
    }
  };

  const sendReset = async () => {
    setError("");
    setNotice("");
    try {
      await api.post("/auth/forgot-password", { email: profile.user.email });
      setNotice(
        `Password reset link sent to ${profile.user.email} — it expires in 1 hour.`
      );
    } catch {
      setError("Couldn't send the reset email — please try again in a minute.");
    }
  };

  const deleteAccount = async () => {
    if (
      !window.confirm(
        "Delete your account? This removes your profile and login permanently and can't be undone. Records of past orders are kept for our bookkeeping."
      )
    ) {
      return;
    }
    setError("");
    setDeleting(true);
    try {
      await api.delete("/profile");
      // The account is gone — end the session and head home.
      logout();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete your account.");
      setDeleting(false);
    }
  };

  const summary = profile?.orderSummary;

  return (
    <div className="max-w-2xl mx-auto safe-x py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-6 sm:mb-8">
        My Profile
      </h1>

      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</p>
      )}
      {notice && (
        <p role="status" className="text-green-700 text-sm bg-green-50 p-3 rounded-lg mb-4">{notice}</p>
      )}

      <div className="space-y-6">
        {/* Account card */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">Account</h2>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-500">Name</p>
              {editingName ? null : (
                <p className="text-[#2A4A52] font-semibold">{profile.user.name}</p>
              )}
            </div>
            {!editingName && (
              <button
                onClick={() => setEditingName(true)}
                className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition"
              >
                Edit
              </button>
            )}
          </div>
          {editingName && (
            <form onSubmit={saveName} className="flex gap-2 mb-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Name"
                required
                className={inputClass}
              />
              <button
                type="submit"
                disabled={savingName}
                className="shrink-0 bg-[#4A7C8A] hover:bg-[#3A6270] text-white px-4 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {savingName ? "…" : "Save"}
              </button>
            </form>
          )}

          <div className="mb-4">
            <p className="text-sm font-medium text-gray-500">Email</p>
            <p className="text-[#2A4A52]">{profile.user.email}</p>
          </div>

          <button
            onClick={sendReset}
            className="w-full sm:w-auto border-2 border-[#C8722A] text-[#C8722A] px-4 py-2.5 rounded-lg font-semibold hover:bg-[#C8722A] hover:text-white transition"
          >
            Send Password Reset Email
          </button>
        </div>

        {/* Orders summary — customers only */}
        {isCustomer && summary && (
          <Link
            href="/orders"
            className="block bg-white rounded-xl shadow-sm p-4 sm:p-6 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#2A4A52]">
                My Orders ({summary.total})
              </h2>
              <span className="text-[#4A7C8A] font-medium text-sm">
                View all &rarr;
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-700">{summary.pending}</p>
                <p className="text-xs font-medium text-yellow-700">Pending</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-700">{summary.shipped}</p>
                <p className="text-xs font-medium text-blue-700">
                  {ORDER_STATUS_LABELS.shipped}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-700">{summary.delivered}</p>
                <p className="text-xs font-medium text-green-700">
                  {ORDER_STATUS_LABELS.delivered}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-700">{summary.cancelled}</p>
                <p className="text-xs font-medium text-red-700">Cancelled</p>
              </div>
            </div>
          </Link>
        )}

        {/* Address book — customers only; hidden while the store is
            pickup-only since no addresses are recorded. */}
        {isCustomer && SHIPPING_ENABLED && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-[#2A4A52] mb-1">
              Shipping Addresses
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Addresses you&rsquo;ve shipped orders to. Removing one here
              doesn&rsquo;t change past orders.
            </p>
            {profile.addresses.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No addresses yet — they&rsquo;re saved automatically when you
                place a shipping order.
              </p>
            ) : (
              <div className="space-y-3">
                {profile.addresses.map((addr) => (
                  <AddressRow
                    key={addr.id}
                    addr={addr}
                    onSaved={(updated) =>
                      setProfile((prev) => ({
                        ...prev,
                        addresses: prev.addresses.map((a) =>
                          a.id === updated.id ? updated : a
                        ),
                      }))
                    }
                    onDeleted={(id) =>
                      setProfile((prev) => ({
                        ...prev,
                        addresses: prev.addresses.filter((a) => a.id !== id),
                      }))
                    }
                    onError={setError}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Danger zone — customers can close their own account. */}
        {isCustomer && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-red-200">
            <h2 className="text-xl font-semibold text-red-600 mb-1">
              Delete Account
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Permanently removes your profile and login. Past order records
              are kept for our bookkeeping (required for taxes), but they
              will no longer be linked to an account.
            </p>
            <button
              onClick={deleteAccount}
              disabled={deleting}
              className="w-full sm:w-auto border-2 border-red-400 text-red-500 px-4 py-2.5 rounded-lg font-semibold hover:bg-red-500 hover:border-red-500 hover:text-white transition disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete My Account"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
