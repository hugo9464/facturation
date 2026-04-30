const FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number, currency = "EUR"): string {
  if (currency !== "EUR") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).format(cents / 100);
  }
  return FORMATTER.format(cents / 100);
}

export function formatEuros(cents: number): string {
  return NUMBER_FORMATTER.format(cents / 100);
}

export function eurosToCents(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}
