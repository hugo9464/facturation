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
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  advanceTodoTaskAction,
  createTodoTaskAction,
  deleteTodoTaskAction,
  importTodoTasksFromEmailAction,
  reorderTodoTasksAction,
  refreshTodoImplementationJobsAction,
  startTodoImplementationAction,
  summarizeTodoTasksAction,
  updateTodoTaskAction,
  uploadTodoTaskAttachmentAction,
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
import { parseTodoDescriptionParts } from "@/lib/todo-description-preview";
import {
  hasUnseenTaskChange,
  parseSeenProjectTaskUpdates,
} from "@/lib/todo-task-review";
import { cn } from "@/lib/utils";
import {
  canRequestHermesMerge,
  getHermesProgressView,
  getHermesStatusTransition,
  getTodoPullRequestState,
  isHermesJobActive,
  type HermesStatusTransition,
  type TodoPullRequestState,
} from "@/lib/todo-implementation-workflow";
import { formatDate } from "@/lib/dates";
import { buildTodoTaskPreviewUrl } from "@/lib/todo-preview-link";

const VIEW_STORAGE_KEY = "facturation.todo.view.v1";
const PROJECT_STORAGE_KEY = "facturation.todo.project.v1";
const PROJECT_TASK_SEEN_STORAGE_KEY = "facturation.todo.project-task-seen.v1";
type TodoView = "list" | "kanban";
const TODO_LIST_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "TO_TEST",
  "DONE",
] as const satisfies readonly TodoStatus[];

type PreferredCodingTool = "codex" | "claude" | "hermes";

const CODING_TOOL_LABELS: Record<PreferredCodingTool, string> = {
  codex: "Codex",
  claude: "Claude Code",
  hermes: "Hermes seul",
};

const UI_DESIGN_TASK_PATTERN =
  /\b(ui|ux|design|interface|front(?:end)?|style|css|tailwind|responsive|mobile|desktop|composant|component|layout|maquette|visuel|visuelle|bouton|modale|dialog|page|écran|ecran)\b/i;

function preferredCodingToolForTask(task: TodoTaskView): PreferredCodingTool {
  const haystack = `${task.title}\n${task.description ?? ""}`;
  return UI_DESIGN_TASK_PATTERN.test(haystack) ? "claude" : "codex";
}

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

function taskHermesStatusTransition(task: TodoTaskView) {
  return getHermesStatusTransition({
    taskStatus: task.status,
    jobStatus: task.implementationJob?.status,
    jobAgent: task.implementationJob?.agent,
  });
}

function isHermesTransitionTask(task: TodoTaskView) {
  return taskHermesStatusTransition(task) !== null;
}

function statusTransitionLabel(transition: HermesStatusTransition) {
  return `${TODO_STATUS_LABELS[transition.from]} → ${TODO_STATUS_LABELS[transition.to]}`;
}

function tasksByHermesTransition(tasks: TodoTaskView[]) {
  return tasks.reduce(
    (acc, task) => {
      const transition = taskHermesStatusTransition(task);
      if (!transition) return acc;
      const key = `${transition.from}->${transition.to}`;
      acc[key] = {
        transition,
        tasks: [...(acc[key]?.tasks ?? []), task],
      };
      acc[key].tasks.sort(compareTasks);
      return acc;
    },
    {} as Record<string, { transition: HermesStatusTransition; tasks: TodoTaskView[] }>,
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

function withImplementationJob(
  task: TodoTaskView,
  job: NonNullable<TodoTaskView["implementationJob"]>,
): TodoTaskView {
  const history = [
    job,
    ...(task.implementationJobs ?? []).filter((item) => item.id !== job.id),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return { ...task, implementationJob: job, implementationJobs: history };
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

function insertAtCursor(text: string, insert: string, start: number, end: number) {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const prefix = before && !before.endsWith("\n") ? "\n" : "";
  const suffix = after && !after.startsWith("\n") ? "\n" : "";
  return `${before}${prefix}${insert}${suffix}${after}`;
}

function TodoDescriptionPreview({ description }: { description: string }) {
  const parts = parseTodoDescriptionParts(description).filter(
    (part) => part.type !== "text" || part.text.trim(),
  );
  if (parts.length === 0) return null;

  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm leading-7">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Aperçu de la description
      </div>
      <div className="whitespace-pre-wrap text-muted-foreground">
        {parts.map((part, index) => {
          if (part.type === "image") {
            return (
              <a
                key={`${part.url}-${index}`}
                href={part.url}
                target="_blank"
                rel="noreferrer"
                className="mx-1 inline-flex align-middle"
                title={part.alt}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={part.url}
                  alt={part.alt}
                  className="inline-block size-16 rounded-md border border-border bg-background object-cover shadow-sm transition-transform hover:scale-[1.03]"
                />
              </a>
            );
          }
          if (part.type === "link") {
            return (
              <a
                key={`${part.url}-${index}`}
                href={part.url}
                target="_blank"
                rel="noreferrer"
                className="mx-1 inline-flex max-w-52 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground underline-offset-4 align-middle hover:bg-muted hover:text-foreground hover:underline"
              >
                <ExternalLink className="size-3" />
                <span className="truncate">{part.label}</span>
              </a>
            );
          }
          return <React.Fragment key={`${part.text}-${index}`}>{part.text}</React.Fragment>;
        })}
      </div>
    </div>
  );
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
  const [projects] = useState(initialProjects);
  const [tasks, setTasks] = useState(() => normalizeOrders(initialTasks));
  const [view, setView] = useState<TodoView>("list");
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialProjects[0]?.id ?? "",
  );
  const [seenProjectTaskUpdates, setSeenProjectTaskUpdates] = useState<
    Record<string, number>
  >({});
  const [taskReviewThresholds, setTaskReviewThresholds] = useState<
    Record<string, number>
  >({});
  const [seenProjectTaskUpdatesLoaded, setSeenProjectTaskUpdatesLoaded] =
    useState(false);
  const [createStatus, setCreateStatus] = useState<TodoStatus | null>(null);
  const [editingTask, setEditingTask] = useState<TodoTaskView | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TodoTaskView | null>(null);
  const [implementationDialogTask, setImplementationDialogTask] =
    useState<TodoTaskView | null>(null);
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
      setTaskReviewThresholds(initialSeen);
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
  const visibleActiveTasks = useMemo(
    () => activeTasks.filter((task) => !isHermesTransitionTask(task)),
    [activeTasks],
  );
  const grouped = useMemo(() => tasksByStatus(visibleActiveTasks), [visibleActiveTasks]);
  const taskNeedsReview = React.useCallback(
    (task: TodoTaskView) =>
      seenProjectTaskUpdatesLoaded &&
      hasUnseenTaskChange({
        taskUpdatedAt: task.updatedAt,
        projectSeenAt:
          taskReviewThresholds[task.projectId] ?? seenProjectTaskUpdates[task.projectId],
      }),
    [seenProjectTaskUpdates, seenProjectTaskUpdatesLoaded, taskReviewThresholds],
  );
  const hermesTransitions = useMemo(
    () => tasksByHermesTransition(activeTasks),
    [activeTasks],
  );
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
            const nextTask = updatedTask ?? task;
            return job ? withImplementationJob(nextTask, job) : nextTask;
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

  function startTaskImplementation(
    task: TodoTaskView,
    instructions?: string,
    preferredCodingTool: PreferredCodingTool = preferredCodingToolForTask(task),
  ) {
    const cleanedInstructions = instructions?.trim();
    const previous = tasks;
    markPending(task.id, true);
    setTasks((current) => appendToStatus(current, task, "IN_PROGRESS"));
    startTransition(async () => {
      const result = await startTodoImplementationAction({
        taskId: task.id,
        preferredCodingTool,
        instructions: cleanedInstructions || undefined,
      });
      markPending(task.id, false);
      if ("error" in result && result.error) {
        setTasks(previous);
        toast.error(result.error);
        if ("job" in result && result.job) {
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id
                ? result.job
                  ? withImplementationJob(item, result.job)
                  : item
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
            current.map((item) => {
              if (item.id !== task.id) return item;
              const nextTask = updatedTask ?? item;
              return job ? withImplementationJob(nextTask, job) : nextTask;
            }),
          ),
        );
      }
      const toolLabel = CODING_TOOL_LABELS[preferredCodingTool];
      toast.success(
        cleanedInstructions
          ? `Instructions envoyées à Hermes (${toolLabel})`
          : `Job Hermes envoyé (${toolLabel})`,
      );
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
                ? result.job
                  ? withImplementationJob(item, result.job)
                  : item
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
            item.id === task.id ? withImplementationJob(item, job) : item,
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
            Aucun projet Todo disponible. Crée ou sélectionne un projet depuis la
            navigation Projets pour afficher ses tâches ici.
          </p>
        </div>
      ) : (
        <div className="mx-auto min-w-0 max-w-[1680px]">
          <div className="mb-4 flex flex-col gap-3 rounded-[18px] border border-[#2b2b30] bg-[#1d1d21] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#777780]">
                Projet Todo
              </p>
              <h1 className="truncate text-lg font-semibold text-[#f2f2f4]">
                {activeProject?.name ?? "Projet"}
              </h1>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailImportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d2d32] bg-[#17171a] px-3 py-1.5 text-[13px] font-medium text-[#f2f2f4] transition-colors hover:bg-[#24242a]"
              >
                <MailPlus className="size-4" />
                Importer un email
              </button>
            </div>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={onDragEnd}
          >
            <TodoLinearListView
              grouped={grouped}
              hermesTransitions={hermesTransitions}
              pendingIds={pendingIds}
              taskNeedsReview={taskNeedsReview}
              onCreate={setCreateStatus}
              onEdit={setEditingTask}
              onDelete={setTaskToDelete}
              onAdvance={advanceTask}
              onCopyPrompt={copyTaskPrompt}
              onStartImplementation={(task) => {
                if (task.implementationJob) setImplementationDialogTask(task);
                else startTaskImplementation(task);
              }}
              onValidateImplementation={validateTaskImplementation}
              onOpenSummary={() => setSummaryOpen(true)}
            />
          </DndContext>
          <p className="pt-3 text-center text-[11px] text-[#60606c]">v2.21.9</p>
        </div>
      )}

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
      <TodoImplementationInstructionsDialog
        key={implementationDialogTask?.id ?? "implementation-instructions-closed"}
        task={implementationDialogTask}
        pending={Boolean(
          implementationDialogTask && pendingIds.has(implementationDialogTask.id),
        )}
        onOpenChange={(open) => {
          if (!open) setImplementationDialogTask(null);
        }}
        onSubmit={(instructions, preferredCodingTool) => {
          if (!implementationDialogTask) return;
          startTaskImplementation(
            implementationDialogTask,
            instructions,
            preferredCodingTool,
          );
          setImplementationDialogTask(null);
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
  const [prompt, setPrompt] = useState("");
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
      prompt,
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
          <div className="space-y-2">
            <Label htmlFor="task-summary-prompt">Consigne IA optionnelle</Label>
            <Textarea
              id="task-summary-prompt"
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={2000}
              placeholder="Ex. Fais le résumé en 3 parties, classe les tâches par date, insiste sur les corrections visibles par le client..."
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Ajoute une instruction pour adapter le format ou l&apos;ordre du résumé généré.
            </p>
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

function TodoImplementationInstructionsDialog({
  task,
  pending,
  onOpenChange,
  onSubmit,
}: {
  task: TodoTaskView | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (instructions: string, preferredCodingTool: PreferredCodingTool) => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [preferredCodingTool, setPreferredCodingTool] =
    useState<PreferredCodingTool>(task ? preferredCodingToolForTask(task) : "codex");
  const canSubmit = instructions.trim().length > 0;

  return (
    <Dialog open={task !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter des instructions à Hermes</DialogTitle>
          <DialogDescription>
            {task
              ? `UC-${task.number} — décris les corrections ou modifications à demander à Hermes.`
              : "Décris les corrections ou modifications à demander à Hermes."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit(instructions, preferredCodingTool);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="todo-hermes-coding-tool">Agent de code</Label>
            <Select
              value={preferredCodingTool}
              onValueChange={(value) =>
                setPreferredCodingTool(value as PreferredCodingTool)
              }
            >
              <SelectTrigger id="todo-hermes-coding-tool">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="codex">Codex — par défaut</SelectItem>
                <SelectItem value="claude">Claude Code — UI/design</SelectItem>
                <SelectItem value="hermes">Hermes seul</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Les nouveaux jobs choisissent automatiquement Claude Code pour les
              tâches UI/design, sinon Codex. Tu peux forcer l’agent ici pour une
              relance avec instructions.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="todo-hermes-extra-instructions">
              Instructions complémentaires
            </Label>
            <Textarea
              id="todo-hermes-extra-instructions"
              rows={6}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Ex: Corrige le texte du bouton, garde le même style, ajoute un test..."
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Un nouveau job Hermes sera lancé avec le contexte de la tâche et ces
              consignes. Utilisable pendant un job en cours ou après une PR de
              correction.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? "Envoi..." : "Envoyer à Hermes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type TodoViewProps = {
  grouped: Record<TodoStatus, TodoTaskView[]>;
  hermesTransitions: Record<
    string,
    { transition: HermesStatusTransition; tasks: TodoTaskView[] }
  >;
  pendingIds: Set<string>;
  taskNeedsReview: (task: TodoTaskView) => boolean;
  onCreate: (status: TodoStatus) => void;
  onEdit: (task: TodoTaskView) => void;
  onDelete: (task: TodoTaskView) => void;
  onAdvance: (task: TodoTaskView) => void;
};

type TodoLinearViewProps = TodoViewProps & {
  onCopyPrompt: (task: TodoTaskView) => void;
  onStartImplementation: (task: TodoTaskView) => void;
  onValidateImplementation: (task: TodoTaskView) => void;
  onOpenSummary: () => void;
};

function TodoLinearListView({
  grouped,
  hermesTransitions,
  pendingIds,
  taskNeedsReview,
  onCreate,
  onEdit,
  onDelete,
  onAdvance,
  onCopyPrompt,
  onStartImplementation,
  onValidateImplementation,
  onOpenSummary,
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
      {statuses.map((status) => {
        const transition = hermesTransitions[`${status}->${TODO_STATUSES[TODO_STATUSES.indexOf(status) + 1] ?? ""}`];
        return (
          <React.Fragment key={status}>
            <TodoLinearSection
              status={status}
              tasks={grouped[status]}
              collapsed={collapsedStatuses.has(status)}
              pendingIds={pendingIds}
              taskNeedsReview={taskNeedsReview}
              onCreate={onCreate}
              onToggleCollapse={toggleStatus}
              onEdit={onEdit}
              onDelete={onDelete}
              onAdvance={onAdvance}
              onCopyPrompt={onCopyPrompt}
              onStartImplementation={onStartImplementation}
              onValidateImplementation={onValidateImplementation}
              onOpenSummary={onOpenSummary}
            />
            {transition && transition.tasks.length > 0 ? (
              <TodoHermesTransitionSection
                transition={transition.transition}
                tasks={transition.tasks}
                pendingIds={pendingIds}
                taskNeedsReview={taskNeedsReview}
                onEdit={onEdit}
                onDelete={onDelete}
                onAdvance={onAdvance}
                onCopyPrompt={onCopyPrompt}
                onStartImplementation={onStartImplementation}
                onValidateImplementation={onValidateImplementation}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TodoLinearSection({
  status,
  tasks,
  collapsed,
  pendingIds,
  taskNeedsReview,
  onCreate,
  onToggleCollapse,
  onEdit,
  onDelete,
  onAdvance,
  onCopyPrompt,
  onStartImplementation,
  onValidateImplementation,
  onOpenSummary,
}: Omit<TodoLinearViewProps, "grouped" | "hermesTransitions"> & {
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
        <div className="flex shrink-0 items-center gap-2">
          {status === "TO_TEST" && (
            <button
              type="button"
              onClick={onOpenSummary}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#2d2d32] px-2.5 text-[12px] font-medium text-[#f2f2f4] transition-colors hover:bg-white/[0.06]"
            >
              <Sparkles className="size-3.5" />
              Résumé IA
            </button>
          )}
          <button
            type="button"
            className="grid size-7 place-items-center rounded-full text-[#f2f2f4] transition-colors hover:bg-white/[0.06]"
            onClick={() => onCreate(status)}
            aria-label={`Créer dans ${TODO_STATUS_LABELS[status]}`}
          >
            <Plus className="size-5 stroke-[2.2]" />
          </button>
        </div>
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
                  needsReview={taskNeedsReview(task)}
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

function TodoHermesTransitionSection({
  transition,
  tasks,
  pendingIds,
  taskNeedsReview,
  onEdit,
  onDelete,
  onAdvance,
  onCopyPrompt,
  onStartImplementation,
  onValidateImplementation,
}: Omit<TodoLinearViewProps, "grouped" | "hermesTransitions" | "onCreate" | "onOpenSummary"> & {
  transition: HermesStatusTransition;
  tasks: TodoTaskView[];
}) {
  return (
    <section className="px-2 sm:px-3" aria-label={statusTransitionLabel(transition)}>
      <div className="mb-3 flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-sky-300/90">
        <span
          className={cn("size-3 shrink-0 rounded-full border", statusDotClass(transition.from))}
          aria-hidden="true"
        />
        <span className="h-px min-w-5 flex-1 bg-sky-400/30" aria-hidden="true" />
        <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-1 leading-none">
          Hermes en transition · {statusTransitionLabel(transition)}
        </span>
        <span className="h-px min-w-5 flex-1 bg-sky-400/30" aria-hidden="true" />
        <span
          className={cn("size-3 shrink-0 rounded-full border", statusDotClass(transition.to))}
          aria-hidden="true"
        />
      </div>
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="overflow-hidden rounded-xl border border-sky-400/25 bg-sky-400/[0.07] shadow-[0_0_24px_rgba(56,189,248,0.08)]">
          {tasks.map((task) => (
            <SortableLinearTaskRow
              key={task.id}
              task={task}
              pending={pendingIds.has(task.id)}
              needsReview={taskNeedsReview(task)}
              onEdit={onEdit}
              onDelete={onDelete}
              onAdvance={onAdvance}
              onCopyPrompt={onCopyPrompt}
              onStartImplementation={onStartImplementation}
              onValidateImplementation={onValidateImplementation}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableLinearTaskRow({
  task,
  pending,
  needsReview,
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
  const taskPreviewUrl = buildTodoTaskPreviewUrl(task.previewUrl, task.projectId);
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
          {needsReview ? (
            <span
              className="size-2 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.85)]"
              aria-label="Tâche modifiée à regarder"
              title="Tâche modifiée à regarder"
            />
          ) : null}
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
          {taskPreviewUrl ? (
            <a
              href={taskPreviewUrl}
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
        aria-label={
          task.implementationJob
            ? "Ajouter des instructions pour Hermes"
            : "Implémenter avec Hermes"
        }
        title={
          task.implementationJob
            ? "Ajouter des instructions pour corriger/modifier avec Hermes"
            : "Implémenter avec Hermes"
        }
      >
        {task.implementationJob ? (
          <MessageSquarePlus className="size-3.5 stroke-[1.9]" />
        ) : (
          <Sparkles className="size-3.5 stroke-[1.9]" />
        )}
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
  needsReview?: boolean;
  onEdit: (task: TodoTaskView) => void;
  onDelete: (task: TodoTaskView) => void;
  onAdvance: (task: TodoTaskView) => void;
};

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
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const descriptionRef = React.useRef<HTMLTextAreaElement | null>(null);
  const instructionHistory = (task?.implementationJobs ?? [])
    .filter((job) => job.instructions?.trim())
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
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
  const taskPreviewUrl = task
    ? buildTodoTaskPreviewUrl(task.previewUrl, task.projectId)
    : null;

  async function uploadAttachment(
    file: File | undefined,
    selection?: { start: number; end: number },
  ) {
    if (!file) return;
    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append("file", file);
    if (task?.id) formData.append("taskId", task.id);
    try {
      const result = await uploadTodoTaskAttachmentAction(formData);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const attachment = "attachment" in result ? result.attachment : null;
      const markdown = attachment?.markdown ?? "";
      if (!markdown) return;
      const textarea = descriptionRef.current;
      const start = selection?.start ?? textarea?.selectionStart ?? description.length;
      const end = selection?.end ?? textarea?.selectionEnd ?? description.length;
      const nextDescription = insertAtCursor(description, markdown, start, end);
      setDescription(nextDescription);
      toast.success(
        file.type.startsWith("image/")
          ? "Image ajoutée à la description"
          : "Pièce jointe ajoutée à la description",
      );
      window.requestAnimationFrame(() => {
        textarea?.focus();
        const position = Math.min(nextDescription.length, start + markdown.length + 1);
        textarea?.setSelectionRange(position, position);
      });
    } finally {
      setUploadingAttachment(false);
    }
  }

  function handleDescriptionPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();
    if (!image) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    void uploadAttachment(image, {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="todo-description">Description</Label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Upload className="size-3.5" />
                {uploadingAttachment ? "Upload..." : "Ajouter image/fichier"}
                <input
                  type="file"
                  className="sr-only"
                  disabled={uploadingAttachment || pending}
                  onChange={(event) => {
                    void uploadAttachment(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <Textarea
              ref={descriptionRef}
              id="todo-description"
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onPaste={handleDescriptionPaste}
              placeholder="Écris le contexte. Colle une image au milieu du texte, ou ajoute une image/fichier pour insérer un lien Markdown utilisable dans le prompt Hermes."
            />
            <p className="text-xs text-muted-foreground">
              Colle une image directement dans le texte: elle est uploadée puis insérée à l’emplacement du curseur. Les fichiers restent des liens Markdown transmis à Hermes dans le prompt.
            </p>
            <TodoDescriptionPreview description={description} />
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
          {(task?.prUrl || taskPreviewUrl) && (
            <div className="flex flex-wrap gap-2">
              {task?.prUrl && (
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
              {taskPreviewUrl && (
                <a
                  href={taskPreviewUrl}
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
          {task && (
            <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Historique des instructions Hermes
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {instructionHistory.length}
                </span>
              </div>
              {instructionHistory.length > 0 ? (
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {instructionHistory.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-md border border-border/60 bg-background/60 p-2"
                    >
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {formatDate(job.createdAt)} · {job.status}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                        {job.instructions ?? ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Aucune instruction complémentaire envoyée à Hermes pour cette tâche.
                </p>
              )}
            </div>
          )}
          {testInstructions && (
            <div className="space-y-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-emerald-300">Instructions de test Hermes</p>
              <p className="whitespace-pre-wrap leading-relaxed">{testInstructions}</p>
              {taskPreviewUrl && (
                <a
                  href={taskPreviewUrl}
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
