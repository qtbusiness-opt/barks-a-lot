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
  // True once the Places script is on the page and safe to construct from.
  const [placesReady, setPlacesReady] = useState(false);
  // Keep the latest onChange without re-attaching the autocomplete.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let cancelled = false;
    getPublicConfig().then((cfg) => {
      if (!cancelled) setMapsKey(cfg.mapsApiKey);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Loading the script is kept in its own effect so the effect that
  // subscribes below can do all its work synchronously. An `await` before
  // a subscription means the cleanup can run before the subscription
  // exists — the leak that shape invites is easy to write and hard to see.
  useEffect(() => {
    if (!mapsKey) return undefined;
    let cancelled = false;
    loadPlaces(mapsKey)
      .then(() => {
        if (!cancelled) setPlacesReady(true);
      })
      .catch(() => {
        // Key rejected or script blocked — the plain input still works.
      });
    return () => {
      cancelled = true;
    };
  }, [mapsKey]);

  useEffect(() => {
    if (!placesReady || !inputRef.current) return undefined;
    const input = inputRef.current;

    // Places appends its suggestion dropdown to <body>, outside React's
    // tree, and never takes it away. Anything already there belongs to
    // another input still on the page — only ours gets removed.
    const existingDropdowns = new Set(
      document.querySelectorAll(".pac-container")
    );

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      fields: ["formatted_address", "name"],
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const label =
        place.name &&
        place.formatted_address &&
        !place.formatted_address.includes(place.name)
          ? `${place.name}, ${place.formatted_address}`
          : place.formatted_address || place.name;
      if (label) onChangeRef.current(label);
    });
    const dropdowns = [...document.querySelectorAll(".pac-container")].filter(
      (node) => !existingDropdowns.has(node)
    );

    return () => {
      // The handle Places hands back is its documented unsubscribe.
      listener.remove();
      const mapsEvent = window.google?.maps?.event;
      mapsEvent?.clearInstanceListeners(autocomplete);
      // Places also binds focus/keydown handlers straight to the input,
      // which would otherwise keep the removed node alive.
      mapsEvent?.clearInstanceListeners(input);
      dropdowns.forEach((node) => node.remove());
    };
  }, [placesReady]);

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
