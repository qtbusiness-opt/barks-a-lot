"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CartContext = createContext(undefined);

// Kept in step with the same constant in AuthContext, which clears the
// cart on logout.
const CART_KEY = "barks-cart";

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
  // Whether the saved cart has been read back yet. Until it has, `items`
  // is the empty starting value rather than the customer's actual cart,
  // and saving it would overwrite the very thing we're about to load.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    // localStorage is client-only; loading after mount (instead of in the
    // useState initializer) keeps the server and first client render
    // identical, avoiding an SSR hydration mismatch.
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ignore carts saved before line keys existed.
        if (
          Array.isArray(parsed) &&
          parsed.every((i) => i?.key && i.productId)
        ) {
          setItems(parsed);
        }
      }
    } catch {
      // Corrupted cart data — start with an empty cart.
    } finally {
      // In a `finally` so a corrupted cart still unblocks saving; without
      // it a single bad entry would freeze the cart read-only forever.
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    // Skipped on the first pass: this effect runs immediately after the
    // one above, before its setItems has taken, so `items` is still []
    // here. Writing it out would blank the stored cart — and React runs
    // effects twice in development, so the second read then found the
    // blanked copy and the cart really was lost on every reload.
    if (!restored) return;
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, restored]);

  // Every function below goes through useCallback and every read of the
  // current cart goes through the updater argument, so none of them
  // depend on `items`. That keeps their identities fixed for the life of
  // the provider, which is what lets the context value below stay put
  // when nothing about the cart has actually changed.

  // entry: { productId, variantId?, name, price, image, options?,
  //          optionsLabel? } where options is
  //          [{ groupId, choiceIds: [...] }] and optionsLabel is the
  //          human-readable summary shown in the cart.
  const addItem = useCallback((entry, quantity = 1) => {
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
  }, []);

  const dismissLastAdded = useCallback(() => setLastAdded(null), []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const updateQuantity = useCallback(
    (key, quantity) => {
      if (quantity <= 0) {
        removeItem(key);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, quantity } : i))
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => setItems([]), []);

  // Built inline, this object was a new object on every render, so every
  // component reading the cart re-rendered whenever anything above them
  // re-rendered — even when the cart itself was untouched.
  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      lastAdded,
      dismissLastAdded,
    }),
    [
      items,
      lastAdded,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      dismissLastAdded,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
