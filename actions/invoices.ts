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
  timeEntry,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { buildLegalMention, buildPaymentTermsText } from "@/lib/legal";
import {
  formatMissingFieldsError,
  getClientMissingFields,
  getProfileMissingFields,
} from "@/lib/billing-readiness";
import { addDaysISO, todayISO } from "@/lib/dates";
import { allocateInvoiceNumber } from "@/lib/invoice-numbering";
import { eurosToCents } from "@/lib/money";
import { renderInvoicePDFToBuffer } from "@/lib/pdf-render";
import { createClient as createSupabase } from "@/lib/supabase/server";

const draftLineSchema = z.object({
  description: z.string().trim().min(1, "La description est obligatoire"),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
  unitType: z.enum(["DAY", "HALF_DAY", "HOUR", "FORFAIT"]),
  unitPriceCents: z.coerce.number().int().nonnegative(),
  timeEntryIds: z.array(z.string().uuid()).default([]),
});

const draftSchema = z
  .object({
    clientId: z.string().uuid(),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lines: z.array(draftLineSchema).min(1, "Ajoute au moins une ligne"),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "La date de fin doit être après la date de début",
    path: ["periodEnd"],
  });

export async function createDraftInvoiceAction(input: {
  clientId: string;
  periodStart: string;
  periodEnd: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitType: "DAY" | "HALF_DAY" | "HOUR" | "FORFAIT";
    unitPriceCents: number;
    timeEntryIds: string[];
  }>;
}) {
  const user = await requireUser();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const data = parsed.data;

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);

  const [c] = await db
    .select()
    .from(clientTable)
    .where(
      and(eq(clientTable.id, data.clientId), eq(clientTable.userId, user.id)),
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
  if (!profileRow) {
    return { error: "Paramètres d'entreprise manquants." };
  }

  const allRequestedTimeEntryIds = data.lines.flatMap((line) => line.timeEntryIds);
  const requestedTimeEntryIds = Array.from(new Set(allRequestedTimeEntryIds));
  if (requestedTimeEntryIds.length !== allRequestedTimeEntryIds.length) {
    return { error: "Une saisie ne peut être facturée qu'une seule fois." };
  }
  if (requestedTimeEntryIds.length > 0) {
    const entries = await db
      .select()
      .from(timeEntry)
      .where(
        and(
          inArray(timeEntry.id, requestedTimeEntryIds),
          eq(timeEntry.userId, user.id),
          eq(timeEntry.clientId, data.clientId),
        ),
      );
    const validEntryIds = new Set(
      entries
        .filter(
          (entry) =>
            !entry.invoiceId &&
            entry.date >= data.periodStart &&
            entry.date <= data.periodEnd,
        )
        .map((entry) => entry.id),
    );
    if (validEntryIds.size !== requestedTimeEntryIds.length) {
      return {
        error:
          "Certaines saisies ne sont plus facturables pour cette période.",
      };
    }
  }

  const lines = data.lines.map((line) => {
    const totalCents = Math.round(line.quantity * line.unitPriceCents);
    return {
      description: line.description.trim(),
      quantity: line.quantity,
      unitType: line.unitType,
      unitPriceCents: line.unitPriceCents,
      totalCents,
      timeEntryIds: Array.from(new Set(line.timeEntryIds)),
    };
  });
  const subtotalCents = lines.reduce((acc, l) => acc + l.totalCents, 0);

  const issueDate = todayISO();
  const dueDate = addDaysISO(issueDate, profileRow.defaultPaymentTermsDays);

  const inv = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(invoice)
      .values({
        userId: user.id,
        clientId: c.id,
        number: null,
        issueDate,
        dueDate,
        status: "DRAFT",
        subtotalCents,
        totalCents: subtotalCents,
        currency: "EUR",
        legalMention: buildLegalMention(profileRow),
        paymentTermsText: buildPaymentTermsText(profileRow),
        notes: null,
      })
      .returning({ id: invoice.id });

    await tx.insert(invoiceLine).values(
      lines.map((l, i) => ({
        invoiceId: created.id,
        order: i,
        description: l.description,
        quantity: l.quantity.toString(),
        unitType: l.unitType,
        unitPriceCents: l.unitPriceCents,
        totalCents: l.totalCents,
        timeEntryIds: l.timeEntryIds,
      })),
    );

    return created;
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit_type: z.enum(["DAY", "HALF_DAY", "HOUR", "FORFAIT"]),
  unit_price: z.string().min(1),
});

export async function addInvoiceLineAction(
  invoiceId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const parsed = lineSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const [inv] = await db
    .select({ id: invoice.id, status: invoice.status })
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, user.id)))
    .limit(1);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") {
    return { error: "Facture déjà émise — modification impossible." };
  }

  const unitPriceCents = eurosToCents(parsed.data.unit_price);
  const totalCents = Math.round(parsed.data.quantity * unitPriceCents);

  const existingLines = await db
    .select({ order: invoiceLine.order })
    .from(invoiceLine)
    .where(eq(invoiceLine.invoiceId, invoiceId));
  const maxOrder = existingLines.reduce((m, l) => Math.max(m, l.order), -1);

  await db.insert(invoiceLine).values({
    invoiceId,
    order: maxOrder + 1,
    description: parsed.data.description,
    quantity: parsed.data.quantity.toString(),
    unitType: parsed.data.unit_type,
    unitPriceCents,
    totalCents,
  });

  await recomputeInvoiceTotal(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: "Ligne ajoutée." };
}

export async function deleteInvoiceLineAction(
  invoiceId: string,
  lineId: string,
) {
  const user = await requireUser();
  const [inv] = await db
    .select({ id: invoice.id, status: invoice.status })
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, user.id)))
    .limit(1);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") return { error: "Facture déjà émise" };
  await db
    .delete(invoiceLine)
    .where(
      and(eq(invoiceLine.id, lineId), eq(invoiceLine.invoiceId, invoiceId)),
    );
  await recomputeInvoiceTotal(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true };
}

async function recomputeInvoiceTotal(invoiceId: string) {
  const [r] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${invoiceLine.totalCents}), 0)`,
    })
    .from(invoiceLine)
    .where(eq(invoiceLine.invoiceId, invoiceId));
  const total = Number(r.total);
  await db
    .update(invoice)
    .set({ subtotalCents: total, totalCents: total, updatedAt: new Date() })
    .where(eq(invoice.id, invoiceId));
}

const detailsSchema = z.object({
  issue_date: z.string(),
  due_date: z.string(),
  notes: z.string().optional(),
});

export async function updateInvoiceDetailsAction(
  invoiceId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const [inv] = await db
    .select({ id: invoice.id, status: invoice.status })
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, user.id)))
    .limit(1);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") return { error: "Facture déjà émise" };
  await db
    .update(invoice)
    .set({
      issueDate: parsed.data.issue_date,
      dueDate: parsed.data.due_date,
      notes: parsed.data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(invoice.id, invoiceId));
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: "Mis à jour." };
}

export async function emitInvoiceAction(invoiceId: string) {
  const user = await requireUser();
  const [inv] = await db
    .select()
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, user.id)))
    .limit(1);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") return { error: "Facture déjà émise" };

  const lines = await db
    .select()
    .from(invoiceLine)
    .where(eq(invoiceLine.invoiceId, invoiceId))
    .orderBy(invoiceLine.order);
  if (lines.length === 0) {
    return { error: "Ajoute au moins une ligne avant d'émettre." };
  }

  const number = await allocateInvoiceNumber(user.id, new Date(inv.issueDate));

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);
  const [c] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, inv.clientId))
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

  const buffer = await renderInvoicePDFToBuffer({
    invoice: { ...inv, number },
    lines,
    client: c,
    profile: profileRow,
  });

  const supabase = await createSupabase();
  const path = `${user.id}/${number}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    return { error: `Upload PDF: ${uploadError.message}` };
  }

  const allTimeEntryIds = lines.flatMap((l) => l.timeEntryIds);

  await db.transaction(async (tx) => {
    await tx
      .update(invoice)
      .set({
        number,
        status: "SENT",
        sentAt: new Date(),
        pdfStoragePath: path,
        updatedAt: new Date(),
      })
      .where(eq(invoice.id, invoiceId));
    if (allTimeEntryIds.length > 0) {
      await tx
        .update(timeEntry)
        .set({ invoiceId, updatedAt: new Date() })
        .where(inArray(timeEntry.id, allTimeEntryIds));
    }
  });

  revalidatePath("/", "layout");
  return { success: "Facture émise." };
}

export async function markInvoicePaidAction(
  invoiceId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const method = (formData.get("method") as string) || "Virement";
  const reference = (formData.get("reference") as string) || null;
  const [inv] = await db
    .select({ status: invoice.status })
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, user.id)))
    .limit(1);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "SENT" && inv.status !== "OVERDUE") {
    return { error: "Seules les factures émises peuvent être marquées payées." };
  }
  await db
    .update(invoice)
    .set({
      status: "PAID",
      paidAt: new Date(),
      paymentMethod: method,
      paymentReference: reference,
      updatedAt: new Date(),
    })
    .where(eq(invoice.id, invoiceId));
  revalidatePath("/", "layout");
  return { success: "Facture marquée payée." };
}

export async function cancelInvoiceAction(invoiceId: string) {
  const user = await requireUser();
  const [inv] = await db
    .select({ status: invoice.status })
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, user.id)))
    .limit(1);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status === "DRAFT") {
    // Hard delete drafts
    await db.delete(invoice).where(eq(invoice.id, invoiceId));
    revalidatePath("/invoices");
    redirect("/invoices");
  }
  await db
    .update(invoice)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(invoice.id, invoiceId));
  // Free the time entries so they can be re-billed
  await db
    .update(timeEntry)
    .set({ invoiceId: null, updatedAt: new Date() })
    .where(eq(timeEntry.invoiceId, invoiceId));
  revalidatePath("/", "layout");
  return { success: "Facture annulée." };
}
