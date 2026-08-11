"use client";

import ImageUpload from "@/components/ImageUpload";
import { OPTION_INPUT_TYPES, OPTION_INPUT_LABELS } from "@/lib/options";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

const MAX_GROUPS = 6;
const MAX_CHOICES = 20;

const emptyGroup = () => ({
  name: "",
  inputType: "radio",
  required: true,
  choices: [{ label: "", image: null }],
});

// Builds a product's option groups — e.g. a bandana's Size and Style —
// and picks how each one is presented on the product page. Groups carry
// no price or stock; they're the customer's choices, recorded on the
// order. Use variants when the price or stock actually differs.
export default function OptionGroupsEditor({ groups, onChange, idSuffix }) {
  const setGroup = (index, patch) =>
    onChange(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));

  const setChoice = (gi, ci, patch) =>
    setGroup(gi, {
      choices: groups[gi].choices.map((c, i) =>
        i === ci ? { ...c, ...patch } : c
      ),
    });

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-1">
        Product Options (optional)
      </legend>
      <p className="text-xs text-gray-500 mb-2">
        Choices the customer picks on the product page, like Size and Style. For
        things that change the price or have their own stock, use options with
        prices instead.
      </p>

      <div className="space-y-4">
        {groups.map((group, gi) => (
          <div
            key={gi}
            className="border border-gray-200 rounded-lg p-3 space-y-3"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={group.name}
                onChange={(e) => setGroup(gi, { name: e.target.value })}
                aria-label={`Option name, group ${gi + 1}`}
                placeholder="Size"
                maxLength={60}
                className={`${inputClass} flex-1 py-2`}
              />
              <button
                type="button"
                onClick={() => onChange(groups.filter((_, i) => i !== gi))}
                aria-label={`Remove option group ${gi + 1}`}
                className="shrink-0 h-11 w-11 rounded-lg border border-red-300 text-red-500 hover:bg-red-500 hover:text-white transition"
              >
                ×
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-gray-600">
                Shown as{" "}
                <select
                  value={group.inputType}
                  onChange={(e) => setGroup(gi, { inputType: e.target.value })}
                  aria-label={`How group ${gi + 1} is shown`}
                  className="border border-gray-300 rounded-lg px-2 py-2 min-h-11 text-sm"
                >
                  {OPTION_INPUT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {OPTION_INPUT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 min-h-11 cursor-pointer text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={group.required}
                  onChange={(e) => setGroup(gi, { required: e.target.checked })}
                />
                Must be chosen
              </label>
              {group.inputType === "checkbox" && (
                <span className="text-xs text-gray-500">
                  Customers can pick more than one.
                </span>
              )}
            </div>

            <div className="space-y-2">
              {group.choices.map((choice, ci) => (
                <div key={ci} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={choice.label}
                    onChange={(e) =>
                      setChoice(gi, ci, { label: e.target.value })
                    }
                    aria-label={`Choice ${ci + 1} of ${group.name || `group ${gi + 1}`}`}
                    placeholder="Large"
                    maxLength={80}
                    className={`${inputClass} flex-1 py-2`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGroup(gi, {
                        choices: group.choices.filter((_, i) => i !== ci),
                      })
                    }
                    disabled={group.choices.length === 1}
                    aria-label={`Remove choice ${ci + 1}`}
                    className="shrink-0 h-11 w-11 rounded-lg border border-red-300 text-red-500 hover:bg-red-500 hover:text-white transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Thumbnails only mean something for the carousel. */}
              {group.inputType === "carousel" && (
                <div className="pl-1 space-y-2">
                  {group.choices.map((choice, ci) => (
                    <div key={ci} className="flex items-center gap-3">
                      {choice.image ? (
                        <img
                          src={choice.image}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover bg-[#F5F0E8] shrink-0"
                        />
                      ) : (
                        <span className="w-12 h-12 rounded-lg bg-[#F5F0E8] shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <ImageUpload
                          value=""
                          label={`Photo for ${choice.label || `choice ${ci + 1}`}`}
                          onChange={(url) => setChoice(gi, ci, { image: url })}
                        />
                      </div>
                      {choice.image && (
                        <button
                          type="button"
                          onClick={() => setChoice(gi, ci, { image: null })}
                          className="shrink-0 min-h-11 px-2 text-xs text-red-500 hover:underline"
                        >
                          Remove photo
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {group.choices.length < MAX_CHOICES && (
                <button
                  type="button"
                  onClick={() =>
                    setGroup(gi, {
                      choices: [...group.choices, { label: "", image: null }],
                    })
                  }
                  className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition"
                >
                  + Add choice
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {groups.length < MAX_GROUPS && (
        <button
          type="button"
          id={`add-option-group-${idSuffix}`}
          onClick={() => onChange([...groups, emptyGroup()])}
          className="mt-3 min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition"
        >
          + Add option
        </button>
      )}
    </fieldset>
  );
}
