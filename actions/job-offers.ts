"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getSupabaseDb } from "@/lib/supabase/db";

const jobOfferStatusSchema = z.enum(["NEW", "SAVED", "IGNORED", "APPLIED"]);
const jobOfferFeedbackSchema = z.string().trim().min(3).max(1200);

export async function saveJobOfferAgentFeedbackAction(formData: FormData) {
  const user = await requireUser();
  const message = jobOfferFeedbackSchema.parse(formData.get("message"));
  const supabase = await getSupabaseDb();

  const { error } = await supabase.from("job_offer_agent_feedback").insert({
    user_id: user.id,
    message,
  });

  if (error) throw error;
  revalidatePath("/job-offers");
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
