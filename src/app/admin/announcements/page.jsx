"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [announcements, setAnnouncements] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/announcements")
        .then((res) => setAnnouncements(res.data.announcements))
        .catch(() => setError("Failed to load announcements."));
    }
  }, [isAdmin]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post("/admin/announcements", { title, body });
      setAnnouncements((prev) => [res.data.announcement, ...(prev ?? [])]);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminShell title="Announcements" backTo="/admin">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4 self-start"
        >
          <h2 className="text-xl font-semibold text-[#2A4A52]">
            New Announcement
          </h2>
          <p className="text-sm text-gray-500">
            The most recent announcement appears as a banner on the
            storefront homepage.
          </p>
          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
          )}
          <div>
            <label htmlFor="a-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              id="a-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="a-body" className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              id="a-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {submitting ? "Publishing..." : "Publish Announcement"}
          </button>
        </form>

        <div>
          <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">
            Published ({announcements?.length ?? "…"})
          </h2>
          {announcements === null ? (
            <p className="text-gray-500">Loading announcements...</p>
          ) : announcements.length === 0 ? (
            <p className="text-gray-500">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-semibold text-[#2A4A52]">{a.title}</p>
                    <p className="text-xs text-gray-400 shrink-0">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{a.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
