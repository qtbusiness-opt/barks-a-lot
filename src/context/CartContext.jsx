"use client";

import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext(undefined);

// A cart line is identified by product + chosen variant, so the same
// product in two sizes/patterns is two separate lines.
function lineKey(productId, variantId) {
  return variantId ? `${productId}:${variantId}` : productId;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    // localStorage is client-only; loading after mount (instead of in the
    // useState initializer) keeps the server and first client render
    // identical, avoiding an SSR hydration mismatch.
    try {
      const saved = localStorage.getItem("barks-cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ignore carts saved before line keys existed.
        if (parsed.every((i) => i.key && i.productId)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setItems(parsed);
        }
      }
    } catch {
      // Corrupted cart data — start with an empty cart.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("barks-cart", JSON.stringify(items));
  }, [items]);

  // entry: { productId, variantId?, name, price, image }
  const addItem = (entry, quantity = 1) => {
    const key = lineKey(entry.productId, entry.variantId);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...entry, key, quantity }];
    });
  };

  const removeItem = (key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const updateQuantity = (key, quantity) => {
    if (quantity <= 0) {
      removeItem(key);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
