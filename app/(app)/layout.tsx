import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getProfile, getSupabaseDb, toClient, toTodoProject } from "@/lib/supabase/db";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const profileRow = await getProfile(user.id);

  if (!profileRow) {
    redirect("/onboarding");
  }

  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("todo_project")
    .select("*, client:client_id(*)")
    .eq("user_id", user.id)
    .order("order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  const projectRows = (data ?? []).map((row) => {
    const rawClient = Array.isArray(row.client) ? row.client[0] : row.client;
    return {
      project: toTodoProject(row),
      client: rawClient ? toClient(rawClient) : null,
    };
  });

  const sidebarProjects = projectRows.map((row) => ({
    id: row.project.id,
    name: row.project.name,
    clientName: row.client?.name ?? null,
    clientArchived: row.client?.archived ?? false,
  }));

  const timeProjects = projectRows
    .filter((row) => row.client && !row.client.archived)
    .map((row) => ({
      ...row.project,
      client: row.client!,
    }));

  return (
    <AppShell
      email={user.email ?? ""}
      projects={timeProjects}
      sidebarProjects={sidebarProjects}
    >
      {children}
    </AppShell>
  );
}
