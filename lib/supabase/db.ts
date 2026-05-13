import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  Invoice,
  InvoiceLine,
  Profile,
  Quote,
  QuoteLine,
  TimeEntry,
  TodoProject,
  TodoTask,
} from "@/db/schema";

type Raw = Record<string, unknown>;

function date(value: unknown): Date | null {
  return typeof value === "string" ? new Date(value) : null;
}

function requiredDate(value: unknown): Date {
  return date(value) ?? new Date(0);
}

export function toProfile(row: Raw): Profile {
  return {
    userId: row.user_id as string,
    businessName: row.business_name as string,
    siret: row.siret as string,
    address: row.address as string,
    email: row.email as string,
    phone: (row.phone as string | null) ?? null,
    iban: (row.iban as string | null) ?? null,
    bic: (row.bic as string | null) ?? null,
    defaultPaymentTermsDays: Number(row.default_payment_terms_days),
    plafondType: row.plafond_type as Profile["plafondType"],
    nextInvoiceNumber: Number(row.next_invoice_number),
    nextQuoteNumber: Number(row.next_quote_number),
    nextTaskNumber: Number(row.next_task_number),
    legalMentionExtra: (row.legal_mention_extra as string | null) ?? null,
    rcsExempt: Boolean(row.rcs_exempt),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toClient(row: Raw): Client {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    contactName: (row.contact_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    siret: (row.siret as string | null) ?? null,
    vatNumber: (row.vat_number as string | null) ?? null,
    defaultRateCents: Number(row.default_rate_cents),
    defaultRateType: row.default_rate_type as Client["defaultRateType"],
    notes: (row.notes as string | null) ?? null,
    archived: Boolean(row.archived),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toInvoice(row: Raw): Invoice {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    clientId: row.client_id as string,
    projectId: (row.project_id as string | null) ?? null,
    number: (row.number as string | null) ?? null,
    issueDate: row.issue_date as string,
    dueDate: row.due_date as string,
    status: row.status as Invoice["status"],
    subtotalCents: Number(row.subtotal_cents),
    totalCents: Number(row.total_cents),
    currency: row.currency as string,
    legalMention: row.legal_mention as string,
    paymentTermsText: row.payment_terms_text as string,
    notes: (row.notes as string | null) ?? null,
    pdfStoragePath: (row.pdf_storage_path as string | null) ?? null,
    sentAt: date(row.sent_at),
    emailSentAt: date(row.email_sent_at),
    paidAt: date(row.paid_at),
    paymentMethod: (row.payment_method as string | null) ?? null,
    paymentReference: (row.payment_reference as string | null) ?? null,
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toInvoiceLine(row: Raw): InvoiceLine {
  return {
    id: row.id as string,
    invoiceId: row.invoice_id as string,
    order: Number(row.order),
    description: row.description as string,
    quantity: String(row.quantity),
    unitType: row.unit_type as InvoiceLine["unitType"],
    unitPriceCents: Number(row.unit_price_cents),
    totalCents: Number(row.total_cents),
    timeEntryIds: (row.time_entry_ids as string[] | null) ?? [],
  };
}

export function toTimeEntry(row: Raw): TimeEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    clientId: row.client_id as string,
    projectId: (row.project_id as string | null) ?? null,
    date: row.date as string,
    type: row.type as TimeEntry["type"],
    quantity: String(row.quantity),
    rateCents: Number(row.rate_cents),
    description: (row.description as string | null) ?? null,
    invoiceId: (row.invoice_id as string | null) ?? null,
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toQuote(row: Raw): Quote {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    clientId: row.client_id as string,
    projectId: (row.project_id as string | null) ?? null,
    number: (row.number as string | null) ?? null,
    issueDate: row.issue_date as string,
    validUntil: row.valid_until as string,
    status: row.status as Quote["status"],
    subtotalCents: Number(row.subtotal_cents),
    totalCents: Number(row.total_cents),
    currency: row.currency as string,
    legalMention: row.legal_mention as string,
    paymentTermsText: row.payment_terms_text as string,
    notes: (row.notes as string | null) ?? null,
    sentAt: date(row.sent_at),
    acceptedAt: date(row.accepted_at),
    rejectedAt: date(row.rejected_at),
    convertedInvoiceId: (row.converted_invoice_id as string | null) ?? null,
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toQuoteLine(row: Raw): QuoteLine {
  return {
    id: row.id as string,
    quoteId: row.quote_id as string,
    order: Number(row.order),
    description: row.description as string,
    quantity: String(row.quantity),
    unitType: row.unit_type as QuoteLine["unitType"],
    unitPriceCents: Number(row.unit_price_cents),
    totalCents: Number(row.total_cents),
  };
}

export function toTodoProject(row: Raw): TodoProject {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    clientId: (row.client_id as string | null) ?? null,
    name: row.name as string,
    order: Number(row.order),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toTodoTask(row: Raw): TodoTask {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    projectId: row.project_id as string,
    number: Number(row.number),
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    status: row.status as TodoTask["status"],
    order: Number(row.order),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export async function getSupabaseDb() {
  return createClient();
}

export async function getProfile(userId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfile(data) : null;
}
