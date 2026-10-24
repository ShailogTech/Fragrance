// Shared store constants (safe for client and server).

/** Minimum order value in rupees, enforced client- and server-side. */
export const MIN_ORDER_VALUE = 500

/** Flat shipping fees — there is no free-shipping tier. */
export const SHIPPING_STANDARD = 49 // 3–5 business days
export const SHIPPING_EXPRESS = 99 // 1–2 business days
