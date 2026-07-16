"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import ImageUpload from "@/components/ImageUpload";
import { ABOUT_IMAGE_KEYS } from "@/lib/about-images";

export default function AdminAboutPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/site-settings")
        .then((res) => setSettings(res.data.settings))
        .catch(() => setError("Failed to load the About Page settings."));
    }
  }, [isAdmin]);

  const save = async (key, value) => {
    setError("");
    setNotice("");
    // Optimistic update.
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await api.patch("/admin/site-settings", { key, value });
      setNotice(value ? "Photo updated." : "Photo removed.");
    } catch {
      setError("Failed to save the photo.");
    }
  };

  return (
    <AdminShell title="About Page" backTo="/admin">
      <p className="text-sm text-gray-500 mb-6 -mt-4">
        Photos shown on the public{" "}
        <a href="/about" className="text-[#4A7C8A] underline" target="_blank" rel="noreferrer">
          About Us
        </a>{" "}
        page. Each section shows its placeholder until you add a photo.
      </p>

      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-green-700 text-sm bg-green-50 p-3 rounded-lg mb-4">
          {notice}
        </p>
      )}

      {settings === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading...</p>
      ) : (
        <div className="space-y-6 max-w-xl">
          {ABOUT_IMAGE_KEYS.map((slot) => {
            const value = settings?.[slot.key] ?? "";
            return (
              <div key={slot.key} className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-[#2A4A52]">
                  {slot.label}
                </h2>
                <p className="text-xs text-gray-500 mb-3">Suggested: {slot.hint}</p>
                <ImageUpload
                  value={value}
                  label="Section photo"
                  onChange={(url) => save(slot.key, url)}
                />
                {value && (
                  <button
                    onClick={() => save(slot.key, "")}
                    className="mt-3 text-sm text-red-500 underline hover:text-red-600"
                  >
                    Remove photo (show placeholder)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
