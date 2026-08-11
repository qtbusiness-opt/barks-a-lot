"use client";

import { useState } from "react";
import { allowsMultiple } from "@/lib/options";

// One option group, rendered the way the admin chose: a dropdown, a
// carousel of thumbnails, radio buttons, or checkboxes. Every variation
// is a real form control with a real label, so all four are keyboard-
// operable and announce themselves the same way.
function OptionGroup({ group, selected, onChange }) {
  // Thumbnails scroll rather than wrap, so a long style list stays one row.
  const [index, setIndex] = useState(0);
  const legendId = `opt-${group.id}-label`;
  const multiple = allowsMultiple(group.inputType);

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
      <fieldset className="mt-6">
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
          <div className="flex-1 overflow-x-auto">
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
                        <img
                          src={choice.image}
                          alt=""
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
