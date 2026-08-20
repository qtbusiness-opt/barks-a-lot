"use client";

import { useEffect, useState } from "react";
import { getPublicConfig } from "@/lib/public-config";

// Map of an event's location. With a Google Maps API key configured
// (resolved at runtime via /api/config) this embeds an interactive map;
// without one it falls back to an open-in-Google-Maps link so the
// feature still works.
export default function EventMap({ location }) {
  // null = key still resolving; "" = no key configured.
  const [mapsKey, setMapsKey] = useState(null);

  useEffect(() => {
    getPublicConfig().then((cfg) => setMapsKey(cfg.mapsApiKey));
  }, []);

  if (!location) return null;
  if (mapsKey === null) return null;

  const query = encodeURIComponent(location);

  if (!mapsKey) {
    return (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#4A7C8A]/40 bg-[#F5F0E8] py-6 text-[#4A7C8A] font-medium hover:border-[#4A7C8A] transition"
      >
        🗺️ Open &ldquo;{location}&rdquo; in Google Maps
      </a>
    );
  }

  // The sandbox grants the embed exactly what a map needs and nothing
  // else. The permission deliberately left out is allow-top-navigation:
  // without a sandbox a framed page can redirect the whole browser tab,
  // so a compromised or spoofed embed could walk a customer off the site
  // mid-checkout. allow-same-origin scopes the frame to *its* own origin
  // (google.com), not ours, so it grants no access to this site.
  return (
    <iframe
      title={`Map of ${location}`}
      src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${query}`}
      className="mt-4 w-full h-64 sm:h-80 rounded-xl border-0"
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
