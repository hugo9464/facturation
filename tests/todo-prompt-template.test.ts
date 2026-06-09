import * as assert from "node:assert/strict";
import {
  DEFAULT_TODO_PROMPT_TEMPLATE,
  renderTodoPrompt,
  resolveTodoPromptTemplate,
} from "../lib/todo";

const legacyDefaultPrompt = `Implémente la tâche UC-{{number}}: {{title}}

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

const prompt = renderTodoPrompt(DEFAULT_TODO_PROMPT_TEMPLATE, {
  number: 72,
  title: "Tester le prompt copié",
  project: "Facturation",
  status: "À faire",
  difficulty: "Rapide",
  description: "Vérifier les consignes.",
  appUrl: "http://localhost:3000",
  taskId: "task-id",
  previewToken: "preview-token",
});

assert.match(prompt, /Implémente la tâche UC-72: Tester le prompt copié/);
assert.match(prompt, /immeuble Morimont 72/);
assert.match(prompt, /Lance l'app en local/);
assert.match(prompt, /Ouvre le Browser Codex sur la bonne page/);
assert.doesNotMatch(prompt, /Pull Request/);
assert.doesNotMatch(prompt, /preview Vercel/);

assert.equal(
  resolveTodoPromptTemplate(legacyDefaultPrompt),
  DEFAULT_TODO_PROMPT_TEMPLATE,
  "the previous built-in prompt should be replaced by the new default",
);

assert.equal(
  resolveTodoPromptTemplate("Prompt personnalisé"),
  "Prompt personnalisé",
  "custom prompts should be preserved",
);

console.log("todo prompt template tests passed");
