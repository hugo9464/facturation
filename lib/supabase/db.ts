import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocalhostServerRequest } from "@/lib/local-dev-server";
import type {
  Client,
  Invoice,
  InvoiceLine,
  Profile,
  ProspectionApplicationQuestion,
  ProspectionEntry,
  ProspectionCvGeneration,
  ProspectionCvProfile,
  ProspectionOfferReview,
  ProspectionResume,
  Quote,
  QuoteLine,
  TimeEntry,
  TodoProject,
  TodoImplementationJob,
  TodoTask,
  JobOffer,
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
    todoPromptTemplate: (row.todo_prompt_template as string | null) ?? null,
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

export function toTodoImplementationJob(row: Raw): TodoImplementationJob {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    taskId: row.task_id as string,
    projectId: row.project_id as string,
    status: row.status as TodoImplementationJob["status"],
    agent: (row.agent as string | null) ?? "hermes",
    branchName: (row.branch_name as string | null) ?? null,
    prUrl: (row.pr_url as string | null) ?? null,
    previewUrl: (row.preview_url as string | null) ?? null,
    instructions: (row.instructions as string | null) ?? null,
    logs: (row.logs as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
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
    difficulty: (row.difficulty as TodoTask["difficulty"] | null) ?? "QUICK",
    order: Number(row.order),
    previewUrl: (row.preview_url as string | null) ?? null,
    prUrl: (row.pr_url as string | null) ?? null,
    completedAt: date(row.completed_at),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toProspectionEntry(row: Raw): ProspectionEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as ProspectionEntry["type"],
    status: row.status as ProspectionEntry["status"],
    title: row.title as string,
    organization: (row.organization as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    targetDate: (row.target_date as string | null) ?? null,
    appliedAt: (row.applied_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toProspectionApplicationQuestion(
  row: Raw,
): ProspectionApplicationQuestion {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    entryId: row.entry_id as string,
    question: row.question as string,
    answer: (row.answer as string | null) ?? "",
    model: (row.model as string | null) ?? null,
    generatedAt: date(row.generated_at),
    order: Number(row.order),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

function arrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function toProspectionOfferReview(row: Raw): ProspectionOfferReview {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as ProspectionOfferReview["status"],
    sourceUrl: row.source_url as string,
    sourceId: (row.source_id as string | null) ?? null,
    title: row.title as string,
    organization: (row.organization as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    dailyRate: (row.daily_rate as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    aiMatches: (row.ai_matches as boolean | null) ?? null,
    accepted: Boolean(row.accepted),
    score:
      row.score === null || row.score === undefined ? null : Number(row.score),
    heuristicScore: Number(row.heuristic_score),
    matchedTerms: arrayValue<string>(row.matched_terms),
    fitSignals: arrayValue<string>(row.fit_signals),
    reason: (row.reason as string | null) ?? null,
    entryId: (row.entry_id as string | null) ?? null,
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
    reviewedAt: date(row.reviewed_at),
  };
}

export function toProspectionResume(row: Raw): ProspectionResume {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    content: row.content as string,
    sourceFileName: (row.source_file_name as string | null) ?? null,
    structuredContent:
      row.structured_content as ProspectionResume["structuredContent"],
    photoDataUrl: (row.photo_data_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toProspectionCvGeneration(row: Raw): ProspectionCvGeneration {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    offerDescription: row.offer_description as string,
    resumeIds: arrayValue<string>(row.resume_ids),
    questions: arrayValue(row.questions),
    answers: arrayValue(row.answers),
    generatedCv: row.generated_cv as ProspectionCvGeneration["generatedCv"],
    photoDataUrl: (row.photo_data_url as string | null) ?? null,
    model: (row.model as string | null) ?? "openai",
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toProspectionCvProfile(row: Raw): ProspectionCvProfile {
  return {
    userId: row.user_id as string,
    photoDataUrl: (row.photo_data_url as string | null) ?? null,
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export function toJobOffer(row: Raw): JobOffer {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    source: row.source as string,
    sourceId: (row.source_id as string | null) ?? null,
    sourceUrl: row.source_url as string,
    title: row.title as string,
    company: (row.company as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    remote: Boolean(row.remote),
    contractType: (row.contract_type as string | null) ?? null,
    salary: (row.salary as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? [],
    matchedKeywords: (row.matched_keywords as string[] | null) ?? [],
    matchScore: Number(row.match_score),
    status: row.status as JobOffer["status"],
    publishedAt: date(row.published_at),
    firstSeenAt: requiredDate(row.first_seen_at),
    lastSeenAt: requiredDate(row.last_seen_at),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

export async function getSupabaseDb() {
  if (await isLocalhostServerRequest()) {
    return createAdminClient();
  }

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
