import assert from "node:assert/strict";
import type { TimeEntry } from "@/db/schema";
import {
  buildSpaceManagementProductManagerLine,
  isSpaceManagementClientName,
  latestCompletedSpaceManagementBillingPeriod,
} from "@/lib/invoice-grouping";

function timeEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    id: "entry-1",
    userId: "user-1",
    clientId: "client-1",
    projectId: "project-1",
    date: "2026-05-12",
    type: "DAY",
    quantity: "1",
    rateCents: 40000,
    description: null,
    invoiceId: null,
    createdAt: new Date("2026-05-12T00:00:00Z"),
    updatedAt: new Date("2026-05-12T00:00:00Z"),
    ...overrides,
  };
}

assert.equal(isSpaceManagementClientName("SPACE MANAGEMENT"), true);
assert.equal(isSpaceManagementClientName(" Space Management "), true);
assert.equal(isSpaceManagementClientName("Mayday"), false);

assert.deepEqual(
  latestCompletedSpaceManagementBillingPeriod(new Date("2026-05-26T12:00:00")),
  {
    periodStart: "2026-04-25",
    periodEnd: "2026-05-24",
  },
);

assert.deepEqual(
  latestCompletedSpaceManagementBillingPeriod(new Date("2026-05-20T12:00:00")),
  {
    periodStart: "2026-03-25",
    periodEnd: "2026-04-24",
  },
);

const [line] = buildSpaceManagementProductManagerLine({
  entries: [
    timeEntry({ id: "entry-1", quantity: "1" }),
    timeEntry({ id: "entry-2", quantity: "0.5" }),
  ],
  periodStart: "2026-04-25",
  periodEnd: "2026-05-24",
  unitPriceCents: 40000,
});

assert.deepEqual(line, {
  description:
    "Prestation de service de Product Manager\n1,5 jours sur la période du 25/04/2026 au 24/05/2026",
  quantity: 1.5,
  unitType: "DAY",
  unitPriceCents: 40000,
  totalCents: 60000,
  timeEntryIds: ["entry-1", "entry-2"],
});
