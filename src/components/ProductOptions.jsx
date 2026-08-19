"use client";

import { useEffect, useRef, useState } from "react";
import { allowsMultiple } from "@/lib/options";
import StoreImage from "@/components/StoreImage";

// Thumbnail (w-16 = 64px) plus the row's gap-3 (12px). One step scrolls
// exactly one thumbnail into view.
const THUMB_STRIDE = 76;

// One option group, rendered the way the admin chose: a dropdown, a
// carousel of thumbnails, radio buttons, or checkboxes. Every variation
// is a real form control with a real label, so all four are keyboard-
// operable and announce themselves the same way.
function OptionGroup({ group, selected, onChange }) {
  // Thumbnails scroll rather than wrap, so a long style list stays one row.
  const [index, setIndex] = useState(0);
  // Declared unconditionally even though only the carousel branch uses it —
  // every branch below is a separate `return`, and hooks can't follow that
  // branching without breaking React's hook-order rule.
  const scrollRef = useRef(null);
  const legendId = `opt-${group.id}-label`;
  const multiple = allowsMultiple(group.inputType);

  // The buttons only move `index`; this is what actually moves the row.
  // No-ops on every non-carousel render, since the ref is never attached.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      left: index * THUMB_STRIDE,
      behavior: "smooth",
    });
  }, [index]);

  const toggle = (choiceId) => {
    if (multiple) {
      onChange(
        selected.includes(choiceId)
          ? selected.filter((c) => c !== choiceId)
          : [...selected, choiceId]
      );
    } else {
      onChange([choiceId]);
    }
  };

  const heading = (
    <>
      {group.name}
      {!group.required && (
        <span className="font-normal text-gray-500"> (optional)</span>
      )}
    </>
  );

  if (group.inputType === "select") {
    return (
      <div className="mt-6">
        <label
          htmlFor={`opt-${group.id}`}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {heading}
        </label>
        <select
          id={`opt-${group.id}`}
          value={selected[0] ?? ""}
          onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-11 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]"
        >
          <option value="">Choose {group.name.toLowerCase()}…</option>
          {group.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (group.inputType === "carousel") {
    const visible = group.choices;
    const step = (delta) =>
      setIndex((i) =>
        Math.min(Math.max(0, i + delta), Math.max(0, visible.length - 1))
      );
    return (
      // min-w-0: browsers give <fieldset> a default min-width of
      // min-content, so without this it refuses to be narrower than the
      // thumbnail row and drags the whole page wider instead of letting
      // the row clip and scroll in place.
      <fieldset className="mt-6 min-w-0">
        <legend
          id={legendId}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {heading}
          {selected[0] && (
            <span className="text-gray-500">
              {" — "}
              {visible.find((c) => c.id === selected[0])?.label}
            </span>
          )}
        </legend>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={index === 0}
            aria-label={`Scroll ${group.name} choices left`}
            className="shrink-0 h-11 w-8 rounded-lg border border-gray-300 text-[#4A7C8A] disabled:opacity-30"
          >
            ‹
          </button>
          {/* min-w-0: a flex child won't shrink below its content's
              intrinsic width otherwise, so the whole row (and page) would
              stretch wider instead of clipping and scrolling in place. */}
          <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-auto">
            <div className="flex gap-3 py-1">
              {visible.map((choice) => {
                const isOn = selected.includes(choice.id);
                return (
                  <label
                    key={choice.id}
                    className={`shrink-0 cursor-pointer rounded-lg border-2 p-1 text-center transition ${
                      isOn
                        ? "border-[#4A7C8A] bg-[#F5F0E8]"
                        : "border-transparent hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`opt-${group.id}`}
                      value={choice.id}
                      checked={isOn}
                      onChange={() => toggle(choice.id)}
                      className="sr-only peer"
                    />
                    <span className="block w-16 h-16 rounded-md overflow-hidden bg-[#F5F0E8] peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-[#C8722A]">
                      {choice.image ? (
                        <StoreImage
                          src={choice.image}
                          alt=""
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex h-full items-center justify-center text-xs text-gray-400"
                        >
                          {choice.label.slice(0, 2)}
                        </span>
                      )}
                    </span>
                    <span className="block w-16 truncate text-xs mt-1 text-[#2A4A52]">
                      {choice.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={index >= visible.length - 1}
            aria-label={`Scroll ${group.name} choices right`}
            className="shrink-0 h-11 w-8 rounded-lg border border-gray-300 text-[#4A7C8A] disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </fieldset>
    );
  }

  // radio + checkbox share a layout; only the control type differs.
  return (
    <fieldset className="mt-6">
      <legend className="block text-sm font-medium text-gray-700 mb-2">
        {heading}
      </legend>
      <div className="space-y-2">
        {group.choices.map((choice) => {
          const isOn = selected.includes(choice.id);
          return (
            <label
              key={choice.id}
              className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition ${
                isOn ? "border-[#4A7C8A] bg-[#F5F0E8]" : "border-gray-300"
              }`}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={`opt-${group.id}`}
                value={choice.id}
                checked={isOn}
                onChange={() => toggle(choice.id)}
              />
              <span className="text-sm font-medium text-[#2A4A52]">
                {choice.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function ProductOptions({ groups, selections, onChange }) {
  if (!groups?.length) return null;
  return (
    <>
      {groups.map((group) => (
        <OptionGroup
          key={group.id}
          group={group}
          selected={selections[group.id] ?? []}
          onChange={(choiceIds) =>
            onChange({ ...selections, [group.id]: choiceIds })
          }
        />
      ))}
    </>
  );
}
