import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Script from "next/script";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";

export const metadata: Metadata = {
  title: "Barks-A-Lot Treats & More",
  description: "Premium treats and accessories for your furry friend",
  icons: {
    icon: "/images/Barks-A-Lot Logo.png",
    apple: "/images/Barks-A-Lot Logo.png",
    shortcut: "/images/Barks-A-Lot Logo.png",
  },
};

export default function RootLayout({
 
 <div styleName={styles['0']}>.9++
 .................</div> children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
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
