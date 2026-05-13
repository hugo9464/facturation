"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  buildLegalMention,
  buildPaymentTermsText,
  buildQuoteLegalMention,
} from "@/lib/legal";
import { addDaysISO, todayISO } from "@/lib/dates";
import { allocateQuoteNumber } from "@/lib/invoice-numbering";
import { eurosToCents } from "@/lib/money";
import {
  formatMissingFieldsError,
  getClientMissingFields,
  getProfileMissingFields,
} from "@/lib/billing-readiness";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toQuote,
  toQuoteLine,
} from "@/lib/supabase/db";

const QUOTE_VALIDITY_DAYS = 30;

async function getQuoteForUser(quoteId: string, userId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("quote")
    .select("*")
    .eq("id", quoteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toQuote(data) : null;
}

async function getQuoteLines(quoteId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("quote_line")
    .select("*")
    .eq("quote_id", quoteId)
    .order("order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toQuoteLine);
}

async function recomputeQuoteTotal(quoteId: string) {
  const lines = await getQuoteLines(quoteId);
  const total = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("quote")
    .update({
      subtotal_cents: total,
      total_cents: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId);
  if (error) throw error;
}

export async function createDraftQuoteAction(input: { projectId: string }) {
  const user = await requireUser();
  if (!input.projectId) return { error: "Projet manquant" };

  const profileRow = await getProfile(user.id);
  const supabase = await getSupabaseDb();
  const { data: projectRow, error: projectError } = await supabase
    .from("todo_project")
    .select("client:client_id(*)")
    .eq("id", input.projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (projectError) throw projectError;

  const clientRow = Array.isArray(projectRow?.client)
    ? projectRow.client[0]
    : projectRow?.client;
  const c = clientRow ? toClient(clientRow) : null;
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

  const { data, error } = await supabase
    .from("quote")
    .insert({
      user_id: user.id,
      client_id: c.id,
      project_id: input.projectId,
      number: null,
      issue_date: issueDate,
      valid_until: validUntil,
      status: "DRAFT",
      subtotal_cents: 0,
      total_cents: 0,
      currency: "EUR",
      legal_mention: buildQuoteLegalMention(profileRow),
      payment_terms_text: buildPaymentTermsText(profileRow),
      notes: null,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/quotes");
  redirect(`/quotes/${data.id}`);
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
  const q = await getQuoteForUser(quoteId, user.id);
  if (!q) return { error: "Devis introuvable" };
  if (q.status === "ACCEPTED" || q.status === "REJECTED") {
    return { error: "Devis verrouillé — modifications impossibles." };
  }

  const unitPriceCents = eurosToCents(parsed.data.unit_price);
  const totalCents = Math.round(parsed.data.quantity * unitPriceCents);
  const existing = await getQuoteLines(quoteId);
  const maxOrder = existing.reduce((m, l) => Math.max(m, l.order), -1);

  const supabase = await getSupabaseDb();
  const { error } = await supabase.from("quote_line").insert({
    quote_id: quoteId,
    order: maxOrder + 1,
    description: parsed.data.description,
    quantity: parsed.data.quantity.toString(),
    unit_type: parsed.data.unit_type,
    unit_price_cents: unitPriceCents,
    total_cents: totalCents,
  });
  if (error) throw error;

  await recomputeQuoteTotal(quoteId);
  revalidatePath(`/quotes/${quoteId}`);
  return { success: "Ligne ajoutée." };
}

export async function deleteQuoteLineAction(quoteId: string, lineId: string) {
  const user = await requireUser();
  const q = await getQuoteForUser(quoteId, user.id);
  if (!q) return { error: "Devis introuvable" };
  if (q.status === "ACCEPTED" || q.status === "REJECTED") {
    return { error: "Devis verrouillé" };
  }

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("quote_line")
    .delete()
    .eq("id", lineId)
    .eq("quote_id", quoteId);
  if (error) throw error;

  await recomputeQuoteTotal(quoteId);
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
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
  const q = await getQuoteForUser(quoteId, user.id);
  if (!q) return { error: "Devis introuvable" };
  if (q.status === "ACCEPTED" || q.status === "REJECTED") {
    return { error: "Devis verrouillé" };
  }

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("quote")
    .update({
      issue_date: parsed.data.issue_date,
      valid_until: parsed.data.valid_until,
      notes: parsed.data.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath(`/quotes/${quoteId}`);
  return { success: "Mis à jour." };
}

export async function sendQuoteAction(quoteId: string) {
  const user = await requireUser();
  const q = await getQuoteForUser(quoteId, user.id);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "DRAFT") return { error: "Statut invalide" };

  const lines = await getQuoteLines(quoteId);
  if (lines.length === 0) {
    return { error: "Ajoute au moins une ligne avant d'envoyer." };
  }

  const number = q.number ?? (await allocateQuoteNumber(user.id, new Date(q.issueDate)));
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("quote")
    .update({
      number,
      status: "SENT",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/", "layout");
  return { success: "Devis envoyé." };
}

export async function acceptQuoteAction(quoteId: string) {
  const user = await requireUser();
  const q = await getQuoteForUser(quoteId, user.id);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "SENT") {
    return { error: "Le devis doit être au statut 'Envoyé' pour être accepté." };
  }

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("quote")
    .update({
      status: "ACCEPTED",
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/", "layout");
  return { success: "Devis accepté." };
}

export async function rejectQuoteAction(quoteId: string) {
  const user = await requireUser();
  const q = await getQuoteForUser(quoteId, user.id);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "SENT") {
    return { error: "Le devis doit être au statut 'Envoyé' pour être refusé." };
  }

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("quote")
    .update({
      status: "REJECTED",
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/", "layout");
  return { success: "Devis refusé." };
}

export async function deleteQuoteAction(quoteId: string) {
  const user = await requireUser();
  const q = await getQuoteForUser(quoteId, user.id);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "DRAFT") {
    return { error: "Seuls les brouillons peuvent être supprimés." };
  }

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("quote")
    .delete()
    .eq("id", quoteId)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/quotes");
  redirect("/quotes");
}

export async function convertQuoteToInvoiceAction(quoteId: string) {
  const user = await requireUser();
  const q = await getQuoteForUser(quoteId, user.id);
  if (!q) return { error: "Devis introuvable" };
  if (q.status !== "ACCEPTED") {
    return { error: "Seul un devis accepté peut être converti en facture." };
  }
  if (q.convertedInvoiceId) {
    return { error: "Devis déjà converti en facture." };
  }
  if (!q.projectId) {
    return { error: "Associe ce devis à un projet avant conversion." };
  }

  const profileRow = await getProfile(user.id);
  const supabase = await getSupabaseDb();
  const { data: clientRow, error: clientError } = await supabase
    .from("client")
    .select("*")
    .eq("id", q.clientId)
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

  const lines = await getQuoteLines(quoteId);
  const issueDate = todayISO();
  const dueDate = addDaysISO(issueDate, profileRow.defaultPaymentTermsDays);

  const { data: inv, error: invoiceError } = await supabase
    .from("invoice")
    .insert({
      user_id: user.id,
      client_id: c.id,
      project_id: q.projectId,
      number: null,
      issue_date: issueDate,
      due_date: dueDate,
      status: "DRAFT",
      subtotal_cents: q.totalCents,
      total_cents: q.totalCents,
      currency: q.currency,
      legal_mention: buildLegalMention(profileRow),
      payment_terms_text: buildPaymentTermsText(profileRow),
      notes: q.notes,
    })
    .select("id")
    .single();
  if (invoiceError) throw invoiceError;

  if (lines.length > 0) {
    const { error } = await supabase.from("invoice_line").insert(
      lines.map((l, i) => ({
        invoice_id: inv.id,
        order: i,
        description: l.description,
        quantity: l.quantity,
        unit_type: l.unitType,
        unit_price_cents: l.unitPriceCents,
        total_cents: l.totalCents,
        time_entry_ids: [],
      })),
    );
    if (error) throw error;
  }

  const { error: updateError } = await supabase
    .from("quote")
    .update({
      converted_invoice_id: inv.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;

  revalidatePath("/", "layout");
  redirect(`/invoices/${inv.id}`);
}
