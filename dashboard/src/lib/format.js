export function formatCurrency(amount, currency) {
  if (!currency) {
    return amount === 0 ? "—" : String(amount);
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}
