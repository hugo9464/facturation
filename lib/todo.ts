import type { TodoDifficulty, TodoStatus } from "@/db/schema";

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

export const TODO_DIFFICULTIES = [
  "QUICK",
  "COMPLEX",
] as const satisfies readonly TodoDifficulty[];

export const TODO_DIFFICULTY_LABELS: Record<TodoDifficulty, string> = {
  QUICK: "Rapide",
  COMPLEX: "Complexe",
};

export function nextTodoDifficulty(
  difficulty: TodoDifficulty,
): TodoDifficulty {
  return difficulty === "QUICK" ? "COMPLEX" : "QUICK";
}

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
  { token: "{{difficulty}}", label: "Difficulté de la tâche" },
  { token: "{{description}}", label: "Description / contexte de la tâche" },
  { token: "{{appUrl}}", label: "URL de base de l'app" },
  { token: "{{taskId}}", label: "Identifiant interne de la tâche" },
  {
    token: "{{previewToken}}",
    label: "Jeton pour enregistrer les liens de déploiement",
  },
] as const;

export const DEFAULT_TODO_PROMPT_TEMPLATE = `Implémente la tâche UC-{{number}}: {{title}}

Projet: {{project}}
Statut actuel: {{status}}
Difficulté: {{difficulty}}

Contexte de la tâche:
{{description}}

Consignes:
- Analyse le code existant avant de modifier quoi que ce soit.
- Implémente la tâche en respectant les conventions du projet.
- Garde les changements ciblés sur cette tâche.
- Ajoute ou adapte les tests pertinents si le changement le justifie.
- Vérifie avec les commandes de lint/build/test disponibles.

Déploiement:
- Crée une branche dédiée et ouvre une Pull Request avec tes changements.
- Récupère l'URL de preview Vercel générée automatiquement pour cette PR.
- Enregistre les liens sur la tâche en exécutant cette commande (remplace les
  deux URLs par les vraies valeurs) :

  curl -X POST "{{appUrl}}/api/todo/tasks/{{taskId}}/preview" \\
    -H "Authorization: Bearer {{previewToken}}" \\
    -H "Content-Type: application/json" \\
    -d '{"previewUrl": "<URL_PREVIEW_VERCEL>", "prUrl": "<URL_PULL_REQUEST>"}'

- Termine ta réponse en donnant le lien de la Pull Request et le lien de
  preview Vercel.`;

export function renderTodoPrompt(
  template: string,
  vars: {
    number: number | string;
    title: string;
    project: string;
    status: string;
    difficulty: string;
    description: string;
    appUrl: string;
    taskId: string;
    previewToken: string;
  },
): string {
  return template
    .replaceAll("{{number}}", String(vars.number))
    .replaceAll("{{title}}", vars.title)
    .replaceAll("{{project}}", vars.project)
    .replaceAll("{{status}}", vars.status)
    .replaceAll("{{difficulty}}", vars.difficulty)
    .replaceAll("{{description}}", vars.description)
    .replaceAll("{{appUrl}}", vars.appUrl)
    .replaceAll("{{taskId}}", vars.taskId)
    .replaceAll("{{previewToken}}", vars.previewToken);
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
