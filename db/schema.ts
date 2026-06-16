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

export const todoDifficultyEnum = {
  enumValues: ["QUICK", "COMPLEX"] as const,
};

export const todoImplementationJobStatusEnum = {
  enumValues: [
    "QUEUED",
    "RUNNING",
    "WAITING_PREVIEW",
    "SUCCEEDED",
    "FAILED",
    "CANCELLED",
  ] as const,
};

export const prospectionTypeEnum = {
  enumValues: ["OFFER", "MISSION", "COMPANY", "CONTACT"] as const,
};

export const prospectionStatusEnum = {
  enumValues: [
    "TO_APPLY",
    "APPLIED",
    "FOLLOW_UP",
    "INTERVIEW",
    "WON",
    "LOST",
    "ARCHIVED",
  ] as const,
};

export const prospectionOfferReviewStatusEnum = {
  enumValues: ["PENDING", "IMPORTED", "ARCHIVED"] as const,
};

export const jobOfferStatusEnum = {
  enumValues: ["NEW", "SAVED", "IGNORED", "APPLIED"] as const,
};

export type RateType = (typeof rateTypeEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type QuoteStatus = (typeof quoteStatusEnum.enumValues)[number];
export type TodoStatus = (typeof todoStatusEnum.enumValues)[number];
export type TodoDifficulty = (typeof todoDifficultyEnum.enumValues)[number];
export type TodoImplementationJobStatus =
  (typeof todoImplementationJobStatusEnum.enumValues)[number];
export type JobOfferStatus = (typeof jobOfferStatusEnum.enumValues)[number];
export type PlafondType = (typeof plafondTypeEnum.enumValues)[number];
export type ProspectionType = (typeof prospectionTypeEnum.enumValues)[number];
export type ProspectionStatus =
  (typeof prospectionStatusEnum.enumValues)[number];
export type ProspectionOfferReviewStatus =
  (typeof prospectionOfferReviewStatusEnum.enumValues)[number];

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
  todoPromptTemplate: string | null;
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
  difficulty: TodoDifficulty;
  order: number;
  previewUrl: string | null;
  prUrl: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewTodoTask = Omit<TodoTask, "id" | "createdAt" | "updatedAt">;

export type TodoImplementationJob = {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  status: TodoImplementationJobStatus;
  agent: string;
  branchName: string | null;
  prUrl: string | null;
  previewUrl: string | null;
  instructions: string | null;
  logs: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewTodoImplementationJob = Omit<
  TodoImplementationJob,
  "id" | "createdAt" | "updatedAt"
>;

export type ProspectionEntry = {
  id: string;
  userId: string;
  type: ProspectionType;
  status: ProspectionStatus;
  title: string;
  organization: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  sourceUrl: string | null;
  location: string | null;
  targetDate: string | null;
  appliedAt: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProspectionEntry = Omit<
  ProspectionEntry,
  "id" | "createdAt" | "updatedAt"
>;

export type ProspectionOfferReview = {
  id: string;
  userId: string;
  status: ProspectionOfferReviewStatus;
  sourceUrl: string;
  sourceId: string | null;
  title: string;
  organization: string | null;
  location: string | null;
  dailyRate: string | null;
  notes: string | null;
  aiMatches: boolean | null;
  accepted: boolean;
  score: number | null;
  heuristicScore: number;
  matchedTerms: string[];
  fitSignals: string[];
  reason: string | null;
  entryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
};

export type NewProspectionOfferReview = Omit<
  ProspectionOfferReview,
  "id" | "createdAt" | "updatedAt" | "reviewedAt"
>;

export type ProspectionResume = {
  id: string;
  userId: string;
  title: string;
  content: string;
  sourceFileName: string | null;
  structuredContent: import("@/lib/prospection-cv").ResumeMemory;
  photoDataUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProspectionResume = Omit<
  ProspectionResume,
  "id" | "createdAt" | "updatedAt"
>;

export type ProspectionCvProfile = {
  userId: string;
  photoDataUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProspectionCvGeneration = {
  id: string;
  userId: string;
  title: string;
  offerDescription: string;
  resumeIds: string[];
  questions: import("@/lib/prospection-cv").CvQuestion[];
  answers: import("@/lib/prospection-cv").CvAnswer[];
  generatedCv: import("@/lib/prospection-cv").TailoredCv;
  photoDataUrl: string | null;
  model: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProspectionCvGeneration = Omit<
  ProspectionCvGeneration,
  "id" | "createdAt" | "updatedAt"
>;

export type ProspectionApplicationQuestion = {
  id: string;
  userId: string;
  entryId: string;
  question: string;
  answer: string;
  model: string | null;
  generatedAt: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProspectionApplicationQuestion = Omit<
  ProspectionApplicationQuestion,
  "id" | "createdAt" | "updatedAt"
>;

export type JobOffer = {
  id: string;
  userId: string;
  source: string;
  sourceId: string | null;
  sourceUrl: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  contractType: string | null;
  salary: string | null;
  description: string | null;
  tags: string[];
  matchedKeywords: string[];
  matchScore: number;
  status: JobOfferStatus;
  publishedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type NewJobOffer = Omit<JobOffer, "id" | "createdAt" | "updatedAt">;

export type JobOfferAgentFeedback = {
  id: string;
  userId: string;
  message: string;
  createdAt: Date;
};

export type NewJobOfferAgentFeedback = Omit<JobOfferAgentFeedback, "id" | "createdAt">;
