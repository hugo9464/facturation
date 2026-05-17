import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Clock, FileSignature, FileText, ListTodo, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimeEntryDialog } from "@/components/time-entry-dialog";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import { ProjectSettingsForm } from "./project-settings-form";
import { TodoWorkspace } from "../../todo/todo-workspace";
import type {
  TodoImplementationJobView,
  TodoProjectView,
  TodoTaskView,
} from "@/actions/todo";
import type { TodoImplementationJob, TodoProject, TodoTask } from "@/db/schema";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toTodoImplementationJob,
  toInvoice,
  toQuote,
  toTimeEntry,
  toTodoProject,
  toTodoTask,
} from "@/lib/supabase/db";
import { DEFAULT_TODO_PROMPT_TEMPLATE } from "@/lib/todo";
import { getAppUrl, previewTokenFor } from "@/lib/todo-preview";

const INVOICE_STATUS = {
  DRAFT: "Brouillon",
  SENT: "Émise",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
} as const;

const QUOTE_STATUS = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
} as const;

function serializeProject(project: TodoProject): TodoProjectView {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function serializeTodoImplementationJob(
  job: TodoImplementationJob,
): TodoImplementationJobView {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function serializeTask(
  task: TodoTask,
  implementationJob: TodoImplementationJob | null = null,
  implementationJobs: TodoImplementationJob[] = [],
): TodoTaskView {
  return {
    ...task,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    previewToken: previewTokenFor(task.id),
    implementationJob: implementationJob
      ? serializeTodoImplementationJob(implementationJob)
      : null,
    implementationJobs: implementationJobs.map(serializeTodoImplementationJob),
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await getSupabaseDb();

  const { data: rawProject, error: projectError } = await supabase
    .from("todo_project")
    .select("*, client:client_id(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (projectError) throw projectError;

  if (!rawProject) notFound();
  const rawClient = Array.isArray(rawProject.client)
    ? rawProject.client[0]
    : rawProject.client;
  const projectRow = {
    project: toTodoProject(rawProject),
    client: rawClient ? toClient(rawClient) : null,
  };

  const projectOption =
    projectRow.client && projectRow.project.clientId
      ? [{ ...projectRow.project, client: projectRow.client }]
      : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {projectRow.project.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projectRow.client ? projectRow.client.name : "Client à assigner"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {projectRow.client ? (
            <>
              <TimeEntryDialog projects={projectOption}>
                <Button>
                  <Clock className="size-4" />
                  Logger temps
                </Button>
              </TimeEntryDialog>
              <ButtonLink href={`/invoices/new?project=${projectRow.project.id}`}>
                <FileText className="size-4" />
                Facturer
              </ButtonLink>
              <ButtonLink
                href={`/quotes/new?project=${projectRow.project.id}`}
                variant="outline"
              >
                <FileSignature className="size-4" />
                Devis
              </ButtonLink>
            </>
          ) : (
            <Badge variant="outline">Temps et facturation indisponibles</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">
            <ListTodo className="size-4" />
            Todo
          </TabsTrigger>
          <TabsTrigger value="time">
            <Clock className="size-4" />
            Temps
          </TabsTrigger>
          <TabsTrigger value="billing">Facturation</TabsTrigger>
          <TabsTrigger value="settings">Réglages</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="pt-4">
          <Suspense fallback={<PanelLoading label="Chargement des tâches" />}>
            <ProjectTasks
              project={projectRow.project}
              projectId={id}
              userId={user.id}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="time" className="pt-4">
          <Suspense fallback={<PanelLoading label="Chargement du temps" />}>
            <ProjectTime projectId={id} userId={user.id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="billing" className="pt-4">
          <Suspense fallback={<PanelLoading label="Chargement de la facturation" />}>
            <ProjectBilling
              hasClient={Boolean(projectRow.client)}
              projectId={id}
              userId={user.id}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <Suspense fallback={<PanelLoading label="Chargement des réglages" />}>
            <ProjectSettings project={projectRow.project} userId={user.id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PanelLoading({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
      {label}...
    </div>
  );
}

async function ProjectTasks({
  project,
  projectId,
  userId,
}: {
  project: TodoProject;
  projectId: string;
  userId: string;
}) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("todo_task")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("status")
    .order("order");
  if (error) throw error;
  const taskRows = (data ?? []).map(toTodoTask);

  const { data: jobRows, error: jobsError } = await supabase
    .from("todo_implementation_job")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (jobsError) throw jobsError;
  const latestJobByTaskId = new Map<string, TodoImplementationJob>();
  const jobsByTaskId = new Map<string, TodoImplementationJob[]>();
  for (const job of (jobRows ?? []).map(toTodoImplementationJob)) {
    if (!latestJobByTaskId.has(job.taskId)) latestJobByTaskId.set(job.taskId, job);
    jobsByTaskId.set(job.taskId, [...(jobsByTaskId.get(job.taskId) ?? []), job]);
  }

  const profile = await getProfile(userId);
  const promptTemplate =
    profile?.todoPromptTemplate ?? DEFAULT_TODO_PROMPT_TEMPLATE;
  const appUrl = await getAppUrl();

  return (
    <TodoWorkspace
      key={project.id}
      initialProjects={[serializeProject(project)]}
      initialTasks={taskRows.map((task) =>
        serializeTask(
          task,
          latestJobByTaskId.get(task.id) ?? null,
          jobsByTaskId.get(task.id) ?? [],
        ),
      )}
      promptTemplate={promptTemplate}
      appUrl={appUrl}
    />
  );
}

async function ProjectTime({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("time_entry")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const entryRows = (data ?? []).map(toTimeEntry);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Quantité</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>État</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entryRows.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{formatDate(entry.date)}</TableCell>
              <TableCell>
                {entry.quantity} {rateTypeLabel(entry.type)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.description}
              </TableCell>
              <TableCell>
                {formatCents(Math.round(Number(entry.quantity) * entry.rateCents))}
              </TableCell>
              <TableCell>
                {entry.invoiceId ? (
                  <Badge variant="secondary">facturé</Badge>
                ) : (
                  <Badge variant="outline">non facturé</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
          {entryRows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-muted-foreground"
              >
                Aucun temps loggué.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

async function ProjectBilling({
  hasClient,
  projectId,
  userId,
}: {
  hasClient: boolean;
  projectId: string;
  userId: string;
}) {
  const supabase = await getSupabaseDb();
  const [invoices, quotes] = await Promise.all([
    supabase
      .from("invoice")
      .select("*")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("quote")
      .select("*")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (invoices.error) throw invoices.error;
  if (quotes.error) throw quotes.error;
  const invoiceRows = (invoices.data ?? []).map(toInvoice);
  const quoteRows = (quotes.data ?? []).map(toQuote);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium">Devis</h2>
          {hasClient && (
            <ButtonLink
              href={`/quotes/new?project=${projectId}`}
              size="sm"
              variant="outline"
            >
              <Plus className="size-4" />
              Nouveau devis
            </ButtonLink>
          )}
        </div>
        <DocumentList
          emptyLabel="Aucun devis pour ce projet."
          rows={quoteRows.map((item) => ({
            id: item.id,
            href: `/quotes/${item.id}`,
            number: item.number,
            date: item.issueDate,
            status: QUOTE_STATUS[item.status],
            totalCents: item.totalCents,
          }))}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium">Factures</h2>
          {hasClient && (
            <ButtonLink href={`/invoices/new?project=${projectId}`} size="sm">
              <Plus className="size-4" />
              Nouvelle facture
            </ButtonLink>
          )}
        </div>
        <DocumentList
          emptyLabel="Aucune facture pour ce projet."
          rows={invoiceRows.map((item) => ({
            id: item.id,
            href: `/invoices/${item.id}`,
            number: item.number,
            date: item.issueDate,
            status: INVOICE_STATUS[item.status],
            totalCents: item.totalCents,
          }))}
        />
      </section>
    </div>
  );
}

async function ProjectSettings({
  project,
  userId,
}: {
  project: TodoProject;
  userId: string;
}) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("client")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  const clientRows = (data ?? []).map(toClient);

  return (
    <ProjectSettingsForm
      project={project}
      clients={clientRows.filter((item) => !item.archived)}
    />
  );
}

function DocumentList({
  emptyLabel,
  rows,
}: {
  emptyLabel: string;
  rows: Array<{
    id: string;
    href: string;
    number: string | null;
    date: string;
    status: string;
    totalCents: number;
  }>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={row.href} className="font-mono hover:underline">
                  {row.number ?? "—"}
                </Link>
              </TableCell>
              <TableCell>{formatDate(row.date)}</TableCell>
              <TableCell>
                <Badge variant="outline">{row.status}</Badge>
              </TableCell>
              <TableCell>{formatCents(row.totalCents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
