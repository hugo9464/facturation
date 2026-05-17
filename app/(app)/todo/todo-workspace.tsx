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
  MailPlus,
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
  importTodoTasksFromEmailAction,
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
  getTodoPullRequestState,
  isHermesJobActive,
  type TodoPullRequestState,
} from "@/lib/todo-implementation-workflow";
import { formatDate } from "@/lib/dates";

const VIEW_STORAGE_KEY = "facturation.todo.view.v1";
const PROJECT_STORAGE_KEY = "facturation.todo.project.v1";
const PROJECT_TASK_SEEN_STORAGE_KEY = "facturation.todo.project-task-seen.v1";
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

function pullRequestButtonClass(state: TodoPullRequestState, variant: "icon" | "pill") {
  const base =
    variant === "icon"
      ? "grid size-6 shrink-0 place-items-center rounded-full border transition-colors"
      : "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors";

  switch (state) {
    case "ready":
      return cn(
        base,
        "border-emerald-500/35 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200",
      );
    case "conflict":
      return cn(
        base,
        "border-red-500/40 bg-red-500/12 text-red-300 hover:bg-red-500/20 hover:text-red-200",
      );
    case "merged":
      return cn(
        base,
        "border-violet-500/40 bg-violet-500/12 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200",
      );
    case "default":
      return cn(
        base,
        variant === "icon"
          ? "border-transparent text-[#8d8d99] hover:bg-white/[0.06] hover:text-[#f2f2f4]"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      );
  }
}

function pullRequestButtonTitle(state: TodoPullRequestState) {
  switch (state) {
    case "ready":
      return "Pull Request ouverte — prête à merger";
    case "conflict":
      return "Pull Request en conflit de merge";
    case "merged":
      return "Pull Request mergée";
    case "default":
      return "Ouvrir la Pull Request";
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

function latestTaskUpdateTime(tasks: TodoTaskView[]) {
  return tasks.reduce((latest, task) => {
    const updatedAt = new Date(task.updatedAt).getTime();
    return Number.isFinite(updatedAt) ? Math.max(latest, updatedAt) : latest;
  }, 0);
}

function parseSeenProjectTaskUpdates(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      ),
    );
  } catch {
    return null;
  }
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
  const [seenProjectTaskUpdates, setSeenProjectTaskUpdates] = useState<
    Record<string, number>
  >({});
  const [seenProjectTaskUpdatesLoaded, setSeenProjectTaskUpdatesLoaded] =
    useState(false);
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
  const [emailImportOpen, setEmailImportOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const projectTaskUpdateTimes = useMemo(() => {
    const updates = new Map<string, number>();
    for (const project of projects) updates.set(project.id, 0);
    for (const task of tasks) {
      const updatedAt = new Date(task.updatedAt).getTime();
      if (!Number.isFinite(updatedAt)) continue;
      updates.set(task.projectId, Math.max(updates.get(task.projectId) ?? 0, updatedAt));
    }
    return updates;
  }, [projects, tasks]);

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
    if (seenProjectTaskUpdatesLoaded) return;
    const frame = window.requestAnimationFrame(() => {
      const stored = parseSeenProjectTaskUpdates(
        window.localStorage.getItem(PROJECT_TASK_SEEN_STORAGE_KEY),
      );
      const initialSeen =
        stored ?? Object.fromEntries(Array.from(projectTaskUpdateTimes.entries()));
      setSeenProjectTaskUpdates(initialSeen);
      setSeenProjectTaskUpdatesLoaded(true);
      if (!stored) {
        window.localStorage.setItem(
          PROJECT_TASK_SEEN_STORAGE_KEY,
          JSON.stringify(initialSeen),
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectTaskUpdateTimes, seenProjectTaskUpdatesLoaded]);

  useEffect(() => {
    if (!seenProjectTaskUpdatesLoaded || !selectedProjectId) return;
    const frame = window.requestAnimationFrame(() => {
      const latest = projectTaskUpdateTimes.get(selectedProjectId) ?? 0;
      setSeenProjectTaskUpdates((current) => {
        if ((current[selectedProjectId] ?? 0) >= latest) return current;
        const next = { ...current, [selectedProjectId]: latest };
        window.localStorage.setItem(
          PROJECT_TASK_SEEN_STORAGE_KEY,
          JSON.stringify(next),
        );
        return next;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectTaskUpdateTimes, selectedProjectId, seenProjectTaskUpdatesLoaded]);

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
  const projectIndicators = useMemo(() => {
    const indicators = new Map<
      string,
      {
        activeCount: number;
        hasUnseenTaskChange: boolean;
        latestTaskUpdate: string | null;
        taskCount: number;
        toValidateCount: number;
        runningHermesCount: number;
      }
    >();

    for (const project of projects) {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const latestUpdateTime = projectTaskUpdateTimes.get(project.id) ??
        latestTaskUpdateTime(projectTasks);
      indicators.set(project.id, {
        activeCount: projectTasks.filter((task) => task.status !== "DONE").length,
        hasUnseenTaskChange:
          seenProjectTaskUpdatesLoaded &&
          project.id !== selectedProjectId &&
          latestUpdateTime > (seenProjectTaskUpdates[project.id] ?? 0),
        latestTaskUpdate:
          projectTasks.find((task) =>
            new Date(task.updatedAt).getTime() === latestUpdateTime,
          )?.updatedAt ?? null,
        taskCount: projectTasks.length,
        toValidateCount: projectTasks.filter((task) => task.status === "TO_TEST").length,
        runningHermesCount: projectTasks.filter((task) =>
          task.implementationJob
            ? isHermesJobActive(task.implementationJob.status)
            : false,
        ).length,
      });
    }
    return indicators;
  }, [
    projectTaskUpdateTimes,
    projects,
    seenProjectTaskUpdates,
    seenProjectTaskUpdatesLoaded,
    selectedProjectId,
    tasks,
  ]);
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
        <div className="mx-auto grid min-w-0 max-w-[1680px] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <TodoProjectSidebar
            projects={projects}
            selectedProjectId={selectedProjectId}
            indicators={projectIndicators}
            pendingIds={pendingIds}
            onSelectProject={setSelectedProjectId}
            onCreateProject={() => setProjectDialog({ mode: "create" })}
            onEditProject={(project) => setProjectDialog({ mode: "edit", project })}
            onDeleteProject={setProjectToDelete}
          />
          <div className="min-w-0">
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
                onClick={() => setEmailImportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d2d32] bg-[#1d1d21] px-3 py-1.5 text-[13px] font-medium text-[#f2f2f4] transition-colors hover:bg-[#24242a]"
              >
                <MailPlus className="size-4" />
                Importer un email
              </button>
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
      <EmailTaskImportDialog
        key={emailImportOpen ? "email-import-open" : "email-import-closed"}
        open={emailImportOpen}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onOpenChange={setEmailImportOpen}
        onImported={({ imported }) => {
          if (imported.length > 0) {
            setTasks((current) => normalizeOrders([...current, ...imported]));
            setSelectedProjectId(imported[0].projectId);
          }
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

type ProjectSidebarIndicator = {
  activeCount: number;
  hasUnseenTaskChange: boolean;
  latestTaskUpdate: string | null;
  taskCount: number;
  toValidateCount: number;
  runningHermesCount: number;
};

function TodoProjectSidebar({
  projects,
  selectedProjectId,
  indicators,
  pendingIds,
  onSelectProject,
  onCreateProject,
  onEditProject,
  onDeleteProject,
}: {
  projects: TodoProjectView[];
  selectedProjectId: string;
  indicators: Map<string, ProjectSidebarIndicator>;
  pendingIds: Set<string>;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onEditProject: (project: TodoProjectView) => void;
  onDeleteProject: (project: TodoProjectView) => void;
}) {
  return (
    <aside className="min-w-0 self-start rounded-[24px] border border-[#2b2b30] bg-[#1d1d21] p-3 lg:sticky lg:top-5">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#a5a5af]">
            Projets
          </h2>
          <p className="text-[11px] text-[#666671]">Indicateur des tâches modifiées</p>
        </div>
        <button
          type="button"
          className="grid size-7 shrink-0 place-items-center rounded-full text-[#f2f2f4] transition-colors hover:bg-white/[0.06]"
          onClick={onCreateProject}
          aria-label="Créer un projet"
          title="Créer un projet"
        >
          <Plus className="size-4 stroke-[2.2]" />
        </button>
      </div>
      <div className="space-y-1.5">
        {projects.map((project) => {
          const indicator = indicators.get(project.id) ?? {
            activeCount: 0,
            hasUnseenTaskChange: false,
            latestTaskUpdate: null,
            taskCount: 0,
            toValidateCount: 0,
            runningHermesCount: 0,
          };
          const isSelected = project.id === selectedProjectId;
          const isPending = pendingIds.has(project.id);
          const statusLabel = indicator.hasUnseenTaskChange
            ? "Changement dans les tâches"
            : indicator.latestTaskUpdate
              ? `Dernier changement ${formatDate(indicator.latestTaskUpdate)}`
              : "Aucune tâche";

          return (
            <div key={project.id} className="group/project relative">
              <button
                type="button"
                onClick={() => onSelectProject(project.id)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                  isSelected
                    ? "border-[#3b3b44] bg-[#27272d] text-[#f2f2f4]"
                    : "border-transparent text-[#d7d7df] hover:bg-[#24242a]",
                  indicator.hasUnseenTaskChange &&
                    !isSelected &&
                    "border-sky-400/40 bg-sky-400/[0.06]",
                  isPending && "opacity-60",
                )}
                aria-current={isSelected ? "page" : undefined}
                aria-label={`${project.name}. ${statusLabel}`}
                title={statusLabel}
              >
                <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-[#303039] text-[11px] font-semibold uppercase text-[#f2f2f4]">
                  {project.name.trim().slice(0, 1) || "P"}
                  {indicator.hasUnseenTaskChange && !isSelected ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border border-[#1d1d21] bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium leading-tight">
                      {project.name}
                    </span>
                    {indicator.hasUnseenTaskChange && !isSelected ? (
                      <span className="shrink-0 rounded-full bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-sky-200">
                        Nouveau
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-none text-[#777780]">
                    <span>{indicator.taskCount} tâche{indicator.taskCount > 1 ? "s" : ""}</span>
                    {indicator.activeCount > 0 ? <span>• {indicator.activeCount} active{indicator.activeCount > 1 ? "s" : ""}</span> : null}
                    {indicator.toValidateCount > 0 ? <span className="text-amber-300">• {indicator.toValidateCount} à valider</span> : null}
                    {indicator.runningHermesCount > 0 ? <span className="text-sky-300">• Hermes</span> : null}
                  </span>
                </span>
              </button>
              <div className="absolute right-2 top-2 hidden gap-1 group-hover/project:flex">
                <button
                  type="button"
                  className="rounded-md bg-[#1d1d21]/90 px-1.5 py-1 text-[10px] font-medium text-[#c8c8d1] shadow-sm hover:text-[#f2f2f4]"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditProject(project);
                  }}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  className="rounded-md bg-[#1d1d21]/90 px-1.5 py-1 text-[10px] font-medium text-red-300 shadow-sm hover:text-red-200 disabled:opacity-40"
                  disabled={indicator.taskCount > 0 || isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteProject(project);
                  }}
                  title={indicator.taskCount > 0 ? "Impossible de supprimer un projet avec des tâches" : "Supprimer"}
                >
                  Suppr.
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function EmailTaskImportDialog({
  open,
  projects,
  selectedProjectId,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  projects: TodoProjectView[];
  selectedProjectId: string;
  onOpenChange: (open: boolean) => void;
  onImported: (result: {
    imported: TodoTaskView[];
    skipped: { title: string; projectName: string; reason: string }[];
  }) => void;
}) {
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState(selectedProjectId);
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<{
    imported: TodoTaskView[];
    skipped: { title: string; projectName: string; reason: string }[];
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setProjectId(selectedProjectId || projects[0]?.id || "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, projects, selectedProjectId]);

  async function importEmail() {
    if (content.trim().length < 20) {
      toast.error("Colle le contenu complet de l’email client");
      return;
    }
    setPending(true);
    setReport(null);
    const result = await importTodoTasksFromEmailAction({
      content,
      fallbackProjectId: projectId || undefined,
    });
    setPending(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    const imported: TodoTaskView[] =
      "imported" in result ? (result.imported ?? []) : [];
    const skipped: { title: string; projectName: string; reason: string }[] =
      "skipped" in result ? (result.skipped ?? []) : [];
    setReport({ imported, skipped });
    onImported({ imported, skipped });
    if (imported.length > 0) {
      toast.success(`${imported.length} tâche${imported.length > 1 ? "s" : ""} créée${imported.length > 1 ? "s" : ""}`);
      setContent("");
    } else {
      toast.info("Aucune nouvelle tâche à créer");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer des tâches depuis un email client</DialogTitle>
          <DialogDescription>
            Colle l’email reçu: Hermes découpe les demandes, choisit le projet le
            plus pertinent et ignore les demandes déjà couvertes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-import-project">Projet de repli</Label>
            <Select
              value={projectId}
              onValueChange={(value) => setProjectId(value ?? "")}
            >
              <SelectTrigger id="email-import-project">
                <SelectValue placeholder="Choisir un projet" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Utilisé seulement si le projet n’est pas identifiable dans l’email.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-import-content">Contenu de l’email</Label>
            <Textarea
              id="email-import-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={12}
              placeholder="Bonjour, voici les demandes à traiter..."
              className="text-sm"
            />
          </div>
          {report && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {report.imported.length} tâche{report.imported.length > 1 ? "s" : ""} créée{report.imported.length > 1 ? "s" : ""}, {report.skipped.length} ignorée{report.skipped.length > 1 ? "s" : ""}.
              </p>
              {report.skipped.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {report.skipped.map((item, index) => (
                    <li key={`${item.title}-${index}`}>
                      {item.projectName} — {item.title}: {item.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button type="button" onClick={importEmail} disabled={pending || !projectId}>
            {pending ? "Analyse Hermes..." : "Créer les tâches"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const pullRequestState = getTodoPullRequestState({
    taskStatus: task.status,
    jobStatus: task.implementationJob?.status,
    jobAgent: task.implementationJob?.agent,
    prUrl: task.prUrl ?? task.implementationJob?.prUrl,
    logs: task.implementationJob?.logs,
    errorMessage: task.implementationJob?.errorMessage,
  });
  const pullRequestTitle = pullRequestButtonTitle(pullRequestState);
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
              className={pullRequestButtonClass(pullRequestState, "icon")}
              aria-label={pullRequestTitle}
              title={pullRequestTitle}
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
  const testInstructions = task?.implementationJob
    ? getHermesProgressView({
        status: task.implementationJob.status,
        logs: task.implementationJob.logs,
        updatedAt: task.implementationJob.updatedAt,
      }).testInstructions
    : null;
  const pullRequestState = task
    ? getTodoPullRequestState({
        taskStatus: task.status,
        jobStatus: task.implementationJob?.status,
        jobAgent: task.implementationJob?.agent,
        prUrl: task.prUrl ?? task.implementationJob?.prUrl,
        logs: task.implementationJob?.logs,
        errorMessage: task.implementationJob?.errorMessage,
      })
    : "default";
  const pullRequestTitle = pullRequestButtonTitle(pullRequestState);

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
                  className={pullRequestButtonClass(pullRequestState, "pill")}
                  title={pullRequestTitle}
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
          {testInstructions && (
            <div className="space-y-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-emerald-300">Instructions de test Hermes</p>
              <p className="whitespace-pre-wrap leading-relaxed">{testInstructions}</p>
              {task?.previewUrl && (
                <a
                  href={task.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-300 underline-offset-4 hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Ouvrir la page de test dans la preview
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
