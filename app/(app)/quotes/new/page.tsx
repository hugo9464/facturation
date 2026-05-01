import { db } from "@/db";
import { client, profile } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { NewQuotePicker } from "./client-picker";
import { getProfileMissingFields } from "@/lib/billing-readiness";

export default async function NewQuotePage() {
  const user = await requireUser();

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);

  const clients = await db
    .select()
    .from(client)
    .where(and(eq(client.userId, user.id), eq(client.archived, false)))
    .orderBy(client.name);

  const profileMissing = getProfileMissingFields(profileRow);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouveau devis
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisis le client. Tu pourras ensuite ajouter les lignes du devis.
        </p>
      </div>
      <NewQuotePicker clients={clients} profileMissing={profileMissing} />
    </div>
  );
}
