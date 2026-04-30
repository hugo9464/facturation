import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/app/(app)/settings/settings-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  const [row] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);
  if (row) redirect("/");
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bienvenue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Renseigne tes informations d&apos;entreprise pour pouvoir émettre des factures.
          </p>
        </div>
        <SettingsForm initial={null} userEmail={user.email ?? ""} />
      </div>
    </div>
  );
}
