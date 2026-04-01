import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#3A6270] text-[#E8DFC8] mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-white font-bold text-lg mb-3">Barks-A-Lot Treats & More</h3>
          <p className="text-sm">
            Premium treats and accessories for your furry best friend. Made with love, delivered with care.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="hover:text-white transition">Home</Link></li>
            <li><Link href="/products" className="hover:text-white transition">Shop</Link></li>
            <li><Link href="/cart" className="hover:text-white transition">Cart</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li>info@barks-a-lot.com</li>
            <li>(555) BARK-ALOT</li>
            <li>123 Puppy Lane, Dogtown, USA</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#4A7C8A] text-center py-4 text-sm">
        &copy; {new Date().getFullYear()} Barks-A-Lot Treats & More. All rights reserved.
      </div>
    </footer>
  );
}
