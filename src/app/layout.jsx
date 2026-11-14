import "./globals.css";
import { Fredoka, Figtree } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AddedToCartNotice from "@/components/AddedToCartNotice";
import SessionTimeoutModal from "@/components/SessionTimeoutModal";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";

// Display face for headings and the wordmark: Fredoka's rounded terminals
// read as friendly and dog-park casual without tipping into cartoonish.
// Body is Figtree, a clean geometric sans with real italics. Two families
// only; tokens.css names them --font-display / --font-body.
const fredoka = Fredoka({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fredoka",
});

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
});

export const metadata = {
  title: "Barks-A-Lot Treats & More",
  description:
    "Handmade, organic dog treats and bandanas from the Treasure Valley. Order online and pick up locally.",
  icons: {
    icon: "/images/barks-a-lot-logo.png",
    apple: "/images/barks-a-lot-logo.png",
    shortcut: "/images/barks-a-lot-logo.png",
  },
  appleWebApp: {
    title: "Barks-A-Lot",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Let content extend under the iPhone notch/home indicator; safe-area
  // padding in globals.css keeps interactive elements clear of them.
  viewportFit: "cover",
  themeColor: "#4A7C8A",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${figtree.variable} ${fredoka.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AuthProvider>
          <CartProvider>
            <Navbar />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
            <AddedToCartNotice />
            <SessionTimeoutModal />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
