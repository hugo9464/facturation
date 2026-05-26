import type { TimeEntry, RateType } from "@/db/schema";
import { formatDate, formatMonthYear } from "@/lib/dates";

export type InvoiceLineDraft = {
  description: string;
  quantity: number;
  unitType: RateType;
  unitPriceCents: number;
  totalCents: number;
  timeEntryIds: string[];
};

const RATE_LABELS: Record<RateType, { singular: string; plural: string }> = {
  DAY: { singular: "jour", plural: "jours" },
  HALF_DAY: { singular: "demi-journée", plural: "demi-journées" },
  HOUR: { singular: "heure", plural: "heures" },
  FORFAIT: { singular: "forfait", plural: "forfaits" },
};

function formatQuantity(qty: number): string {
  if (Number.isInteger(qty)) return qty.toString();
  return qty.toFixed(2).replace(/0+$/, "").replace(/,$/, "").replace(".", ",");
}

function normalizeClientName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("fr-FR");
}

export function isSpaceManagementClientName(name: string): boolean {
  return normalizeClientName(name) === "SPACE MANAGEMENT";
}

export function spaceManagementBillingPeriodForInvoiceMonth(monthDate: string) {
  const month = monthDate.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid invoice month");
  }
  const [yearValue, monthValue] = month.split("-").map(Number);
  const end = new Date(yearValue, monthValue - 1, 24);
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 25);

  return {
    periodStart: [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, "0"),
      "25",
    ].join("-"),
    periodEnd: [
      end.getFullYear(),
      String(end.getMonth() + 1).padStart(2, "0"),
      "24",
    ].join("-"),
  };
}

export function latestCompletedSpaceManagementBillingPeriod(
  date: Date = new Date(),
) {
  const endMonth =
    date.getDate() >= 25 ? date.getMonth() : date.getMonth() - 1;
  const end = new Date(date.getFullYear(), endMonth, 24);
  return spaceManagementBillingPeriodForInvoiceMonth(
    [
      end.getFullYear(),
      String(end.getMonth() + 1).padStart(2, "0"),
      "01",
    ].join("-"),
  );
}

export function timeEntryQuantityInDays(entry: Pick<TimeEntry, "quantity" | "type">) {
  const quantity = Number(entry.quantity);
  if (!Number.isFinite(quantity)) return 0;
  if (entry.type === "HALF_DAY") return quantity * 0.5;
  if (entry.type === "HOUR") return quantity / 8;
  return quantity;
}

export function buildSpaceManagementProductManagerLine({
  entries,
  periodStart,
  periodEnd,
  unitPriceCents,
}: {
  entries: TimeEntry[];
  periodStart: string;
  periodEnd: string;
  unitPriceCents: number;
}): InvoiceLineDraft[] {
  if (entries.length === 0) return [];

  const quantity = entries.reduce(
    (acc, entry) => acc + timeEntryQuantityInDays(entry),
    0,
  );

  return [
    {
      description: `Prestation de Product Manager - ${formatQuantity(
        quantity,
      )} jours de prestation sur la période du ${formatDate(
        periodStart,
      )} au ${formatDate(periodEnd)}`,
      quantity,
      unitType: "DAY",
      unitPriceCents,
      totalCents: Math.round(quantity * unitPriceCents),
      timeEntryIds: entries.map((entry) => entry.id),
    },
  ];
}

/**
 * Groups time entries into invoice lines: one line per (rate type, rate, month).
 * Description includes the month label. Falls back to per-entry lines for FORFAIT
 * or when descriptions vary significantly.
 */
export function groupEntriesIntoLines(
  entries: TimeEntry[],
): InvoiceLineDraft[] {
  if (entries.length === 0) return [];

  const groups = new Map<
    string,
    { entries: TimeEntry[]; type: RateType; rate: number; monthKey: string }
  >();

  for (const e of entries) {
    const monthKey = e.date.slice(0, 7);
    const key =
      e.type === "FORFAIT"
        ? `forfait-${e.id}`
        : `${e.type}-${e.rateCents}-${monthKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(e);
    } else {
      groups.set(key, {
        entries: [e],
        type: e.type,
        rate: e.rateCents,
        monthKey,
      });
    }
  }

  const lines: InvoiceLineDraft[] = [];
  for (const group of groups.values()) {
    const totalQty = group.entries.reduce(
      (acc, e) => acc + Number(e.quantity),
      0,
    );
    const labels = RATE_LABELS[group.type];
    const monthLabel = formatMonthYear(group.monthKey + "-01");

    let description: string;
    if (group.type === "FORFAIT") {
      description =
        group.entries[0].description?.trim() ||
        `Forfait — ${monthLabel}`;
    } else {
      const noun = totalQty > 1 ? labels.plural : labels.singular;
      description = `Prestations ${monthLabel} — ${formatQuantity(totalQty)} ${noun}`;
    }

    lines.push({
      description,
      quantity: totalQty,
      unitType: group.type,
      unitPriceCents: group.rate,
      totalCents: Math.round(totalQty * group.rate),
      timeEntryIds: group.entries.map((e) => e.id),
    });
  }

  return lines;
}

export function rateTypeLabel(type: RateType, qty = 1): string {
  const labels = RATE_LABELS[type];
  return qty > 1 ? labels.plural : labels.singular;
}
