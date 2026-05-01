"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  client as clientTable,
  invoice,
  invoiceLine,
  profile,
  quote,
  quoteLine,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import {
  buildLegalMention,
  buildPaymentTermsText,
  buildQuoteLegalMention,
} from "@/lib/legal";
import { addDaysISO, todayISO } from "@/lib/dates";
import { allocateInvoiceNumber, allocateQuoteNumber } from "@/lib/invoice-numbering";
import { eurosToCents } from "@/lib/money";
import {
  formatMissingFieldsError,
  getClientMissingFields,
  getProfileMissingFields,
} from "@/lib/billing-readiness";

const QUOTE_VALIDITY_DAYS = 30;

export async function createDraftQuoteAction(input: { clientId: string }) {
  const user = await requireUser();
  if (!input.clientId) return { error: "Client manquant" };

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);

  const [c] = await db
    .select()
    .from(clientTable)
    .where(
      and(eq(clientTable.id, input.clientId), eq(clientTable.userId, user.id)),
    )
    .limit(1);
  if (!c) return { error: "Client introuvable" };

  const profileMissing = getProfileMissingFields(profileRow);
  const clientMissing = getClientMissingFields(c);
  if (profileMissing.length > 0 || clientMissing.length > 0) {
    return {
      error: formatMissingFieldsError({
        profileMissing,
        clientMissing,
        clientName: c.name,
      }),
    };
  }
  if (!profileRow) return { error: "Paramètres d'entreprise manquants" };

  const issueDate = todayISO();
  const validUntil = addDaysISO(issueDate, QUOTE_VALIDITY_DAYS);

  const [q] = await db
    .insert(quote)
    .values({
      userId: user.id,
      clientId: c.id,
      number: null,
      issueDate,
      validUntil,
      status: "DRAFT",
      subtotalCents: 0,
      totalCents: 0,
      currency: "EUR",
      legalMention: buildQuoteLegalMention(profileRow),
      paymentTermsText: buildPaymentTermsText(profileRow),
      notes: null,
    })
    .returning({ id: quote.id });

  revalidatePath("/quotes");
  redirect(`/quotes/${q.id}`);
}

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit_type: z.enum(["DAY", "HALF_DAY", "HOUR", "FORFAIT"]),
  unit_price: z.string().min(1),
});

export async function addQuoteLineAction(quoteId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = lineSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const [q] = await db
    .select({ id: quote.id, status: quote.status })
    .from(quote)
    .where(and(eq(quote.id, quoteId), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return { error: "Devis introuvable" };
  if (q.status === "ACCEPTED" || q.status === "REJECTED") {
    return { error: "Devis verrouillé — modifications impossibles." };
  }

  const unitPriceCents = eurosToCents(parsed.data.unit_price);
  const totalCents = Math.round(parsed.data.quantity * unitPriceCents);

  const existing = await db
    .select({ order: quoteLine.order })
    .from(quoteLine)
    .where(eq(quoteLine.quoteId, quoteId));
  const maxOrder = existing.reduce((m, l) => Math.max(m, l.order), -1);

  await db.insert(quoteLine).values({
    quoteId,
    order: maxOrder + 1,
    description: parsed.data.description,
    quantity: parsed.data.quantity.toString(),
    unitType: parsed.data.unit_type,
    unitPriceCents,
    totalCents,
  });

  await recomputeQuoteTotal(quoteId);
  revalidatePath(`/quotes/${quoteId}`);
  return { success: "Ligne ajoutée." };
}

export async function deleteQuoteLineAction(
  quoteId: string,
  lineId: string,
) {
  const user = await requireUser();
  const [q] = await db
    .select({ id: quote.id, status: quote.status })
    .from(quote)
    .where(and(eq(quote.id, quoteId), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return { error: "Devis introuvable" };
  if (q.status === "ACCEPTED" || q.status === "REJECTED") {
    return { error: "Devis verrouillé" };
  }
  await db
    .delete(quoteLine)
    .where(and(eq(quoteLine.id, lineId), eq(quoteLine.quoteId, quoteId)));
  await recomputeQuoteTotal(quoteId);
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}

async function recomputeQuoteTotal(quoteId: string) {
  const [r] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${quoteLine.totalCents}), 0)`,
    })
    .from(quoteLine)
    .where(eq(quoteLine.quoteId, quoteId));
  const total = Number(r.total);
  await db
    .update(quote)
    .set({ subtotalCents: total, totalCents: total, updatedAt: new Date() })
    .where(eq(quote.id, quoteId));
}

const detailsSchema = z.object({
  issue_date: z.string(),
  valid_until: z.string(),
  notes: z.string().optional(),
});

export async function updateQuoteDetailsAction(
  quoteId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const [q] = await db
    .select({ id: quote.id, status: quote.status })
    .from(quote)
    .where(and(eq(quote.id, quoteId), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return { error: "Devis introuvable" };
  if (q.status === "ACCEPTED" || q.status === "REJECTED") {
    return { error: "Devis verrouillé" };
  }
  await db
    .update(quote)
    .set({
      issueDate: parsed.data.issue_date,
      validUntil: parsed.data.valid_until,
      notes: parsed.data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(quote.id, quoteId));
  revalidatePath(`/quotes/${quoteId}`);
  return { success: "Mis à jour." };
}

export async function sendQuoteAction(quoteId: string) {
  const user = await requireUser();
  const [q] = await db
    .select()
    .from(quote)
    .where(and(eq(quote.id, quoteId), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "DRAFT") return { error: "Statut invalide" };

  const lines = await db
    .select({ id: quoteLine.id })
    .from(quoteLine)
    .where(eq(quoteLine.quoteId, quoteId));
  if (lines.length === 0) {
    return { error: "Ajoute au moins une ligne avant d'envoyer." };
  }

  const number = q.number ?? (await allocateQuoteNumber(user.id, new Date(q.issueDate)));

  await db
    .update(quote)
    .set({
      number,
      status: "SENT",
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quote.id, quoteId));
  revalidatePath("/", "layout");
  return { success: "Devis envoyé." };
}

export async function acceptQuoteAction(quoteId: string) {
  const user = await requireUser();
  const [q] = await db
    .select({ status: quote.status })
    .from(quote)
    .where(and(eq(quote.id, quoteId), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "SENT") {
    return { error: "Le devis doit être au statut 'Envoyé' pour être accepté." };
  }
  await db
    .update(quote)
    .set({
      status: "ACCEPTED",
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quote.id, quoteId));
  revalidatePath("/", "layout");
  return { success: "Devis accepté." };
}

export async function rejectQuoteAction(quoteId: string) {
  const user = await requireUser();
  const [q] = await db
    .select({ status: quote.status })
    .from(quote)
    .where(and(eq(quote.id, quoteId), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "SENT") {
    return { error: "Le devis doit être au statut 'Envoyé' pour être refusé." };
  }
  await db
    .update(quote)
    .set({
      status: "REJECTED",
      rejectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quote.id, quoteId));
  revalidatePath("/", "layout");
  return { success: "Devis refusé." };
}

export async function deleteQuoteAction(quoteId: string) {
  const user = await requireUser();
  const [q] = await db
    .select({ status: quote.status })
    .from(quote)
    .where(and(eq(quote.id, quoteId), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "DRAFT") {
    return { error: "Seuls les brouillons peuvent être supprimés." };
  }
  await db.delete(quote).where(eq(quote.id, quoteId));
  revalidatePath("/quotes");
  redirect("/quotes");
}

export async function convertQuoteToInvoiceAction(quoteId: string) {
  const user = await requireUser();
  const [q] = await db
    .select()
    .from(quote)
    .where(and(eq(quote.id, quoteId), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "ACCEPTED") {
    return { error: "Seul un devis accepté peut être converti en facture." };
  }
  if (q.convertedInvoiceId) {
    return { error: "Devis déjà converti en facture." };
  }

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);
  const [c] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, q.clientId))
    .limit(1);
  if (!profileRow || !c) return { error: "Données manquantes" };

  const profileMissing = getProfileMissingFields(profileRow);
  const clientMissing = getClientMissingFields(c);
  if (profileMissing.length > 0 || clientMissing.length > 0) {
    return {
      error: formatMissingFieldsError({
        profileMissing,
        clientMissing,
        clientName: c.name,
      }),
    };
  }

  const lines = await db
    .select()
    .from(quoteLine)
    .where(eq(quoteLine.quoteId, quoteId))
    .orderBy(quoteLine.order);

  const issueDate = todayISO();
  const dueDate = addDaysISO(issueDate, profileRow.defaultPaymentTermsDays);

  const [inv] = await db
    .insert(invoice)
    .values({
      userId: user.id,
      clientId: c.id,
      number: null,
      issueDate,
      dueDate,
      status: "DRAFT",
      subtotalCents: q.totalCents,
      totalCents: q.totalCents,
      currency: q.currency,
      legalMention: buildLegalMention(profileRow),
      paymentTermsText: buildPaymentTermsText(profileRow),
      notes: q.notes,
    })
    .returning({ id: invoice.id });

  if (lines.length > 0) {
    await db.insert(invoiceLine).values(
      lines.map((l, i) => ({
        invoiceId: inv.id,
        order: i,
        description: l.description,
        quantity: l.quantity,
        unitType: l.unitType,
        unitPriceCents: l.unitPriceCents,
        totalCents: l.totalCents,
      })),
    );
  }

  await db
    .update(quote)
    .set({
      convertedInvoiceId: inv.id,
      updatedAt: new Date(),
    })
    .where(eq(quote.id, quoteId));

  revalidatePath("/", "layout");
  redirect(`/invoices/${inv.id}`);
}
