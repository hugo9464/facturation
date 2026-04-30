import { db } from "@/db";
import { client, profile, timeEntry } from "@/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { NewInvoiceWizard } from "./wizard";
import { getProfileMissingFields } from "@/lib/billing-readiness";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const user = await requireUser();
  const { client: preselectedClientId } = await searchParams;

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

  const unbilledEntries = await db
    .select()
    .from(timeEntry)
    .where(
      and(eq(timeEntry.userId, user.id), isNull(timeEntry.invoiceId)),
    )
    .orderBy(desc(timeEntry.date));

  const profileMissing = getProfileMissingFields(profileRow);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouvelle facture
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisis un client puis sélectionne les saisies à facturer.
        </p>
      </div>
      <NewInvoiceWizard
        clients={clients}
        unbilledEntries={unbilledEntries}
        preselectedClientId={preselectedClientId}
        profileMissing={profileMissing}
      />
    </div>
  );
}
