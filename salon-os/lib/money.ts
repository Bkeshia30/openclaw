/**
 * Money is always integer cents. 19.99 as a float eventually charges someone
 * 19.989999999999998, and the first time you notice is on a customer receipt.
 */
export function formatMoney(cents: number | string, currency = "usd"): string {
  const n = typeof cents === "string" ? Number(cents) : cents;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(n / 100);
}

export function parseMoneyToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  return Math.round(Number(cleaned) * 100);
}
