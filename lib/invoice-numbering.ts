import { getProfile, getSupabaseDb } from "@/lib/supabase/db";

export async function allocateInvoiceNumber(
  userId: string,
  issueDate: Date,
): Promise<string> {
  const year = issueDate.getFullYear();
  const month = String(issueDate.getMonth() + 1).padStart(2, "0");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("Profile not found — set up settings first");
  const seq = profile.nextInvoiceNumber;
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("profile")
    .update({
      next_invoice_number: seq + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;
  return `FACTURE-${year}-${month}-${String(seq).padStart(4, "0")}`;
}

export async function allocateQuoteNumber(
  userId: string,
  issueDate: Date,
): Promise<string> {
  const year = issueDate.getFullYear();
  const profile = await getProfile(userId);
  if (!profile) throw new Error("Profile not found");
  const seq = profile.nextQuoteNumber;
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("profile")
    .update({
      next_quote_number: seq + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;
  return `D${year}-${String(seq).padStart(3, "0")}`;
}
