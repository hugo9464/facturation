import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const rateTypeEnum = pgEnum("rate_type", [
  "DAY",
  "HALF_DAY",
  "HOUR",
  "FORFAIT",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const plafondTypeEnum = pgEnum("plafond_type", ["BNC", "BIC"]);

export const profile = pgTable("profile", {
  userId: uuid("user_id").primaryKey(),
  businessName: text("business_name").notNull(),
  siret: text("siret").notNull(),
  address: text("address").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  iban: text("iban"),
  bic: text("bic"),
  defaultPaymentTermsDays: integer("default_payment_terms_days")
    .notNull()
    .default(30),
  plafondType: plafondTypeEnum("plafond_type").notNull().default("BNC"),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  nextQuoteNumber: integer("next_quote_number").notNull().default(1),
  legalMentionExtra: text("legal_mention_extra"),
  rcsExempt: boolean("rcs_exempt").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const client = pgTable(
  "client",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    address: text("address"),
    siret: text("siret"),
    vatNumber: text("vat_number"),
    defaultRateCents: integer("default_rate_cents").notNull().default(0),
    defaultRateType: rateTypeEnum("default_rate_type").notNull().default("DAY"),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("client_user_idx").on(t.userId)],
);

export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    number: text("number"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: invoiceStatusEnum("status").notNull().default("DRAFT"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    currency: text("currency").notNull().default("EUR"),
    legalMention: text("legal_mention").notNull(),
    paymentTermsText: text("payment_terms_text").notNull(),
    notes: text("notes"),
    pdfStoragePath: text("pdf_storage_path"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: text("payment_method"),
    paymentReference: text("payment_reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invoice_user_number_idx").on(t.userId, t.number),
    index("invoice_user_status_idx").on(t.userId, t.status),
    index("invoice_client_idx").on(t.clientId),
  ],
);

export const invoiceLine = pgTable(
  "invoice_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitType: rateTypeEnum("unit_type").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    timeEntryIds: uuid("time_entry_ids").array().notNull().default(sql`ARRAY[]::uuid[]`),
  },
  (t) => [index("invoice_line_invoice_idx").on(t.invoiceId)],
);

export const timeEntry = pgTable(
  "time_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    type: rateTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    rateCents: integer("rate_cents").notNull(),
    description: text("description"),
    invoiceId: uuid("invoice_id").references(() => invoice.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("time_entry_user_date_idx").on(t.userId, t.date),
    index("time_entry_client_idx").on(t.clientId),
    index("time_entry_invoice_idx").on(t.invoiceId),
  ],
);

export const profileRelations = relations(profile, ({ many }) => ({
  clients: many(client),
  invoices: many(invoice),
  timeEntries: many(timeEntry),
}));

export const clientRelations = relations(client, ({ many }) => ({
  timeEntries: many(timeEntry),
  invoices: many(invoice),
}));

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
  client: one(client, {
    fields: [invoice.clientId],
    references: [client.id],
  }),
  lines: many(invoiceLine),
  timeEntries: many(timeEntry),
}));

export const invoiceLineRelations = relations(invoiceLine, ({ one }) => ({
  invoice: one(invoice, {
    fields: [invoiceLine.invoiceId],
    references: [invoice.id],
  }),
}));

export const timeEntryRelations = relations(timeEntry, ({ one }) => ({
  client: one(client, {
    fields: [timeEntry.clientId],
    references: [client.id],
  }),
  invoice: one(invoice, {
    fields: [timeEntry.invoiceId],
    references: [invoice.id],
  }),
}));

export type Profile = typeof profile.$inferSelect;
export type NewProfile = typeof profile.$inferInsert;
export type Client = typeof client.$inferSelect;
export type NewClient = typeof client.$inferInsert;
export type Invoice = typeof invoice.$inferSelect;
export type NewInvoice = typeof invoice.$inferInsert;
export type InvoiceLine = typeof invoiceLine.$inferSelect;
export type NewInvoiceLine = typeof invoiceLine.$inferInsert;
export type TimeEntry = typeof timeEntry.$inferSelect;
export type NewTimeEntry = typeof timeEntry.$inferInsert;
export type RateType = (typeof rateTypeEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type PlafondType = (typeof plafondTypeEnum.enumValues)[number];
