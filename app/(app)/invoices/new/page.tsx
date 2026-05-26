import { requireUser } from "@/lib/auth";
import { NewInvoiceWizard } from "./wizard";
import { getProfileMissingFields } from "@/lib/billing-readiness";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toTimeEntry,
} from "@/lib/supabase/db";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; project?: string }>;
}) {
  const user = await requireUser();
  const { client: preselectedClientId, project: requestedProjectId } =
    await searchParams;
  const supabase = await getSupabaseDb();

  const profileRow = await getProfile(user.id);

  const [clientsResult, requestedProjectResult, entriesResult] = await Promise.all([
    supabase
      .from("client")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("name", { ascending: true }),
    requestedProjectId
      ? supabase
          .from("todo_project")
          .select("client_id")
          .eq("id", requestedProjectId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("time_entry")
      .select("*")
      .eq("user_id", user.id)
      .is("invoice_id", null)
      .order("date", { ascending: false }),
  ]);

  if (clientsResult.error) throw clientsResult.error;
  if (requestedProjectResult.error) throw requestedProjectResult.error;
  if (entriesResult.error) throw entriesResult.error;

  const clients = (clientsResult.data ?? []).map(toClient);
  const requestedProjectClientId =
    (requestedProjectResult.data?.client_id as string | null | undefined) ??
    undefined;
  const preselectedClientIdValue =
    clients.find((client) => client.id === preselectedClientId)?.id ??
    clients.find((client) => client.id === requestedProjectClientId)?.id ??
    undefined;
  const unbilledEntries = (entriesResult.data ?? []).map(toTimeEntry);

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
        preselectedClientId={preselectedClientIdValue}
        profileMissing={profileMissing}
      />
    </div>
  );
}
