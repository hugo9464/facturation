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

export const TODO_PROMPT_PLACEHOLDERS = [
  { token: "{{number}}", label: "Numéro de la tâche (UC-…)" },
  { token: "{{title}}", label: "Titre de la tâche" },
  { token: "{{project}}", label: "Nom du projet" },
  { token: "{{status}}", label: "Statut actuel" },
  { token: "{{description}}", label: "Description / contexte de la tâche" },
] as const;

export const DEFAULT_TODO_PROMPT_TEMPLATE = `Implémente la tâche UC-{{number}}: {{title}}

Projet: {{project}}
Statut actuel: {{status}}

Contexte de la tâche:
{{description}}

Consignes:
- Analyse le code existant avant de modifier quoi que ce soit.
- Implémente la tâche en respectant les conventions du projet.
- Garde les changements ciblés sur cette tâche.
- Ajoute ou adapte les tests pertinents si le changement le justifie.
- Vérifie avec les commandes de lint/build/test disponibles.`;

export function renderTodoPrompt(
  template: string,
  vars: {
    number: number | string;
    title: string;
    project: string;
    status: string;
    description: string;
  },
): string {
  return template
    .replaceAll("{{number}}", String(vars.number))
    .replaceAll("{{title}}", vars.title)
    .replaceAll("{{project}}", vars.project)
    .replaceAll("{{status}}", vars.status)
    .replaceAll("{{description}}", vars.description);
}

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
