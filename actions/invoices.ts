"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { buildLegalMention, buildPaymentTermsText } from "@/lib/legal";
import {
  formatMissingFieldsError,
  getClientMissingFields,
  getProfileMissingFields,
} from "@/lib/billing-readiness";
import { addDaysISO, todayISO } from "@/lib/dates";
import { allocateInvoiceNumber } from "@/lib/invoice-numbering";
import { sendInvoiceEmail } from "@/lib/email";
import { eurosToCents } from "@/lib/money";
import { renderInvoicePDFToBuffer } from "@/lib/pdf-render";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toInvoice,
  toInvoiceLine,
  toTimeEntry,
} from "@/lib/supabase/db";
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

async function getInvoiceForUser(invoiceId: string, userId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("invoice")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toInvoice(data) : null;
}

async function getInvoiceLines(invoiceId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("invoice_line")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toInvoiceLine);
}

async function recomputeInvoiceTotal(invoiceId: string) {
  const lines = await getInvoiceLines(invoiceId);
  const total = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("invoice")
    .update({
      subtotal_cents: total,
      total_cents: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (error) throw error;
}

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
  const supabase = await getSupabaseDb();

  const profileRow = await getProfile(user.id);
  const { data: clientRow, error: clientError } = await supabase
    .from("client")
    .select("*")
    .eq("id", data.clientId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (clientError) throw clientError;
  const c = clientRow ? toClient(clientRow) : null;
  if (!c) return { error: "Client introuvable" };
  if (c.archived) return { error: "Ce client est archivé." };

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
  if (!profileRow) return { error: "Paramètres d'entreprise manquants." };

  const allRequestedTimeEntryIds = data.lines.flatMap((line) => line.timeEntryIds);
  const requestedTimeEntryIds = Array.from(new Set(allRequestedTimeEntryIds));
  if (requestedTimeEntryIds.length !== allRequestedTimeEntryIds.length) {
    return { error: "Une saisie ne peut être facturée qu'une seule fois." };
  }

  if (requestedTimeEntryIds.length > 0) {
    const { data: rows, error } = await supabase
      .from("time_entry")
      .select("*")
      .in("id", requestedTimeEntryIds)
      .eq("user_id", user.id)
      .eq("client_id", data.clientId);
    if (error) throw error;
    const entries = (rows ?? []).map(toTimeEntry);
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
        error: "Certaines saisies ne sont plus facturables pour cette période.",
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

  const { data: created, error: createError } = await supabase
    .from("invoice")
    .insert({
      user_id: user.id,
      client_id: c.id,
      project_id: null,
      number: null,
      issue_date: issueDate,
      due_date: dueDate,
      status: "DRAFT",
      subtotal_cents: subtotalCents,
      total_cents: subtotalCents,
      currency: "EUR",
      legal_mention: buildLegalMention(profileRow),
      payment_terms_text: buildPaymentTermsText(profileRow),
      notes: null,
    })
    .select("id")
    .single();
  if (createError) throw createError;

  const { error: linesError } = await supabase.from("invoice_line").insert(
    lines.map((l, i) => ({
      invoice_id: created.id,
      order: i,
      description: l.description,
      quantity: l.quantity.toString(),
      unit_type: l.unitType,
      unit_price_cents: l.unitPriceCents,
      total_cents: l.totalCents,
      time_entry_ids: l.timeEntryIds,
    })),
  );
  if (linesError) throw linesError;

  revalidatePath("/invoices");
  redirect(`/invoices/${created.id}`);
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
  const inv = await getInvoiceForUser(invoiceId, user.id);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") {
    return { error: "Facture déjà émise — modification impossible." };
  }

  const unitPriceCents = eurosToCents(parsed.data.unit_price);
  const totalCents = Math.round(parsed.data.quantity * unitPriceCents);
  const existingLines = await getInvoiceLines(invoiceId);
  const maxOrder = existingLines.reduce((m, l) => Math.max(m, l.order), -1);

  const supabase = await getSupabaseDb();
  const { error } = await supabase.from("invoice_line").insert({
    invoice_id: invoiceId,
    order: maxOrder + 1,
    description: parsed.data.description,
    quantity: parsed.data.quantity.toString(),
    unit_type: parsed.data.unit_type,
    unit_price_cents: unitPriceCents,
    total_cents: totalCents,
    time_entry_ids: [],
  });
  if (error) throw error;

  await recomputeInvoiceTotal(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: "Ligne ajoutée." };
}

export async function deleteInvoiceLineAction(
  invoiceId: string,
  lineId: string,
) {
  const user = await requireUser();
  const inv = await getInvoiceForUser(invoiceId, user.id);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") return { error: "Facture déjà émise" };

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("invoice_line")
    .delete()
    .eq("id", lineId)
    .eq("invoice_id", invoiceId);
  if (error) throw error;

  await recomputeInvoiceTotal(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true };
}

const lineDescriptionSchema = z.object({
  description: z.string().trim().min(1, "La description est obligatoire"),
});

export async function updateInvoiceLineDescriptionAction(
  invoiceId: string,
  lineId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const parsed = lineDescriptionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const inv = await getInvoiceForUser(invoiceId, user.id);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") return { error: "Facture déjà émise" };

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("invoice_line")
    .update({ description: parsed.data.description })
    .eq("id", lineId)
    .eq("invoice_id", invoiceId);
  if (error) throw error;

  revalidatePath(`/invoices/${invoiceId}`);
  return { success: "Description mise à jour." };
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
  const inv = await getInvoiceForUser(invoiceId, user.id);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") return { error: "Facture déjà émise" };

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("invoice")
    .update({
      issue_date: parsed.data.issue_date,
      due_date: parsed.data.due_date,
      notes: parsed.data.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath(`/invoices/${invoiceId}`);
  return { success: "Mis à jour." };
}

export async function emitInvoiceAction(invoiceId: string) {
  const user = await requireUser();
  const inv = await getInvoiceForUser(invoiceId, user.id);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "DRAFT") return { error: "Facture déjà émise" };

  const lines = await getInvoiceLines(invoiceId);
  if (lines.length === 0) {
    return { error: "Ajoute au moins une ligne avant d'émettre." };
  }

  const profileRow = await getProfile(user.id);
  const supabase = await getSupabaseDb();
  const { data: clientRow, error: clientError } = await supabase
    .from("client")
    .select("*")
    .eq("id", inv.clientId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (clientError) throw clientError;
  const c = clientRow ? toClient(clientRow) : null;
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

  const number = await allocateInvoiceNumber(user.id, new Date(inv.issueDate));
  const buffer = await renderInvoicePDFToBuffer({
    invoice: { ...inv, number },
    lines,
    client: c,
    profile: profileRow,
  });

  const storage = await createSupabase();
  const path = `${user.id}/${number}.pdf`;
  const { error: uploadError } = await storage.storage
    .from("invoices")
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) return { error: `Upload PDF: ${uploadError.message}` };

  const { error: updateError } = await supabase
    .from("invoice")
    .update({
      number,
      status: "SENT",
      sent_at: new Date().toISOString(),
      pdf_storage_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;

  const allTimeEntryIds = lines.flatMap((l) => l.timeEntryIds);
  if (allTimeEntryIds.length > 0) {
    const { error } = await supabase
      .from("time_entry")
      .update({
        invoice_id: invoiceId,
        updated_at: new Date().toISOString(),
      })
      .in("id", allTimeEntryIds)
      .eq("user_id", user.id);
    if (error) throw error;
  }

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
  const inv = await getInvoiceForUser(invoiceId, user.id);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status !== "SENT" && inv.status !== "OVERDUE") {
    return { error: "Seules les factures émises peuvent être marquées payées." };
  }

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("invoice")
    .update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      payment_method: method,
      payment_reference: reference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/", "layout");
  return { success: "Facture marquée payée." };
}

const sendInvoiceEmailSchema = z.object({
  subject: z.string().trim().min(1, "L'objet est obligatoire"),
  body: z.string().trim().min(1, "Le message est obligatoire"),
});

export async function sendInvoiceEmailAction(
  invoiceId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const parsed = sendInvoiceEmailSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const inv = await getInvoiceForUser(invoiceId, user.id);
  if (!inv) return { error: "Facture introuvable" };
  if (inv.status === "DRAFT") {
    return { error: "Émets la facture avant de l'envoyer par email." };
  }
  if (!inv.number) return { error: "Numéro de facture manquant." };

  const supabase = await getSupabaseDb();
  const [profileRow, clientResult, lines] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("client")
      .select("*")
      .eq("id", inv.clientId)
      .eq("user_id", user.id)
      .maybeSingle(),
    getInvoiceLines(invoiceId),
  ]);
  if (clientResult.error) throw clientResult.error;

  const c = clientResult.data ? toClient(clientResult.data) : null;
  if (!profileRow || !c) return { error: "Données manquantes." };
  if (!c.email) {
    return { error: `Aucun email renseigné pour ${c.name}.` };
  }

  const pdf = await renderInvoicePDFToBuffer({
    invoice: inv,
    lines,
    client: c,
    profile: profileRow,
  });

  const result = await sendInvoiceEmail({
    to: c.email,
    fromName: profileRow.businessName,
    replyTo: profileRow.email,
    invoiceNumber: inv.number,
    subject: parsed.data.subject,
    body: parsed.data.body,
    pdf,
  });

  if (result.error) return result;

  const { error: updateError } = await supabase
    .from("invoice")
    .update({
      email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { success: `Email envoyé à ${c.email}.` };
}

export async function cancelInvoiceAction(invoiceId: string) {
  const user = await requireUser();
  const inv = await getInvoiceForUser(invoiceId, user.id);
  if (!inv) return { error: "Facture introuvable" };

  const supabase = await getSupabaseDb();
  if (inv.status === "DRAFT") {
    const { error } = await supabase
      .from("invoice")
      .delete()
      .eq("id", invoiceId)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/invoices");
    redirect("/invoices");
  }

  const { error } = await supabase
    .from("invoice")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("user_id", user.id);
  if (error) throw error;

  const { error: entriesError } = await supabase
    .from("time_entry")
    .update({ invoice_id: null, updated_at: new Date().toISOString() })
    .eq("invoice_id", invoiceId)
    .eq("user_id", user.id);
  if (entriesError) throw entriesError;

  revalidatePath("/", "layout");
  return { success: "Facture annulée." };
}
