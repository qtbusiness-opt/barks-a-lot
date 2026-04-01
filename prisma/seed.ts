import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    name: "Peanut Butter Biscuits",
    description: "Crunchy, all-natural peanut butter biscuits made with whole wheat flour and real peanut butter. A classic treat your dog will love!",
    price: 12.99,
    image: "/images/products/peanut-butter-biscuits.svg",
    category: "treats",
    featured: true,
  },
  {
    name: "Sweet Potato Chews",
    description: "Dehydrated sweet potato slices that are naturally sweet and packed with vitamins. A healthy, grain-free chewing snack.",
    price: 9.99,
    image: "/images/products/sweet-potato-chews.svg",
    category: "treats",
    featured: true,
  },
  {
    name: "Salmon Training Treats",
    description: "Bite-sized, soft salmon treats perfect for training sessions. Rich in omega-3 fatty acids for a healthy coat.",
    price: 14.99,
    image: "/images/products/salmon-treats.svg",
    category: "treats",
    featured: false,
  },
  {
    name: "Chicken Jerky Strips",
    description: "Premium chicken breast jerky, slow-dried to perfection. No fillers, no artificial preservatives — just pure chicken.",
    price: 16.99,
    image: "/images/products/chicken-jerky.svg",
    category: "treats",
    featured: true,
  },
  {
    name: "Rope Tug Toy",
    description: "Durable, multi-colored cotton rope toy perfect for tug-of-war. Helps clean teeth while your pup plays!",
    price: 8.99,
    image: "/images/products/rope-toy.svg",
    category: "toys",
    featured: false,
  },
  {
    name: "Squeaky Bone Toy",
    description: "A classic squeaky bone made from durable, non-toxic rubber. Hours of squeaky fun for your furry friend.",
    price: 6.99,
    image: "/images/products/squeaky-bone.svg",
    category: "toys",
    featured: true,
  },
  {
    name: "Puzzle Treat Dispenser",
    description: "Interactive puzzle toy that dispenses treats as your dog solves it. Great for mental stimulation and reducing boredom.",
    price: 19.99,
    image: "/images/products/puzzle-toy.svg",
    category: "toys",
    featured: false,
  },
  {
    name: "Plush Duck Toy",
    description: "Soft plush duck with an internal squeaker. Perfect for gentle chewers who love a cuddly companion.",
    price: 11.99,
    image: "/images/products/plush-duck.svg",
    category: "toys",
    featured: false,
  },
  {
    name: "Classic Leather Collar",
    description: "Handcrafted genuine leather collar with a sturdy brass buckle. Available in multiple sizes for the perfect fit.",
    price: 24.99,
    image: "/images/products/leather-collar.svg",
    category: "accessories",
    featured: false,
  },
  {
    name: "Bandana Set (3-Pack)",
    description: "Adorable, adjustable bandanas in three stylish patterns. Snap-on design makes them easy to put on and take off.",
    price: 15.99,
    image: "/images/products/bandana-set.svg",
    category: "accessories",
    featured: false,
  },
  {
    name: "Premium Grain-Free Kibble",
    description: "High-protein, grain-free dry dog food made with real deboned chicken as the first ingredient. For all life stages.",
    price: 49.99,
    image: "/images/products/grain-free-kibble.svg",
    category: "food",
    featured: false,
  },
  {
    name: "Wet Food Variety Pack",
    description: "A variety pack of 12 cans featuring chicken, beef, and lamb recipes. Made with real meat and vegetables.",
    price: 34.99,
    image: "/images/products/wet-food-pack.svg",
    category: "food",
    featured: false,
  },
];

async function main() {
  console.log("Seeding database...");

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
