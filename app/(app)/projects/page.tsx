import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProjectForm } from "./project-form";
import { getSupabaseDb, toClient, toTodoProject } from "@/lib/supabase/db";

export default async function ProjectsPage() {
  const user = await requireUser();
  const supabase = await getSupabaseDb();

  const [clientsResult, projectsResult, tasksResult, entriesResult, quotesResult] =
    await Promise.all([
      supabase.from("client").select("*").eq("user_id", user.id).order("name"),
      supabase
        .from("todo_project")
        .select("*, client:client_id(name)")
        .eq("user_id", user.id)
        .order("order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("todo_task").select("project_id").eq("user_id", user.id),
      supabase.from("time_entry").select("project_id").eq("user_id", user.id),
      supabase.from("quote").select("project_id").eq("user_id", user.id),
    ]);
  for (const result of [
    clientsResult,
    projectsResult,
    tasksResult,
    entriesResult,
    quotesResult,
  ]) {
    if (result.error) throw result.error;
  }

  const clients = (clientsResult.data ?? []).map(toClient);
  const countByProject = (items: Array<{ project_id: string | null }>) => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.project_id) map.set(item.project_id, (map.get(item.project_id) ?? 0) + 1);
    }
    return map;
  };
  const taskCounts = countByProject(tasksResult.data ?? []);
  const entryCounts = countByProject(entriesResult.data ?? []);
  const quoteCounts = countByProject(quotesResult.data ?? []);
  const rows = (projectsResult.data ?? []).map((row) => ({
    project: toTodoProject(row),
    clientName: Array.isArray(row.client) ? row.client[0]?.name : row.client?.name,
    taskCount: taskCounts.get(row.id) ?? 0,
    entryCount: entryCounts.get(row.id) ?? 0,
    quoteCount: quoteCounts.get(row.id) ?? 0,
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} {rows.length > 1 ? "projets" : "projet"}
          </p>
        </div>
        <ButtonLink href="/clients/new" variant="outline">
          <Plus className="size-4" />
          Client
        </ButtonLink>
      </div>

      <ProjectForm clients={clients.filter((item) => !item.archived)} />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FolderKanban className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun projet. Crée un client puis un projet pour organiser le temps,
            les tâches et les devis.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projet</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Tâches</TableHead>
                <TableHead>Temps</TableHead>
                <TableHead>Devis</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.project.id}>
                  <TableCell>
                    <Link
                      href={`/projects/${row.project.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.clientName ?? (
                      <Badge variant="outline">client à assigner</Badge>
                    )}
                  </TableCell>
                  <TableCell>{row.taskCount}</TableCell>
                  <TableCell>{row.entryCount}</TableCell>
                  <TableCell>{row.quoteCount}</TableCell>
                  <TableCell className="text-right">
                    <ButtonLink
                      href={`/projects/${row.project.id}`}
                      variant="ghost"
                      size="sm"
                    >
                      Ouvrir
                    </ButtonLink>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
