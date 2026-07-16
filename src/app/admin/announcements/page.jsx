"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

function AnnouncementRow({ announcement, onSaved, onDeleted, onError }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });

  const startEdit = () => {
    setForm({ title: announcement.title, body: announcement.body });
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const res = await api.patch(
        `/admin/announcements/${announcement.id}`,
        form
      );
      onSaved(res.data.announcement);
      setEditing(false);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to update announcement.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${announcement.title}"?`)) return;
    onError("");
    try {
      await api.delete(`/admin/announcements/${announcement.id}`);
      onDeleted(announcement.id);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to delete announcement.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[#2A4A52]">{announcement.title}</p>
          <p className="text-sm text-gray-600 mt-1">{announcement.body}</p>
        </div>
        <p className="text-xs text-gray-500 shrink-0">
          {new Date(announcement.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex gap-2 mt-3">
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
      {editing && (
        <form onSubmit={save} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              required
              rows={3}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}

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
            <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
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
            {submitting ? "Publishing…" : "Publish Announcement"}
          </button>
        </form>

        <div>
          <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">
            Published ({announcements?.length ?? "…"})
          </h2>
          {announcements === null ? (
            <p className="text-gray-500">Loading announcements…</p>
          ) : announcements.length === 0 ? (
            <p className="text-gray-500">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <AnnouncementRow
                  key={a.id}
                  announcement={a}
                  onSaved={(updated) =>
                    setAnnouncements((prev) =>
                      prev.map((x) => (x.id === updated.id ? updated : x))
                    )
                  }
                  onDeleted={(id) =>
                    setAnnouncements((prev) => prev.filter((x) => x.id !== id))
                  }
                  onError={setError}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
