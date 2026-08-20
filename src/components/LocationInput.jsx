"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicConfig } from "@/lib/public-config";

let mapsPromise = null;

// Load the Google Maps Places library once, shared across all inputs.
// Resolves only when places.Autocomplete is actually constructible, so
// every caller can treat a resolved promise as "safe to build from" and
// a rejected one as "stay a plain input".
function loadPlaces(mapsKey) {
  if (!mapsKey) return Promise.reject(new Error("no key"));
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      // The bootstrap is already on the page from an earlier mount.
      if (window.google?.maps) return resolve();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        mapsKey
      )}&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("maps script blocked"));
      document.head.appendChild(script);
    })
      // loading=async is why this second step exists. The script's onload
      // only says the bootstrap loader ran; the libraries it names are
      // still in flight, so google.maps.places is undefined for a moment
      // afterwards. importLibrary is the documented way to wait for one,
      // and it populates google.maps.places for the constructor below.
      .then(() => window.google.maps.importLibrary?.("places"))
      .then(() => {
        // A key can load the API without entitling this widget, so prove
        // the constructor exists rather than assuming it.
        if (!window.google?.maps?.places?.Autocomplete) {
          throw new Error("places autocomplete unavailable");
        }
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
    // loadPlaces already proved this exists; re-reading it here keeps the
    // component incapable of throwing during render-time effects, which
    // is what turned a missing Places library into a blank error page
    // instead of the plain input this is supposed to fall back to.
    const Autocomplete = window.google?.maps?.places?.Autocomplete;
    if (!Autocomplete) return undefined;
    const input = inputRef.current;

    // Places appends its suggestion dropdown to <body>, outside React's
    // tree, and never takes it away. Anything already there belongs to
    // another input still on the page — only ours gets removed.
    const existingDropdowns = new Set(
      document.querySelectorAll(".pac-container")
    );

    const autocomplete = new Autocomplete(input, {
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
