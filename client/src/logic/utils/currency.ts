// currency.ts
// USD display for money amounts — "$1,240" for whole dollars, "$12.50" when
// there are cents.
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatUSD = (amount: number): string => usd.format(amount);
