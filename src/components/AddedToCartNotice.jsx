"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import StoreImage from "@/components/StoreImage";

// Clicks on the ::backdrop are delivered to the dialog element itself, as
// are clicks on any of the panel's own empty space, so tell them apart by
// whether the pointer was outside the panel's box.
const isOutsidePanel = (e) => {
  if (e.target !== e.currentTarget) return false;
  const box = e.currentTarget.getBoundingClientRect();
  return (
    e.clientX < box.left ||
    e.clientX > box.right ||
    e.clientY < box.top ||
    e.clientY > box.bottom
  );
};

// Confirmation shown after adding to cart: a right-side drawer on desktop
// (md+) and a bottom-sheet modal on phones. Driven by CartContext so it
// fires from both the product grid and the detail page.
export default function AddedToCartNotice() {
  const { lastAdded, dismissLastAdded, total, itemCount } = useCart();
  const dialogRef = useRef(null);
  // Keyed on whether there's a notice at all, not on which item it's for,
  // so the dialog and the scroll lock aren't torn down and rebuilt when
  // the item changes underneath an open notice.
  const isOpen = Boolean(lastAdded);

  useEffect(() => {
    if (!isOpen) return undefined;
    // The native modal dialog traps focus, makes the page behind it inert
    // and sits above everything else. It's only rendered while there's a
    // notice, and removing an open dialog also takes it out of the top
    // layer, so there's nothing to close here. The open check keeps
    // StrictMode's second run from calling showModal twice, which throws.
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Focus the panel itself rather than its first button (the browser's
    // default), so a screen reader starts from the "Added to cart" label.
    dialog?.focus();

    // Click-outside to dismiss. Mouse-only by nature: keyboard users have
    // Escape and the panel's Close button. The press has to start outside
    // too, so a drag that begins in the panel (selecting the product name,
    // say) and ends on the backdrop doesn't dismiss it.
    let pressStartedOutside = false;
    const onPointerDown = (e) => {
      pressStartedOutside = isOutsidePanel(e);
    };
    const onClick = (e) => {
      if (pressStartedOutside && isOutsidePanel(e)) dismissLastAdded();
    };
    dialog?.addEventListener("pointerdown", onPointerDown);
    dialog?.addEventListener("click", onClick);

    // A modal dialog doesn't stop the page behind it scrolling.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.removeEventListener("pointerdown", onPointerDown);
      dialog?.removeEventListener("click", onClick);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, dismissLastAdded]);

  if (!isOpen) return null;

  return (
    // Escape closes the dialog natively; onClose brings the cart state in
    // line. Nothing else calls close(), so this fires only for Escape.
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-label="Added to cart"
      onClose={dismissLastAdded}
      // The browser's own dialog box (centred, fit-content, capped size,
      // scrolling) is overridden so the panel keeps its drawer/sheet shape.
      // open:flex, not flex: a bare display would override the browser hiding
      // the dialog before showModal runs.
      className="fixed m-0 p-0 h-auto w-auto max-w-none overflow-visible bg-white text-foreground shadow-2xl open:flex flex-col focus:outline-none
                 inset-x-0 top-auto bottom-0 rounded-t-2xl max-h-[85vh] animate-slide-up
                 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-96 md:rounded-none md:max-h-none md:animate-slide-in-right
                 backdrop:bg-[rgb(0_0_0/0.4)] backdrop:animate-[fade-in_var(--dur-short)_var(--ease-out)] motion-reduce:backdrop:animate-none"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
        <h2 className="text-lg font-bold text-[#2A4A52] flex items-center gap-2">
          <svg
            className="w-6 h-6 text-green-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Added to Cart
        </h2>
        <button
          onClick={dismissLastAdded}
          aria-label="Close"
          className="flex items-center justify-center h-11 w-11 -mr-2 text-gray-600 hover:text-gray-700 active:text-gray-800"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 flex items-center gap-4 overflow-y-auto">
        <StoreImage
          src={lastAdded.image}
          alt={lastAdded.name}
          width={80}
          height={80}
          className="w-20 h-20 rounded-lg object-cover bg-[#F5F0E8] shrink-0"
        />
        <div className="min-w-0">
          <p className="font-semibold text-[#2A4A52]">{lastAdded.name}</p>
          <p className="text-sm text-gray-600 mt-1">
            Qty: {lastAdded.quantity}
          </p>
          <p className="text-[#8A4D1A] font-bold mt-1">
            ${(lastAdded.price * lastAdded.quantity).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-auto px-5 py-4 border-t border-gray-100 safe-bottom md:pb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-3">
          <span>
            Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
          </span>
          <span className="font-bold text-[#2A4A52]">${total.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/cart"
            onClick={dismissLastAdded}
            className="text-center border-2 border-[#4A7C8A] text-[#3A6270] py-2.5 rounded-lg font-semibold hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
          >
            View Cart
          </Link>
          <Link
            href="/checkout"
            onClick={dismissLastAdded}
            className="text-center bg-[#A85D1F] hover:bg-[#8A4D1A] active:bg-[#8A4D1A] text-white py-2.5 rounded-lg font-semibold transition"
          >
            Checkout
          </Link>
        </div>
        <button
          onClick={dismissLastAdded}
          className="w-full text-center text-sm text-[#3A6270] font-medium hover:underline mt-3 min-h-11"
        >
          Continue Shopping
        </button>
      </div>
    </dialog>
  );
}
