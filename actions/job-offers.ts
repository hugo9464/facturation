"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { runJobOfferScrape } from "@/lib/job-offer-agent";
import { getSupabaseDb } from "@/lib/supabase/db";

const jobOfferStatusSchema = z.enum(["NEW", "SAVED", "IGNORED", "APPLIED"]);
const jobOfferFeedbackSchema = z.string().trim().min(3).max(1200);

async function saveJobOfferAgentFeedbackMessage(userId: string, message: unknown) {
  const parsedMessage = jobOfferFeedbackSchema.parse(message);
  const supabase = await getSupabaseDb();

  const { error } = await supabase.from("job_offer_agent_feedback").insert({
    user_id: userId,
    message: parsedMessage,
  });

  if (error) throw error;
  return parsedMessage;
}

export async function saveJobOfferAgentFeedbackAction(formData: FormData) {
  const user = await requireUser();
  await saveJobOfferAgentFeedbackMessage(user.id, formData.get("message"));
  revalidatePath("/job-offers");
  return { ok: true as const };
}

export async function retriggerJobOfferSearchAction(instruction?: string) {
  try {
    const user = await requireUser();
    if (instruction?.trim()) {
      await saveJobOfferAgentFeedbackMessage(user.id, instruction);
    }
    const result = await runJobOfferScrape({ userIds: [user.id] });

    revalidatePath("/job-offers");
    return { ok: true as const, ...result };
  } catch (error) {
    console.error("manual job offer search failed", error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "La recherche a échoué.",
    };
  }
}

export async function updateJobOfferStatusAction(formData: FormData) {
  const user = await requireUser();
  const id = z.string().uuid().parse(formData.get("id"));
  const status = jobOfferStatusSchema.parse(formData.get("status"));
  const supabase = await getSupabaseDb();

  const { error } = await supabase
    .from("job_offer")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  revalidatePath("/job-offers");
}
