"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicConfig } from "@/lib/public-config";

let mapsPromise = null;

// Load the Google Maps Places library once, shared across all inputs.
function loadPlaces(mapsKey) {
  if (!mapsKey) return Promise.reject(new Error("no key"));
  if (window.google?.maps?.places) return Promise.resolve();
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places&loading=async`;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return mapsPromise;
}

// Text input with Google Places address autofill when a Maps API key is
// configured (resolved at runtime via /api/config); a plain input
// otherwise.
export default function LocationInput({
  id,
  value,
  onChange,
  className,
  required,
}) {
  const inputRef = useRef(null);
  // "" while resolving or unconfigured — the plain input works either way.
  const [mapsKey, setMapsKey] = useState("");
  // Keep the latest onChange without re-attaching the autocomplete.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    getPublicConfig().then((cfg) => setMapsKey(cfg.mapsApiKey));
  }, []);

  useEffect(() => {
    if (!mapsKey || !inputRef.current) return undefined;
    let autocomplete;
    let cancelled = false;

    loadPlaces(mapsKey)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          { fields: ["formatted_address", "name"] }
        );
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const label =
            place.name &&
            place.formatted_address &&
            !place.formatted_address.includes(place.name)
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
  }, [mapsKey]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={mapsKey ? "Start typing an address…" : ""}
      className={className}
    />
  );
}
