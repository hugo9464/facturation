import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "./env";

// Client Supabase avec le service role key : contourne la RLS.
// Réservé aux endpoints authentifiés autrement (ex: jeton de preview de tâche),
// jamais à utiliser dans un contexte porté par la session de l'utilisateur.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Client admin Supabase non configuré : SUPABASE_SECRET_KEY manquant",
    );
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
