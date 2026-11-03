"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

// The events page's "+ Add Event" shortcut, for admins only. A client
// component because the session lives in the auth context.
export default function AddEventButton() {
  const { user } = useAuth();
  if (user?.role !== "admin") return null;
  return (
    <Link
      href="/admin/events/new"
      className="bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white px-4 py-2.5 rounded-lg font-semibold transition"
    >
      + Add Event
    </Link>
  );
}
