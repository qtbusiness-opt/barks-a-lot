// Client-safe constants (no server imports): the About page photo slots.
// Whitelisted so an arbitrary settings key can never be written.
export const ABOUT_IMAGE_KEYS = [
  {
    key: "about_image_family",
    label: "Meet the Family",
    hint: "Quinn & Nabil",
  },
  {
    key: "about_image_dogs",
    label: "The Inspiration",
    hint: "Meeko & Evee",
  },
  {
    key: "about_image_treats",
    label: "How Barks-A-Lot Began",
    hint: "Home-baked treats",
  },
];

export const ALLOWED_SETTING_KEYS = new Set(
  ABOUT_IMAGE_KEYS.map((k) => k.key)
);
