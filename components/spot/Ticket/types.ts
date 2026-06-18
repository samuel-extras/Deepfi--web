/**
 * Click-to-fill prefill passed from the order book to the ticket: a price plus a
 * monotonic nonce so repeat clicks on the same price still re-trigger the fill.
 * Shared by the spot and margin tickets.
 */
export type TerminalPrefill = { price: number; nonce: number } | null;
