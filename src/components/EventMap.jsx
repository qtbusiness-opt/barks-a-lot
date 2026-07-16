"use client";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Map of an event's location. With a Google Maps API key configured this
// embeds an interactive map; without one it falls back to an
// open-in-Google-Maps link so the feature still works.
export default function EventMap({ location }) {
  if (!location) return null;

  const query = encodeURIComponent(location);

  if (!MAPS_KEY) {
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

  return (
    <iframe
      title={`Map of ${location}`}
      src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${query}`}
      className="mt-4 w-full h-64 sm:h-80 rounded-xl border-0"
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
