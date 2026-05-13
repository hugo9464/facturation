import type { TodoStatus } from "@/db/schema";

export const TODO_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "TO_TEST",
  "DONE",
] as const satisfies readonly TodoStatus[];

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  TO_TEST: "À valider",
  DONE: "Terminé",
};

export const TODO_STATUS_BADGE_VARIANTS = {
  TODO: "secondary",
  IN_PROGRESS: "default",
  TO_TEST: "outline",
  DONE: "default",
} as const satisfies Record<
  TodoStatus,
  "default" | "secondary" | "destructive" | "outline"
>;

export function nextTodoStatus(status: TodoStatus): TodoStatus | null {
  switch (status) {
    case "TODO":
      return "IN_PROGRESS";
    case "IN_PROGRESS":
      return "TO_TEST";
    case "TO_TEST":
      return "DONE";
    case "DONE":
      return null;
  }
}
