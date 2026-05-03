import type { TodoStatus } from "@/db/schema";

export const TODO_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "TO_TEST",
  "DONE",
  "CANCELLED",
] as const satisfies readonly TodoStatus[];

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  TO_TEST: "À valider",
  DONE: "Terminé",
  CANCELLED: "Annulé",
};

export const TODO_STATUS_BADGE_VARIANTS = {
  BACKLOG: "outline",
  TODO: "secondary",
  IN_PROGRESS: "default",
  TO_TEST: "outline",
  DONE: "default",
  CANCELLED: "destructive",
} as const satisfies Record<
  TodoStatus,
  "default" | "secondary" | "destructive" | "outline"
>;

export function nextTodoStatus(status: TodoStatus): TodoStatus | null {
  switch (status) {
    case "BACKLOG":
      return "TODO";
    case "TODO":
      return "IN_PROGRESS";
    case "IN_PROGRESS":
      return "TO_TEST";
    case "TO_TEST":
      return "DONE";
    case "DONE":
    case "CANCELLED":
      return null;
  }
}
