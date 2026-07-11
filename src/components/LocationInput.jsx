"use client";

import { useEffect, useRef } from "react";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

let mapsPromise = null;

// Load the Google Maps Places library once, shared across all inputs.
function loadPlaces() {
  if (!MAPS_KEY) return Promise.reject(new Error("no key"));
  if (window.google?.maps?.places) return Promise.resolve();
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&loading=async`;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return mapsPromise;
}

// Text input with Google Places address autofill when an API key is
// configured (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY); a plain input otherwise.
export default function LocationInput({ id, value, onChange, className, required }) {
  const inputRef = useRef(null);
  // Keep the latest onChange without re-attaching the autocomplete.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!MAPS_KEY || !inputRef.current) return;
    let autocomplete;
    let cancelled = false;

    loadPlaces()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          { fields: ["formatted_address", "name"] }
        );
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const label =
            place.name && place.formatted_address && !place.formatted_address.includes(place.name)
              ? `${place.name}, ${place.formatted_address}`
              : place.formatted_address || place.name;
          if (label) onChangeRef.current(label);
        });
      })
      .catch(() => {
        // Key missing or script blocked — the plain input still works.
      });

    return () => {
      cancelled = true;
      if (autocomplete) {
        window.google?.maps?.event?.clearInstanceListeners(autocomplete);
      }
    };
  }, []);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={MAPS_KEY ? "Start typing an address..." : ""}
      className={className}
    />
  );
}
