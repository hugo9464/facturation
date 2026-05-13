export const rateTypeEnum = {
  enumValues: ["DAY", "HALF_DAY", "HOUR", "FORFAIT"] as const,
};

export const invoiceStatusEnum = {
  enumValues: ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const,
};

export const plafondTypeEnum = {
  enumValues: ["BNC", "BIC"] as const,
};

export const quoteStatusEnum = {
  enumValues: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const,
};

export const todoStatusEnum = {
  enumValues: ["TODO", "IN_PROGRESS", "TO_TEST", "DONE"] as const,
};

export type RateType = (typeof rateTypeEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type QuoteStatus = (typeof quoteStatusEnum.enumValues)[number];
export type TodoStatus = (typeof todoStatusEnum.enumValues)[number];
export type PlafondType = (typeof plafondTypeEnum.enumValues)[number];

export type Profile = {
  userId: string;
  businessName: string;
  siret: string;
  address: string;
  email: string;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  defaultPaymentTermsDays: number;
  plafondType: PlafondType;
  nextInvoiceNumber: number;
  nextQuoteNumber: number;
  nextTaskNumber: number;
  legalMentionExtra: string | null;
  rcsExempt: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProfile = Omit<Profile, "createdAt" | "updatedAt">;

export type Client = {
  id: string;
  userId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  address: string | null;
  siret: string | null;
  vatNumber: string | null;
  defaultRateCents: number;
  defaultRateType: RateType;
  notes: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewClient = Omit<Client, "id" | "createdAt" | "updatedAt">;

export type Invoice = {
  id: string;
  userId: string;
  clientId: string;
  projectId: string | null;
  number: string | null;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  legalMention: string;
  paymentTermsText: string;
  notes: string | null;
  pdfStoragePath: string | null;
  sentAt: Date | null;
  emailSentAt: Date | null;
  paidAt: Date | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewInvoice = Omit<Invoice, "id" | "createdAt" | "updatedAt">;

export type InvoiceLine = {
  id: string;
  invoiceId: string;
  order: number;
  description: string;
  quantity: string;
  unitType: RateType;
  unitPriceCents: number;
  totalCents: number;
  timeEntryIds: string[];
};

export type NewInvoiceLine = Omit<InvoiceLine, "id">;

export type TimeEntry = {
  id: string;
  userId: string;
  clientId: string;
  projectId: string | null;
  date: string;
  type: RateType;
  quantity: string;
  rateCents: number;
  description: string | null;
  invoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewTimeEntry = Omit<TimeEntry, "id" | "createdAt" | "updatedAt">;

export type Quote = {
  id: string;
  userId: string;
  clientId: string;
  projectId: string | null;
  number: string | null;
  issueDate: string;
  validUntil: string;
  status: QuoteStatus;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  legalMention: string;
  paymentTermsText: string;
  notes: string | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  convertedInvoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewQuote = Omit<Quote, "id" | "createdAt" | "updatedAt">;

export type QuoteLine = {
  id: string;
  quoteId: string;
  order: number;
  description: string;
  quantity: string;
  unitType: RateType;
  unitPriceCents: number;
  totalCents: number;
};

export type NewQuoteLine = Omit<QuoteLine, "id">;

export type TodoProject = {
  id: string;
  userId: string;
  clientId: string | null;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewTodoProject = Omit<TodoProject, "id" | "createdAt" | "updatedAt">;

export type TodoTask = {
  id: string;
  userId: string;
  projectId: string;
  number: number;
  title: string;
  description: string | null;
  status: TodoStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewTodoTask = Omit<TodoTask, "id" | "createdAt" | "updatedAt">;
