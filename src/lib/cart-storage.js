// The localStorage key the cart is persisted under. Shared by
// CartContext (which owns the cart) and AuthContext (which reads it
// before mount and clears it on logout), so the two can't drift apart.
export const CART_KEY = "barks-cart";
