import "./globals.css";
import { Fraunces, Geist } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AddedToCartNotice from "@/components/AddedToCartNotice";
import SessionTimeoutModal from "@/components/SessionTimeoutModal";
import Script from "next/script";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";

// Display face for headings/wordmark — a warm, characterful serif that
// suits a handmade, organic brand. Body stays a clean, neutral sans so the
// overall layout reads the same as before.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

export const metadata = {
  title: "Barks-A-Lot Treats & More",
  description: "Premium treats and accessories for your furry friend",
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
      className={`h-full antialiased ${geist.variable} ${fraunces.variable}`}
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
        <Script
          src="https://cdn.jsdelivr.net/npm/@tailwindplus/elements@1"
          type="module"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
