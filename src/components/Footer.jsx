import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#3A6270] text-[#E8DFC8] mt-auto">
      <div className="max-w-7xl mx-auto safe-x py-8 sm:py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-white font-bold text-lg mb-3">Barks-A-Lot Treats & More</h3>
          <p className="text-sm">
            Premium treats and accessories for your furry friend. Made with love, handed over with care.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="hover:text-white transition">Home</Link></li>
            <li><Link href="/products" className="hover:text-white transition">Shop</Link></li>
            <li><Link href="/cart" className="hover:text-white transition">Cart</Link></li>
            <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="mailto:info@barks-a-lot.com">info@barks-a-lot.com</Link></li>
            <li><Link href="tel:(805) 800-6896">(805) 800-6896</Link></li>
            <li>1150 N New Creek Dr, Meridian, ID, USA</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#4A7C8A] text-center py-4 text-sm safe-bottom space-x-3">
        <span>
          &copy; {new Date().getFullYear()} Barks-A-Lot Treats & More. All rights reserved.
        </span>
        <Link href="/privacy" className="underline hover:text-white transition">Privacy</Link>
        <Link href="/terms" className="underline hover:text-white transition">Terms</Link>
      </div>
    </footer>
  );
}
