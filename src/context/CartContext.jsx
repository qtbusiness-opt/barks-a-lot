"use client";

import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext(undefined);

// A cart line is identified by product + chosen variant + chosen options,
// so the same product in two sizes/patterns is two separate lines — and
// so is the same bandana ordered in two different styles.
function lineKey(productId, variantId, options) {
  const chosen = (options ?? [])
    .map((o) => `${o.groupId}=${[...o.choiceIds].sort().join("+")}`)
    .sort()
    .join("|");
  return [productId, variantId ?? "", chosen].filter(Boolean).join(":");
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  // The most recently added item, consumed by the added-to-cart notice
  // (drawer on desktop, bottom sheet on mobile).
  const [lastAdded, setLastAdded] = useState(null);

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

  // entry: { productId, variantId?, name, price, image, options?,
  //          optionsLabel? } where options is
  //          [{ groupId, choiceIds: [...] }] and optionsLabel is the
  //          human-readable summary shown in the cart.
  const addItem = (entry, quantity = 1) => {
    const key = lineKey(entry.productId, entry.variantId, entry.options);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...entry, key, quantity }];
    });
    setLastAdded({ ...entry, quantity });
  };

  const dismissLastAdded = () => setLastAdded(null);

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
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        total,
        itemCount,
        lastAdded,
        dismissLastAdded,
      }}
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
