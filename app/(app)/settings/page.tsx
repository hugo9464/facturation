import { redirect } from "next/navigation";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const [row] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);
  if (!row) redirect("/onboarding");
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tes informations d&apos;entreprise apparaîtront sur les factures.
        </p>
      </div>
      <SettingsForm initial={row} userEmail={user.email ?? ""} />
    </div>
  );
}
