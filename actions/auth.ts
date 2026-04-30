"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum"),
});

export async function loginAction(_prev: unknown, formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signupAction(_prev: unknown, formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const [{ value: existingProfiles }] = await db
    .select({ value: count() })
    .from(profile);
  if (existingProfiles > 0) {
    return {
      error:
        "Inscription verrouillée : un compte existe déjà sur cette instance.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  return {
    success:
      "Compte créé. Vérifie ta boîte mail pour confirmer (ou désactive l'email confirmation dans Supabase Dashboard → Auth → Email Auth pour aller plus vite).",
  };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
