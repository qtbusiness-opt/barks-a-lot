"use client";

import { useRef, useState } from "react";

// Product image picker: click to browse or drag & drop. Uploads to the
// admin uploads API and hands the served URL back to the form.
export default function ImageUpload({ value, onChange, label = "Product image" }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Plain fetch: the shared axios instance forces a JSON content type,
      // but multipart needs the browser-set boundary header.
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label={`Upload — ${label}`}
        className={`w-full flex items-center gap-4 rounded-xl border-2 border-dashed p-4 text-left transition ${
          dragging
            ? "border-[#C8722A] bg-[#C8722A]/5"
            : "border-[#4A7C8A]/40 hover:border-[#4A7C8A] bg-[#F5F0E8]/50"
        }`}
      >
        {value ? (
          <img
            src={value}
            alt="Product preview"
            className="w-16 h-16 rounded-lg object-cover bg-[#F5F0E8] shrink-0"
          />
        ) : (
          <span className="flex items-center justify-center w-16 h-16 rounded-lg bg-[#F5F0E8] text-2xl shrink-0">
            🖼️
          </span>
        )}
        <span className="min-w-0">
          <span className="block font-medium text-[#4A7C8A]">
            {uploading
              ? "Uploading..."
              : dragging
              ? "Drop it here!"
              : value
              ? "Click or drop a new image to replace"
              : "Click to upload, or drag & drop"}
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">
            PNG, JPEG, WebP, or GIF · up to 5 MB
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-2 rounded-lg mt-2">{error}</p>
      )}
    </div>
  );
}
