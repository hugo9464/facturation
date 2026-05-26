import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocalhostServerRequest } from "@/lib/local-dev-server";
import { redirect } from "next/navigation";

const DEV_USER_ID =
  process.env.LOCALHOST_USER_ID ?? "00000000-0000-4000-8000-000000000001";
const DEV_USER_EMAIL = process.env.LOCALHOST_USER_EMAIL ?? "dev@localhost";

export type AppUser = {
  id: string;
  email?: string;
};

async function getLocalhostUser(): Promise<AppUser> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profile")
    .select("user_id, email")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  return {
    id: (data?.user_id as string | undefined) ?? DEV_USER_ID,
    email: (data?.email as string | undefined) ?? DEV_USER_EMAIL,
  };
}

export async function getUser() {
  if (await isLocalhostServerRequest()) {
    return getLocalhostUser();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
