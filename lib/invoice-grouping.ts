import type { TimeEntry, RateType } from "@/db/schema";
import { formatMonthYear } from "@/lib/dates";

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
  return qty.toFixed(2).replace(".", ",");
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
