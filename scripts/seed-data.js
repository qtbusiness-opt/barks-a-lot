module.exports = [
  {
    name: "Peanut Butter Biscuits",
    description:
      "Crunchy, all-natural peanut butter biscuits made with whole wheat flour and real peanut butter. A classic treat your dog will love!",
    // Stock lives on the option combinations below (trackOptionStock).
    quantity: 0,
    price: 12.99,
    image: "/images/products/peanut-butter-biscuits.svg",
    images: JSON.stringify([
      "/images/products/sweet-potato-chews.svg",
      "/images/products/chicken-jerky.svg",
    ]),
    itemDetails:
      "Whole wheat flour, natural peanut butter (no xylitol), eggs, honey, baking powder. Grain-free bags use chickpea flour instead of wheat.",
    nutritionFacts: JSON.stringify([
      { label: "Crude Protein (min)", value: "9%" },
      { label: "Crude Fat (min)", value: "8%" },
      { label: "Crude Fiber (max)", value: "4%" },
      { label: "Moisture (max)", value: "12%" },
      { label: "Calories", value: "32 kcal per biscuit" },
    ]),
    category: "treats",
    featured: true,
    trackOptionStock: true,
    optionGroups: [
      {
        name: "Bag Size",
        inputType: "radio",
        required: true,
        setsPrice: true,
        choices: [
          { label: "Small (8 oz)", price: 12.99 },
          { label: "Large (16 oz)", price: 21.99 },
        ],
      },
      {
        name: "Recipe",
        inputType: "radio",
        required: true,
        choices: [{ label: "Classic" }, { label: "Grain-Free" }],
      },
    ],
    // Stock per combination, keyed the same way the write path names one
    // ("<choice> / <choice>" in group order) — see seed-products.js.
    variantStock: {
      "Small (8 oz) / Classic": 60,
      "Small (8 oz) / Grain-Free": 25,
      "Large (16 oz) / Classic": 30,
      "Large (16 oz) / Grain-Free": 15,
    },
  },
  {
    name: "Sweet Potato Chews",
    description:
      "Dehydrated sweet potato slices that are naturally sweet and packed with vitamins. A healthy, grain-free chewing snack.",
    quantity: 50,
    price: 9.99,
    image: "/images/products/sweet-potato-chews.svg",
    category: "treats",
    featured: true,
  },
  {
    name: "Salmon Training Treats",
    description:
      "Bite-sized, soft salmon treats perfect for training sessions. Rich in omega-3 fatty acids for a healthy coat.",
    quantity: 20,
    price: 14.99,
    image: "/images/products/salmon-treats.svg",
    category: "treats",
    featured: false,
  },
  {
    name: "Chicken Jerky Strips",
    description:
      "Premium chicken breast jerky, slow-dried to perfection. No fillers, no artificial preservatives — just pure chicken.",
    quantity: 30,
    price: 16.99,
    image: "/images/products/chicken-jerky.svg",
    nutritionFacts: JSON.stringify([
      { label: "Crude Protein (min)", value: "68%" },
      { label: "Crude Fat (min)", value: "4%" },
      { label: "Crude Fiber (max)", value: "1%" },
      { label: "Moisture (max)", value: "18%" },
      { label: "Calories", value: "45 kcal per strip" },
    ]),
    category: "treats",
    featured: true,
  },
  {
    name: "Rope Tug Toy",
    optionGroups: [
      {
        name: "Rope Size",
        inputType: "radio",
        choices: [{ label: "Standard" }, { label: "Chunky" }],
      },
      {
        name: "Add-ons",
        inputType: "checkbox",
        required: false,
        choices: [{ label: "Gift wrap" }, { label: "Personalised name tag" }],
      },
    ],
    description:
      "Durable, multi-colored cotton rope toy perfect for tug-of-war. Helps clean teeth while your pup plays!",
    quantity: 15,
    price: 8.99,
    image: "/images/products/rope-toy.svg",
    category: "toys",
    featured: false,
  },
  {
    name: "Squeaky Bone Toy",
    description:
      "A classic squeaky bone made from durable, non-toxic rubber. Hours of squeaky fun for your furry friend.",
    quantity: 25,
    price: 6.99,
    image: "/images/products/squeaky-bone.svg",
    category: "toys",
    featured: true,
  },
  {
    name: "Puzzle Treat Dispenser",
    description:
      "Interactive puzzle toy that dispenses treats as your dog solves it. Great for mental stimulation and reducing boredom.",
    quantity: 10,
    price: 19.99,
    image: "/images/products/puzzle-toy.svg",
    category: "toys",
    featured: false,
  },
  {
    name: "Plush Duck Toy",
    description:
      "Soft plush duck with an internal squeaker. Perfect for gentle chewers who love a cuddly companion.",
    quantity: 40,
    price: 11.99,
    image: "/images/products/plush-duck.svg",
    images: JSON.stringify(["/images/products/squeaky-bone.svg"]),
    category: "toys",
    featured: false,
  },
  {
    name: "Classic Leather Collar",
    optionGroups: [
      {
        name: "Size",
        inputType: "select",
        choices: [
          { label: "Small (10-14 in)" },
          { label: "Medium (14-18 in)" },
          { label: "Large (18-24 in)" },
        ],
      },
      {
        name: "Colour",
        inputType: "carousel",
        choices: [
          { label: "Tan", image: "/images/products/leather-collar.svg" },
          { label: "Black", image: "/images/products/rope-toy.svg" },
          { label: "Chestnut", image: "/images/products/bandana-set.svg" },
        ],
      },
    ],
    description:
      "Handcrafted genuine leather collar with a sturdy brass buckle. Available in multiple sizes for the perfect fit.",
    quantity: 20,
    price: 24.99,
    image: "/images/products/leather-collar.svg",
    category: "accessories",
    featured: false,
  },
  {
    name: "Bandana Set (3-Pack)",
    description:
      "Adorable, adjustable bandanas in three stylish patterns. Snap-on design makes them easy to put on and take off.",
    // Stock lives on the option combinations below (trackOptionStock).
    quantity: 0,
    price: 15.99,
    image: "/images/products/bandana-set.svg",
    itemDetails:
      "100% cotton, machine washable (cold, gentle). Snap closure — measure your pup's neck and add two finger-widths for the right size.",
    category: "accessories",
    featured: false,
    trackOptionStock: true,
    optionGroups: [
      {
        name: "Size",
        inputType: "select",
        required: true,
        setsPrice: true,
        choices: [
          { label: "Small", price: 12.99 },
          { label: "Medium", price: 14.99 },
          { label: "Large", price: 17.99 },
        ],
      },
      {
        name: "Style",
        inputType: "radio",
        required: true,
        choices: [{ label: "Plaid" }, { label: "Floral" }, { label: "Bones" }],
      },
    ],
    variantStock: {
      "Small / Plaid": 8,
      "Small / Floral": 6,
      "Small / Bones": 5,
      "Medium / Plaid": 7,
      "Medium / Floral": 6,
      "Medium / Bones": 4,
      "Large / Plaid": 3,
      "Large / Floral": 2,
      "Large / Bones": 12,
    },
  },
  {
    name: "Premium Grain-Free Kibble",
    description:
      "High-protein, grain-free dry dog food made with real deboned chicken as the first ingredient. For all life stages.",
    quantity: 100,
    price: 49.99,
    image: "/images/products/grain-free-kibble.svg",
    category: "food",
    featured: false,
  },
  {
    name: "Wet Food Variety Pack",
    description:
      "A variety pack of 12 cans featuring chicken, beef, and lamb recipes. Made with real meat and vegetables.",
    quantity: 30,
    price: 34.99,
    image: "/images/products/wet-food-pack.svg",
    category: "food",
    featured: false,
  },
  {
    name: "Plushie Adoption — Seasonal Drop",
    description:
      "Adopt one of our hand-sewn seasonal plushies! A one-off batch — once they're adopted, they're gone. Each comes with an adoption certificate.",
    quantity: 20,
    limitedQuantity: 20,
    // A 60-day drop window starting at seed time keeps dev data realistic.
    availableFrom: new Date(),
    availableUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    price: 29.99,
    image: "/images/products/plush-duck.svg",
    category: "toys",
    featured: true,
  },
];
