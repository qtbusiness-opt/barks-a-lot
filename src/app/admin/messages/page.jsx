"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

function MessageCard({ message, onChanged, onDeleted, onError }) {
  const [busy, setBusy] = useState(false);
  const isRead = Boolean(message.readAt);

  const toggleRead = async () => {
    setBusy(true);
    onError("");
    try {
      const res = await api.patch(`/admin/messages/${message.id}`, {
        read: !isRead,
      });
      onChanged(res.data.message);
    } catch {
      onError("Failed to update the message.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this message?")) return;
    onError("");
    try {
      await api.delete(`/admin/messages/${message.id}`);
      onDeleted(message.id);
    } catch {
      onError("Failed to delete the message.");
    }
  };

  return (
    <div
      className={`rounded-xl shadow-sm p-4 ${
        isRead ? "bg-white" : "bg-[#F5F0E8] border-l-4 border-[#C8722A]"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[#2A4A52]">
            {message.name}
            {!isRead && (
              <span className="ml-2 inline-block bg-[#C8722A] text-white text-xs rounded-full px-2 py-0.5 font-medium align-middle">
                New
              </span>
            )}
          </p>
          <a
            href={`mailto:${message.email}`}
            className="text-sm text-[#4A7C8A] hover:underline"
          >
            {message.email}
          </a>
        </div>
        <p className="text-xs text-gray-500 shrink-0">
          {new Date(message.createdAt).toLocaleString()}
        </p>
      </div>
      <p className="text-sm text-gray-700 mt-3 whitespace-pre-line">
        {message.message}
      </p>
      <div className="flex gap-2 mt-4">
        <a
          href={`mailto:${message.email}`}
          className="min-h-11 px-3 flex items-center rounded-lg text-sm font-medium bg-[#4A7C8A] text-white hover:bg-[#3A6270] transition"
        >
          Reply
        </a>
        <button
          onClick={toggleRead}
          disabled={busy}
          className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition disabled:opacity-50"
        >
          {isRead ? "Mark unread" : "Mark read"}
        </button>
        <button
          onClick={remove}
          className="min-h-11 px-3 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-500 hover:text-white transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/messages")
        .then((res) => setMessages(res.data.messages))
        .catch(() => setError("Failed to load messages."));
    }
  }, [isAdmin]);

  const unread = messages?.filter((m) => !m.readAt).length ?? 0;

  return (
    <AdminShell title="Messages" backTo="/admin">
      <p className="text-sm text-gray-500 mb-6 -mt-4">
        Messages sent through the Contact Us form
        {unread > 0 ? ` — ${unread} unread.` : "."}
      </p>
      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">
          {error}
        </p>
      )}

      {messages === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading messages…</p>
      ) : messages?.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          No messages yet — they appear here when someone uses the Contact Us
          form.
        </p>
      ) : (
        <div className="space-y-3">
          {messages?.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              onChanged={(updated) =>
                setMessages((prev) =>
                  prev.map((x) => (x.id === updated.id ? updated : x))
                )
              }
              onDeleted={(id) =>
                setMessages((prev) => prev.filter((x) => x.id !== id))
              }
              onError={setError}
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
