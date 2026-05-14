import { createClient } from "@supabase/supabase-js";

// Client Supabase avec le service role key : contourne la RLS.
// Réservé aux endpoints authentifiés autrement (ex: jeton de preview de tâche),
// jamais à utiliser dans un contexte porté par la session de l'utilisateur.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Client admin Supabase non configuré : SUPABASE_SECRET_KEY manquant",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
