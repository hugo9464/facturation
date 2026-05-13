import { requireUser } from "@/lib/auth";
import { NewQuotePicker } from "./client-picker";
import { getProfileMissingFields } from "@/lib/billing-readiness";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toTodoProject,
} from "@/lib/supabase/db";
import type { Client, TodoProject } from "@/db/schema";

type ProjectOption = TodoProject & { client: Client };

function isProjectOption(project: ProjectOption | null): project is ProjectOption {
  return project !== null;
}

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: requestedProjectId } = await searchParams;
  const supabase = await getSupabaseDb();

  const profileRow = await getProfile(user.id);

  const { data: projectRows, error } = await supabase
    .from("todo_project")
    .select("*, client:client_id(*)")
    .eq("user_id", user.id)
    .not("client_id", "is", null)
    .order("name", { ascending: true });
  if (error) throw error;

  const projects = (projectRows ?? [])
    .map((row) => {
      const rawClient = Array.isArray(row.client) ? row.client[0] : row.client;
      return rawClient ? { ...toTodoProject(row), client: toClient(rawClient) } : null;
    })
    .filter(isProjectOption)
    .filter((project) => !project.client.archived);

  const profileMissing = getProfileMissingFields(profileRow);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouveau devis
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisis le projet. Tu pourras ensuite ajouter les lignes du devis.
        </p>
      </div>
      <NewQuotePicker
        projects={projects}
        preselectedProjectId={
          projects.find((project) => project.id === requestedProjectId)?.id
        }
        profileMissing={profileMissing}
      />
    </div>
  );
}
