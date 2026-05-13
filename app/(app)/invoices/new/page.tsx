import { requireUser } from "@/lib/auth";
import { NewInvoiceWizard } from "./wizard";
import { getProfileMissingFields } from "@/lib/billing-readiness";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toTimeEntry,
  toTodoProject,
} from "@/lib/supabase/db";
import type { Client, TodoProject } from "@/db/schema";

type ProjectOption = TodoProject & { client: Client };

function isProjectOption(project: ProjectOption | null): project is ProjectOption {
  return project !== null;
}

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

  const { data: projectRows, error: projectsError } = await supabase
    .from("todo_project")
    .select("*, client:client_id(*)")
    .eq("user_id", user.id)
    .not("client_id", "is", null)
    .order("name", { ascending: true });
  if (projectsError) throw projectsError;

  const projects = (projectRows ?? [])
    .map((row) => {
      const rawClient = Array.isArray(row.client) ? row.client[0] : row.client;
      return rawClient ? { ...toTodoProject(row), client: toClient(rawClient) } : null;
    })
    .filter(isProjectOption)
    .filter((project) => !project.client.archived);
  const preselectedProjectId =
    projects.find((project) => project.id === requestedProjectId)?.id ??
    (preselectedClientId
      ? projects.find((project) => project.clientId === preselectedClientId)?.id
      : undefined);

  const { data: entryRows, error: entriesError } = await supabase
    .from("time_entry")
    .select("*")
    .eq("user_id", user.id)
    .is("invoice_id", null)
    .order("date", { ascending: false });
  if (entriesError) throw entriesError;
  const unbilledEntries = (entryRows ?? []).map(toTimeEntry);

  const profileMissing = getProfileMissingFields(profileRow);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouvelle facture
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisis un projet puis sélectionne les saisies à facturer.
        </p>
      </div>
      <NewInvoiceWizard
        projects={projects}
        unbilledEntries={unbilledEntries}
        preselectedProjectId={preselectedProjectId}
        profileMissing={profileMissing}
      />
    </div>
  );
}
