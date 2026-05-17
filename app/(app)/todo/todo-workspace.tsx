"use client";

import * as React from "react";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  GitPullRequest,
  GripVertical,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  advanceTodoTaskAction,
  createTodoProjectAction,
  createTodoTaskAction,
  deleteTodoProjectAction,
  deleteTodoTaskAction,
  reorderTodoTasksAction,
  refreshTodoImplementationJobsAction,
  startTodoImplementationAction,
  summarizeTodoTasksAction,
  updateTodoProjectAction,
  updateTodoTaskAction,
  validateTodoImplementationAction,
  type TodoProjectView,
  type TodoTaskView,
} from "@/actions/todo";
import type { TodoStatus } from "@/db/schema";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  nextTodoStatus,
  renderTodoPrompt,
  TODO_STATUSES,
  TODO_STATUS_LABELS,
} from "@/lib/todo";
import { cn } from "@/lib/utils";
import {
  canRequestHermesMerge,
  getHermesProgressView,
  isHermesJobActive,
} from "@/lib/todo-implementation-workflow";
import { formatDate } from "@/lib/dates";

const VIEW_STORAGE_KEY = "facturation.todo.view.v1";
const PROJECT_STORAGE_KEY = "facturation.todo.project.v1";
type TodoView = "list" | "kanban";
type ProjectFormInput = {
  name: string;
};
const TODO_LIST_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "TO_TEST",
  "DONE",
] as const satisfies readonly TodoStatus[];

function compareTasks(a: TodoTaskView, b: TodoTaskView) {
  return (
    a.order - b.order ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function isTodoStatus(value: string): value is TodoStatus {
  return TODO_STATUSES.includes(value as TodoStatus);
}

function statusDotClass(status: TodoStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return "border-[#f4d01c] bg-[linear-gradient(90deg,#f4d01c_50%,transparent_50%)]";
    case "TO_TEST":
      return "border-[#ff8a1f] bg-[linear-gradient(90deg,#ff8a1f_50%,transparent_50%)]";
    case "TODO":
      return "border-[#5aa2ff] bg-transparent shadow-[0_0_0_2px_rgba(90,162,255,0.16)]";
    case "DONE":
      return "border-[#45d483] bg-[linear-gradient(90deg,#45d483_50%,transparent_50%)]";
  }
}

function todoListLabel(status: TodoStatus) {
  return TODO_STATUS_LABELS[status].toUpperCase();
}

function tasksByStatus(tasks: TodoTaskView[]) {
  return TODO_STATUSES.reduce(
    (acc, status) => {
      acc[status] = tasks
        .filter((task) => task.status === status)
        .sort(compareTasks);
      return acc;
    },
    {} as Record<TodoStatus, TodoTaskView[]>,
  );
}

function normalizeOrders(tasks: TodoTaskView[]) {
  const byProject = new Map<string, TodoTaskView[]>();
  for (const task of tasks) {
    byProject.set(task.projectId, [...(byProject.get(task.projectId) ?? []), task]);
  }

  return Array.from(byProject.values()).flatMap((projectTasks) => {
    const grouped = tasksByStatus(projectTasks);
    return TODO_STATUSES.flatMap((status) =>
      grouped[status].map((task, index) => ({ ...task, order: index })),
    );
  });
}

function moveTask(
  tasks: TodoTaskView[],
  activeId: string,
  overId: string,
  insertAfterOverTask = false,
): TodoTaskView[] {
  const active = tasks.find((task) => task.id === activeId);
  if (!active) return tasks;

  const overTask = tasks.find((task) => task.id === overId);
  if (overTask && active.status === overTask.status) {
    const grouped = tasksByStatus(tasks);
    const statusItems = grouped[active.status];
    const oldIndex = statusItems.findIndex((task) => task.id === activeId);
    const newIndex = statusItems.findIndex((task) => task.id === overId);

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return tasks;

    grouped[active.status] = arrayMove(statusItems, oldIndex, newIndex);
    return TODO_STATUSES.flatMap((status) =>
      grouped[status].map((task, index) => ({ ...task, order: index })),
    );
  }

  const withoutActive = tasks.filter((task) => task.id !== activeId);
  const targetStatus = isTodoStatus(overId)
    ? overId
    : (overTask?.status ?? active.status);
  const grouped = tasksByStatus(withoutActive);
  const targetItems = grouped[targetStatus];
  const targetIndex = overTask
    ? Math.max(0, targetItems.findIndex((task) => task.id === overId)) +
      (insertAfterOverTask ? 1 : 0)
    : targetItems.length;

  const nextTarget = [...targetItems];
  nextTarget.splice(targetIndex, 0, { ...active, status: targetStatus });
  grouped[targetStatus] = nextTarget;

  return TODO_STATUSES.flatMap((status) =>
    grouped[status].map((task, index) => ({ ...task, order: index })),
  );
}

function appendToStatus(
  tasks: TodoTaskView[],
  task: TodoTaskView,
  status: TodoStatus,
) {
  const count = tasks.filter(
    (item) => item.projectId === task.projectId && item.status === status,
  ).length;
  return normalizeOrders([
    ...tasks.filter((item) => item.id !== task.id),
    { ...task, status, order: count },
  ]);
}

function buildImplementationPrompt(
  template: string,
  appUrl: string,
  task: TodoTaskView,
  project?: TodoProjectView,
) {
  const description = task.description?.trim();
  return renderTodoPrompt(template, {
    number: task.number,
    title: task.title,
    project: project?.name ?? "Projet non précisé",
    status: TODO_STATUS_LABELS[task.status],
    description: description ? description : "Aucune description fournie.",
    appUrl,
    taskId: task.id,
    previewToken: task.previewToken ?? "",
  });
}

export function TodoWorkspace({
  initialProjects,
  initialTasks,
  promptTemplate,
  appUrl,
}: {
  initialProjects: TodoProjectView[];
  initialTasks: TodoTaskView[];
  promptTemplate: string;
  appUrl: string;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(() => normalizeOrders(initialTasks));
  const [view, setView] = useState<TodoView>("list");
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialProjects[0]?.id ?? "",
  );
  const [createStatus, setCreateStatus] = useState<TodoStatus | null>(null);
  const [editingTask, setEditingTask] = useState<TodoTaskView | null>(null);
  const [projectDialog, setProjectDialog] = useState<{
    mode: "create" | "edit";
    project?: TodoProjectView;
  } | null>(null);
  const [projectToDelete, setProjectToDelete] =
    useState<TodoProjectView | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TodoTaskView | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (storedView === "list" || storedView === "kanban") setView(storedView);

      const storedProject = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      if (
        storedProject &&
        projects.some((project) => project.id === storedProject)
      ) {
        setSelectedProjectId(storedProject);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projects]);

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    if (selectedProjectId) {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
    if (projects.length === 0) {
      setSelectedProjectId("");
      return;
    }
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projects, selectedProjectId]);

  const activeProject = projects.find((project) => project.id === selectedProjectId);
  const activeTasks = useMemo(
    () => tasks.filter((task) => task.projectId === selectedProjectId),
    [tasks, selectedProjectId],
  );
  const grouped = useMemo(() => tasksByStatus(activeTasks), [activeTasks]);
  const taskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);
  const activeHermesTaskIds = useMemo(
    () =>
      tasks
        .filter((task) =>
          task.implementationJob
            ? isHermesJobActive(task.implementationJob.status)
            : false,
        )
        .map((task) => task.id),
    [tasks],
  );
  const activeHermesTaskKey = activeHermesTaskIds.join("|");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const taskIds = activeHermesTaskKey.split("|").filter(Boolean);
    if (taskIds.length === 0) return;
    let cancelled = false;

    async function refreshActiveHermesJobs() {
      const result = await refreshTodoImplementationJobsAction({
        taskIds,
      });
      if (cancelled || !("jobs" in result) || !result.jobs) return;
      const jobsByTaskId = new Map(result.jobs.map((job) => [job.taskId, job]));
      const tasksById = new Map((result.tasks ?? []).map((task) => [task.id, task]));
      setTasks((current) =>
        normalizeOrders(
          current.map((task) => {
            const updatedTask = tasksById.get(task.id);
            const job = jobsByTaskId.get(task.id);
            if (!updatedTask && !job) return task;
            return {
              ...(updatedTask ?? task),
              implementationJob: job ?? updatedTask?.implementationJob ?? task.implementationJob,
            };
          }),
        ),
      );
    }

    void refreshActiveHermesJobs();
    const interval = window.setInterval(refreshActiveHermesJobs, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeHermesTaskKey]);

  function markPending(id: string, pending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function persistReorder(nextProjectTasks: TodoTaskView[], previous: TodoTaskView[]) {
    startTransition(async () => {
      const result = await reorderTodoTasksAction(
        nextProjectTasks.map((task) => ({
          id: task.id,
          status: task.status,
          order: task.order,
        })),
      );
      if ("error" in result && result.error) {
        setTasks(previous);
        toast.error(result.error);
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const over = event.over;
    if (!over) return;
    const overId = String(over.id);
    if (activeId === overId) return;

    if (!activeTasks.some((task) => task.id === activeId)) return;

    const previous = tasks;
    const overTask = activeTasks.find((task) => task.id === overId);
    const activeTask = activeTasks.find((task) => task.id === activeId);
    const translatedTop = event.active.rect.current.translated?.top;
    const insertAfterOverTask =
      Boolean(overTask && activeTask && overTask.status !== activeTask.status) &&
      typeof translatedTop === "number" &&
      translatedTop > over.rect.top + over.rect.height / 2;
    const nextProjectTasks = moveTask(
      activeTasks,
      activeId,
      overId,
      insertAfterOverTask,
    );
    if (nextProjectTasks === activeTasks) return;

    const nextTasks = normalizeOrders([
      ...tasks.filter((task) => task.projectId !== selectedProjectId),
      ...nextProjectTasks,
    ]);

    setTasks(nextTasks);
    persistReorder(nextProjectTasks, previous);
  }

  function createProject(input: ProjectFormInput) {
    startTransition(async () => {
      const result = await createTodoProjectAction(input);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const project = "project" in result ? result.project : null;
      if (!project) return;
      setProjects((current) => [...current, project]);
      setSelectedProjectId(project.id);
      setProjectDialog(null);
      toast.success("Projet créé");
    });
  }

  function updateProject(project: TodoProjectView, input: ProjectFormInput) {
    markPending(project.id, true);
    startTransition(async () => {
      const result = await updateTodoProjectAction(project.id, input);
      markPending(project.id, false);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const updatedProject = "project" in result ? result.project : null;
      if (!updatedProject) return;
      setProjects((current) =>
        current.map((item) => (item.id === project.id ? updatedProject : item)),
      );
      setProjectDialog(null);
      toast.success("Projet mis à jour");
    });
  }

  function deleteProject(project: TodoProjectView) {
    markPending(project.id, true);
    startTransition(async () => {
      const result = await deleteTodoProjectAction(project.id);
      markPending(project.id, false);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setSelectedProjectId((current) => {
        if (current !== project.id) return current;
        return projects.find((item) => item.id !== project.id)?.id ?? "";
      });
      setProjectToDelete(null);
      toast.success("Projet supprimé");
    });
  }

  function createTask(input: {
    title: string;
    description: string;
    status: TodoStatus;
  }) {
    if (!activeProject) return;

    startTransition(async () => {
      const result = await createTodoTaskAction({
        ...input,
        projectId: activeProject.id,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const createdTask = "task" in result ? result.task : null;
      if (!createdTask) return;
      setTasks((current) => normalizeOrders([...current, createdTask]));
      setCreateStatus(null);
      toast.success("Tâche créée");
    });
  }

  async function copyTaskPrompt(task: TodoTaskView) {
    const project = projects.find((item) => item.id === task.projectId);
    const prompt = buildImplementationPrompt(
      promptTemplate,
      appUrl,
      task,
      project,
    );
    try {
      await window.navigator.clipboard.writeText(prompt);
      toast.success("Prompt copié");
    } catch {
      toast.error("Impossible de copier le prompt");
    }
  }

  function startTaskImplementation(task: TodoTaskView) {
    const previous = tasks;
    markPending(task.id, true);
    setTasks((current) => appendToStatus(current, task, "IN_PROGRESS"));
    startTransition(async () => {
      const result = await startTodoImplementationAction({
        taskId: task.id,
        preferredCodingTool: "codex",
      });
      markPending(task.id, false);
      if ("error" in result && result.error) {
        setTasks(previous);
        toast.error(result.error);
        if ("job" in result && result.job) {
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id
                ? { ...item, implementationJob: result.job ?? null }
                : item,
            ),
          );
        }
        return;
      }
      const job = "job" in result ? result.job : null;
      const updatedTask = "task" in result ? result.task : null;
      if (job || updatedTask) {
        setTasks((current) =>
          normalizeOrders(
            current.map((item) =>
              item.id === task.id
                ? {
                    ...(updatedTask ?? item),
                    implementationJob: job ?? updatedTask?.implementationJob ?? item.implementationJob,
                  }
                : item,
            ),
          ),
        );
      }
      toast.success("Job Hermes envoyé");
    });
  }

  function validateTaskImplementation(task: TodoTaskView) {
    markPending(task.id, true);
    startTransition(async () => {
      const result = await validateTodoImplementationAction({ taskId: task.id });
      markPending(task.id, false);
      if ("error" in result && result.error) {
        toast.error(result.error);
        if ("job" in result && result.job) {
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id
                ? { ...item, implementationJob: result.job ?? null }
                : item,
            ),
          );
        }
        return;
      }
      const job = "job" in result ? result.job : null;
      if (job) {
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id ? { ...item, implementationJob: job } : item,
          ),
        );
      }
      toast.success("Validation envoyée à Hermes");
    });
  }

  function updateTask(
    task: TodoTaskView,
    input: { title: string; description: string; status: TodoStatus },
  ) {
    const previous = tasks;
    markPending(task.id, true);
    setTasks((current) => {
      const next = current.map((item) =>
        item.id === task.id
          ? { ...item, ...input, description: input.description || null }
          : item,
      );
      if (task.status === input.status) return normalizeOrders(next);
      return appendToStatus(
        next,
        { ...task, ...input, description: input.description || null },
        input.status,
      );
    });
    startTransition(async () => {
      const result = await updateTodoTaskAction(task.id, input);
      markPending(task.id, false);
      if ("error" in result && result.error) {
        setTasks(previous);
        toast.error(result.error);
        return;
      }
      const updatedTask = "task" in result ? result.task : null;
      if (!updatedTask) return;
      setTasks((current) =>
        normalizeOrders(
          current.map((item) => (item.id === task.id ? updatedTask : item)),
        ),
      );
      setEditingTask(null);
      toast.success("Tâche mise à jour");
    });
  }

  function deleteTask(task: TodoTaskView) {
    const previous = tasks;
    markPending(task.id, true);
    setTasks((current) =>
      normalizeOrders(current.filter((item) => item.id !== task.id)),
    );
    startTransition(async () => {
      const result = await deleteTodoTaskAction(task.id);
      markPending(task.id, false);
      if ("error" in result && result.error) {
        setTasks(previous);
        toast.error(result.error);
        return;
      }
      setTaskToDelete(null);
      toast.success("Tâche supprimée");
    });
  }

  function advanceTask(task: TodoTaskView) {
    const nextStatus = nextTodoStatus(task.status);
    if (!nextStatus) return;

    const previous = tasks;
    markPending(task.id, true);
    setTasks((current) => appendToStatus(current, task, nextStatus));
    startTransition(async () => {
      const result = await advanceTodoTaskAction(task.id);
      markPending(task.id, false);
      if ("error" in result && result.error) {
        setTasks(previous);
        toast.error(result.error);
        return;
      }
      const advancedTask = "task" in result ? result.task : null;
      if (!advancedTask) return;
      setTasks((current) =>
        normalizeOrders(
          current.map((item) => (item.id === task.id ? advancedTask : item)),
        ),
      );
      toast.success("Tâche avancée");
    });
  }

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100vh-3.5rem)] bg-[#17171a] px-4 py-5 text-[#f2f2f4] md:-mx-6 md:px-10">
      {projects.length === 0 ? (
        <div className="rounded-[24px] border border-[#2b2b30] bg-[#1d1d21] p-12 text-center">
          <p className="text-sm text-[#777780]">
            Aucun projet pour l&apos;instant.
          </p>
          <Button
            className="mt-4"
            onClick={() => setProjectDialog({ mode: "create" })}
          >
            <Plus className="size-4" />
            Créer un projet
          </Button>
        </div>
      ) : (
        <div className="mx-auto min-w-0 max-w-[1680px]">
            <div className="mb-4 flex justify-end gap-2">
              {activeProject && (
                <button
                  type="button"
                  onClick={() => setProjectDialog({ mode: "edit", project: activeProject })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d2d32] bg-[#1d1d21] px-3 py-1.5 text-[13px] font-medium text-[#f2f2f4] transition-colors hover:bg-[#24242a]"
                >
                  Modifier le projet
                </button>
              )}
              <button
                type="button"
                onClick={() => setSummaryOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d2d32] bg-[#1d1d21] px-3 py-1.5 text-[13px] font-medium text-[#f2f2f4] transition-colors hover:bg-[#24242a]"
              >
                <Sparkles className="size-4" />
                Résumé IA
              </button>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={onDragEnd}
            >
              <TodoLinearListView
                grouped={grouped}
                pendingIds={pendingIds}
                onCreate={setCreateStatus}
                onEdit={setEditingTask}
                onDelete={setTaskToDelete}
                onAdvance={advanceTask}
                onCopyPrompt={copyTaskPrompt}
                onStartImplementation={startTaskImplementation}
                onValidateImplementation={validateTaskImplementation}
              />
            </DndContext>
            <p className="pt-3 text-center text-[11px] text-[#60606c]">v2.21.9</p>
        </div>
      )}

      <TodoProjectDialog
        key={projectDialog?.project?.id ?? projectDialog?.mode ?? "closed"}
        open={projectDialog !== null}
        project={projectDialog?.project}
        pending={isPending}
        onOpenChange={(open) => {
          if (!open) setProjectDialog(null);
        }}
        onSubmit={(input) => {
          if (projectDialog?.mode === "edit" && projectDialog.project) {
            updateProject(projectDialog.project, input);
          } else {
            createProject(input);
          }
        }}
      />
      <TodoTaskDialog
        key={`create-${createStatus ?? "closed"}`}
        open={createStatus !== null}
        status={createStatus ?? "TODO"}
        pending={isPending}
        onOpenChange={(open) => {
          if (!open) setCreateStatus(null);
        }}
        onSubmit={createTask}
      />
      <TodoTaskDialog
        key={editingTask?.id ?? "edit-closed"}
        open={editingTask !== null}
        task={editingTask ?? undefined}
        status={editingTask?.status ?? "TODO"}
        pending={isPending || Boolean(editingTask && pendingIds.has(editingTask.id))}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
        onSubmit={(input) => {
          if (editingTask) updateTask(editingTask, input);
        }}
      />
      <DeleteProjectDialog
        project={projectToDelete}
        taskCount={projectToDelete ? (taskCounts.get(projectToDelete.id) ?? 0) : 0}
        pending={Boolean(projectToDelete && pendingIds.has(projectToDelete.id))}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null);
        }}
        onConfirm={() => {
          if (projectToDelete) deleteProject(projectToDelete);
        }}
      />
      <DeleteTaskDialog
        task={taskToDelete}
        pending={Boolean(taskToDelete && pendingIds.has(taskToDelete.id))}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
        onConfirm={() => {
          if (taskToDelete) deleteTask(taskToDelete);
        }}
      />
      <TaskSummaryDialog
        key={summaryOpen ? "summary-open" : "summary-closed"}
        open={summaryOpen}
        tasks={activeTasks}
        onOpenChange={setSummaryOpen}
      />
    </div>
  );
}

function TaskSummaryDialog({
  open,
  tasks,
  onOpenChange,
}: {
  open: boolean;
  tasks: TodoTaskView[];
  onOpenChange: (open: boolean) => void;
}) {
  const sortedTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === "TO_TEST")
        .sort((a, b) => a.number - b.number),
    [tasks],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(sortedTasks.map((task) => task.id)),
  );
  const [summary, setSummary] = useState("");
  const [generating, setGenerating] = useState(false);

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generate() {
    if (selectedIds.size === 0) {
      toast.error("Sélectionne au moins une tâche");
      return;
    }
    setGenerating(true);
    setSummary("");
    const result = await summarizeTodoTasksAction({
      taskIds: Array.from(selectedIds),
    });
    setGenerating(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ("summary" in result && result.summary) setSummary(result.summary);
  }

  async function copySummary() {
    try {
      await window.navigator.clipboard.writeText(summary);
      toast.success("Résumé copié");
    } catch {
      toast.error("Impossible de copier le résumé");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Résumé des tâches</DialogTitle>
          <DialogDescription>
            Tâches « À valider » du projet — sélectionne celles à inclure,
            l&apos;IA rédige le résumé des modifications effectuées.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border p-1">
            {sortedTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune tâche « À valider » dans ce projet.
              </p>
            ) : (
              sortedTasks.map((task) => (
                <label
                  key={task.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedIds.has(task.id)}
                    onCheckedChange={() => toggle(task.id)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">
                      UC-{task.number}
                    </span>{" "}
                    {task.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {TODO_STATUS_LABELS[task.status]}
                  </span>
                </label>
              ))
            )}
          </div>
          {summary && (
            <div className="space-y-2">
              <Textarea
                readOnly
                rows={9}
                value={summary}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copySummary}
              >
                <Copy className="size-4" />
                Copier le résumé
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {selectedIds.size} tâche{selectedIds.size > 1 ? "s" : ""}{" "}
            sélectionnée{selectedIds.size > 1 ? "s" : ""}
          </span>
          <Button
            type="button"
            onClick={generate}
            disabled={generating || selectedIds.size === 0}
          >
            {generating ? "Génération..." : "Générer le résumé"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TodoViewProps = {
  grouped: Record<TodoStatus, TodoTaskView[]>;
  pendingIds: Set<string>;
  onCreate: (status: TodoStatus) => void;
  onEdit: (task: TodoTaskView) => void;
  onDelete: (task: TodoTaskView) => void;
  onAdvance: (task: TodoTaskView) => void;
};

type TodoLinearViewProps = TodoViewProps & {
  onCopyPrompt: (task: TodoTaskView) => void;
  onStartImplementation: (task: TodoTaskView) => void;
  onValidateImplementation: (task: TodoTaskView) => void;
};

function TodoLinearListView({
  grouped,
  pendingIds,
  onCreate,
  onEdit,
  onDelete,
  onAdvance,
  onCopyPrompt,
  onStartImplementation,
  onValidateImplementation,
}: TodoLinearViewProps) {
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<TodoStatus>>(
    () => new Set(["DONE"]),
  );
  const statuses = TODO_LIST_STATUSES;
  function toggleStatus(status: TodoStatus) {
    setCollapsedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <div className="space-y-7">
      {statuses.map((status) => (
        <TodoLinearSection
          key={status}
          status={status}
          tasks={grouped[status]}
          collapsed={collapsedStatuses.has(status)}
          pendingIds={pendingIds}
          onCreate={onCreate}
          onToggleCollapse={toggleStatus}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdvance={onAdvance}
          onCopyPrompt={onCopyPrompt}
          onStartImplementation={onStartImplementation}
          onValidateImplementation={onValidateImplementation}
        />
      ))}
    </div>
  );
}

function TodoLinearSection({
  status,
  tasks,
  collapsed,
  pendingIds,
  onCreate,
  onToggleCollapse,
  onEdit,
  onDelete,
  onAdvance,
  onCopyPrompt,
  onStartImplementation,
  onValidateImplementation,
}: Omit<TodoLinearViewProps, "grouped"> & {
  status: TodoStatus;
  tasks: TodoTaskView[];
  collapsed: boolean;
  onToggleCollapse: (status: TodoStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "status", status },
  });

  return (
    <section ref={setNodeRef} className={cn(isOver && "rounded-xl bg-white/[0.03]")}>
      <div className="mb-3 flex items-center justify-between px-2 sm:px-3">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2.5 rounded-md text-left"
          onClick={() => onToggleCollapse(status)}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="size-4 shrink-0 text-[#777780]" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-[#777780]" />
          )}
          <span
            className={cn("size-3.5 shrink-0 rounded-full border", statusDotClass(status))}
            aria-hidden="true"
          />
          <h2 className="truncate text-[13px] font-semibold uppercase leading-none tracking-[0.12em] text-[#a5a5af]">
            {todoListLabel(status)}
          </h2>
          <span className="text-[13px] leading-none text-[#777780]">{tasks.length}</span>
        </button>
        <button
          type="button"
          className="grid size-7 shrink-0 place-items-center rounded-full text-[#f2f2f4] transition-colors hover:bg-white/[0.06]"
          onClick={() => onCreate(status)}
          aria-label={`Créer dans ${TODO_STATUS_LABELS[status]}`}
        >
          <Plus className="size-5 stroke-[2.2]" />
        </button>
      </div>
      {!collapsed && (
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="overflow-hidden rounded-xl border border-[#2d2d32] bg-[#1d1d21]">
            {tasks.length === 0 ? (
              <p className="flex h-12 items-center justify-center text-sm font-medium text-[#666671]">
                Aucune tâche
              </p>
            ) : (
              tasks.map((task) => (
                <SortableLinearTaskRow
                  key={task.id}
                  task={task}
                  pending={pendingIds.has(task.id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAdvance={onAdvance}
                  onCopyPrompt={onCopyPrompt}
                  onStartImplementation={onStartImplementation}
                  onValidateImplementation={onValidateImplementation}
                />
              ))
            )}
          </div>
        </SortableContext>
      )}
    </section>
  );
}

function SortableLinearTaskRow({
  task,
  pending,
  onEdit,
  onDelete,
  onAdvance,
  onCopyPrompt,
  onStartImplementation,
  onValidateImplementation,
}: SortableTaskProps & {
  onCopyPrompt: (task: TodoTaskView) => void;
  onStartImplementation: (task: TodoTaskView) => void;
  onValidateImplementation: (task: TodoTaskView) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status },
  });
  const nextStatus = nextTodoStatus(task.status);
  const canValidate = canRequestHermesMerge({
    taskStatus: task.status,
    jobStatus: task.implementationJob?.status ?? "QUEUED",
    prUrl: task.prUrl ?? task.implementationJob?.prUrl,
  });
  const hermesProgress = task.implementationJob
    ? getHermesProgressView({
        status: task.implementationJob.status,
        logs: task.implementationJob.errorMessage ?? task.implementationJob.logs,
        updatedAt: task.implementationJob.updatedAt,
      })
    : null;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onEdit(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(task);
        }
      }}
      className={cn(
        "grid min-h-11 cursor-pointer grid-cols-[34px_72px_minmax(0,1fr)_34px_34px_34px_34px_34px] items-center border-b border-[#2a2a30] bg-[#1d1d21] px-4 text-[#f0f0f2] last:border-b-0",
        "transition-colors hover:bg-[#24242a] max-sm:grid-cols-[30px_58px_minmax(0,1fr)_30px_30px_30px_30px_30px] max-sm:px-2",
        isDragging && "relative z-10 shadow-2xl shadow-black/40",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        className="grid size-7 touch-none cursor-grab place-items-center rounded-md text-[#777780] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4] active:cursor-grabbing"
        aria-label="Déplacer"
        title="Déplacer"
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4 stroke-[1.9]" aria-hidden="true" />
      </button>
      <span className="truncate px-1.5 text-left font-mono text-xs font-medium text-[#7c7c89]">
        UC-{task.number}
      </span>
      <div className="min-w-0 px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-left text-sm font-medium leading-none tracking-normal text-[#f2f2f4]">
            {task.title}
          </span>
          {task.completedAt && (
            <span
              className="shrink-0 font-mono text-[11px] leading-none text-[#777780]"
              title="Date de fin"
            >
              {formatDate(task.completedAt)}
            </span>
          )}
          {task.prUrl ? (
            <a
              href={task.prUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="grid size-6 shrink-0 place-items-center rounded-full text-[#8d8d99] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4]"
              aria-label="Ouvrir la Pull Request"
              title="Ouvrir la Pull Request"
            >
              <GitPullRequest className="size-3.5 stroke-[1.9]" />
            </a>
          ) : null}
          {task.previewUrl ? (
            <a
              href={task.previewUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="grid size-6 shrink-0 place-items-center rounded-full text-[#8d8d99] transition-colors hover:bg-white/[0.06] hover:text-emerald-300"
              aria-label="Ouvrir la preview Vercel"
              title="Ouvrir la preview Vercel"
            >
              <ExternalLink className="size-3.5 stroke-[1.9]" />
            </a>
          ) : null}
          {task.implementationJob && hermesProgress ? (
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none",
                hermesProgress.tone === "error"
                  ? "border-red-500/30 text-red-300"
                  : hermesProgress.tone === "success"
                    ? "border-emerald-500/30 text-emerald-300"
                    : hermesProgress.tone === "waiting"
                      ? "border-amber-500/30 text-amber-300"
                      : "border-sky-500/30 text-sky-300",
              )}
              title={task.implementationJob.errorMessage ?? task.implementationJob.logs ?? "Job Hermes"}
            >
              Hermes · {hermesProgress.label}
            </span>
          ) : null}
        </div>
        {task.implementationJob && hermesProgress ? (
          <div
            className={cn(
              "mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-none",
              hermesProgress.tone === "error"
                ? "text-red-300"
                : hermesProgress.tone === "success"
                  ? "text-emerald-300"
                  : hermesProgress.tone === "waiting"
                    ? "text-amber-300"
                    : "text-sky-300",
            )}
            title={hermesProgress.steps.join("\n") || hermesProgress.detail}
          >
            {isHermesJobActive(task.implementationJob.status) ? (
              <RefreshCw className="size-3 shrink-0 animate-spin" aria-hidden="true" />
            ) : null}
            <span className="shrink-0 font-medium">Avancement Hermes</span>
            <span className="min-w-0 truncate text-[#b7b7c2]">{hermesProgress.detail}</span>
            <span className="shrink-0 text-[#777780]">{formatDate(task.implementationJob.updatedAt)}</span>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="grid size-7 place-items-center justify-self-center rounded-full text-[#8d8d99] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4] disabled:opacity-40"
        disabled={!nextStatus || pending}
        onClick={(event) => {
          event.stopPropagation();
          onAdvance(task);
        }}
        aria-label="Avancer"
        title={nextStatus ? `Passer à ${TODO_STATUS_LABELS[nextStatus]}` : ""}
      >
        <Check className="size-3.5 stroke-[2.2]" />
      </button>
      <button
        type="button"
        className="grid size-7 place-items-center justify-self-center rounded-full text-[#8d8d99] transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-40"
        disabled={!canValidate || pending}
        onClick={(event) => {
          event.stopPropagation();
          onValidateImplementation(task);
        }}
        aria-label="Valider et merger avec Hermes"
        title={
          canValidate
            ? "Valider: Hermes merge la PR dans main puis passe la tâche à À valider"
            : "Validation disponible après réussite du job Hermes et création de PR"
        }
      >
        <Check className="size-3.5 stroke-[2.2]" />
      </button>
      <button
        type="button"
        className="grid size-7 place-items-center justify-self-center rounded-full text-[#8d8d99] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4] disabled:opacity-40"
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          onStartImplementation(task);
        }}
        aria-label="Implémenter avec Hermes"
        title="Implémenter avec Hermes"
      >
        <Sparkles className="size-3.5 stroke-[1.9]" />
      </button>
      <button
        type="button"
        className="grid size-7 place-items-center justify-self-center rounded-full text-[#8d8d99] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4] disabled:opacity-40"
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          onCopyPrompt(task);
        }}
        aria-label="Copier le prompt d'implémentation"
        title="Copier le prompt d'implémentation"
      >
        <Copy className="size-3.5 stroke-[1.9]" />
      </button>
      <button
        type="button"
        className="grid size-7 place-items-center justify-self-center rounded-full text-[#8d8d99] transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(task);
        }}
        aria-label="Supprimer"
      >
        <Trash2 className="size-3.5 stroke-[1.9]" />
      </button>
    </article>
  );
}

type SortableTaskProps = {
  task: TodoTaskView;
  pending: boolean;
  onEdit: (task: TodoTaskView) => void;
  onDelete: (task: TodoTaskView) => void;
  onAdvance: (task: TodoTaskView) => void;
};

function TodoProjectDialog({
  open,
  project,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  project?: TodoProjectView;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ProjectFormInput) => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Configurer le projet" : "Créer un projet"}</DialogTitle>
          <DialogDescription>
            Le nom du projet suffit. Quand tu lances une implémentation, l’app envoie la tâche et le projet à Hermes sur le VPS, qui résout lui-même le dépôt concerné.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ name });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="todo-project-name">Nom</Label>
            <Input
              id="todo-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TodoTaskDialog({
  open,
  task,
  status,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  task?: TodoTaskView;
  status: TodoStatus;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    title: string;
    description: string;
    status: TodoStatus;
  }) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [selectedStatus, setSelectedStatus] = useState<TodoStatus>(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Modifier la tâche" : "Créer une tâche"}</DialogTitle>
          <DialogDescription>
            {task ? `Tâche #${task.number}` : TODO_STATUS_LABELS[status]}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ title, description, status: selectedStatus });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="todo-title">Titre</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="todo-description">Description</Label>
            <Textarea
              id="todo-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="todo-status">Statut</Label>
            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                if (value && isTodoStatus(value)) setSelectedStatus(value);
              }}
            >
              <SelectTrigger id="todo-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TODO_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {TODO_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {task?.completedAt && (
            <p className="text-xs text-muted-foreground">
              Date de fin : {formatDate(task.completedAt)}
            </p>
          )}
          {(task?.prUrl || task?.previewUrl) && (
            <div className="flex flex-wrap gap-2">
              {task.prUrl && (
                <a
                  href={task.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <GitPullRequest className="size-3.5" />
                  Pull Request
                </a>
              )}
              {task.previewUrl && (
                <a
                  href={task.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  Preview Vercel
                </a>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({
  project,
  taskCount,
  pending,
  onOpenChange,
  onConfirm,
}: {
  project: TodoProjectView | null;
  taskCount: number;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={project !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le projet ?</AlertDialogTitle>
          <AlertDialogDescription>
            {taskCount > 0
              ? "Ce projet contient des tâches et ne peut pas être supprimé."
              : `Le projet ${project?.name ?? ""} sera supprimé définitivement.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || taskCount > 0}
            onClick={onConfirm}
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteTaskDialog({
  task,
  pending,
  onOpenChange,
  onConfirm,
}: {
  task: TodoTaskView | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={task !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
          <AlertDialogDescription>
            La tâche #{task?.number ?? ""} sera supprimée définitivement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
