import * as assert from "node:assert/strict";
import {
  buildEmailTaskImportPrompt,
  extractEmailTaskCandidates,
  parseEmailTaskProposals,
} from "../lib/email-task-import";

const PROJECT_ID = "5b697732-6ea8-4845-b49a-9d39f41d304d";

const realEmail = `Pouvoir changer l’ordre des toitures dans le dashboard pour qu’elles apparaissent dans un autre ordre sur le rapport.
    Le texte du rapport PDF qui s’affiche dans le dashboard avant les questions n’apparaît pas pour les supports, ni pour les évacuation des eaux pluviales (toiture plate)
    Il faudrait remplacer le titre « obstacle - nombre d’obstacle » par juste : « obstacle » et remplacer « obstacle - combien ont un défaut visible d’étanchéité » par «  obstacle - défaut visible d’étanchéité »
    Parfois le titre de la photo est : « faîtage–repréciser le type de Toiture. » il faudrait le remplacer si par : «  Faîtage. »
    Dans le Dashboard on voit que la question 243 a pour titre «  repréciser le type de toiture »  alors que dans l’app on a pas cette question c’est type d’arêtier

App :
    Capture d’écran 2026-05-13 à 14.05.44.png Il faudrait remplacer la phrase « répondez à cette …. » par « Une échelle de versant est-elle nécessaire pour travailler en sécurité ? »
    Capture d’écran 2026-05-13 à 14.07.59.pngIl faudrait remplacer la phrase « répondez à cette …. » par « Y a-t-il des obstacles sur la toiture ? »
    Dans les rives (gauche et droite ) des toitures à versant si on répond non à cet écran  Capture d’écran 2026-05-13 à 17.45.01.png  il faudrait ajouter un écran posant la question : bardelis ? « oui » « non » .
            Si oui alors poser la question : état ? : « mauvais » « moyen »  « bon »  et ensuite ajouter la phrase dans le rapport : Il y a une rive en bardelis. Son état général peut être considéré comme mauvais-moyen-bon.
            Si non alors on passe à la rive droite ou lucarne.`;

const candidates = extractEmailTaskCandidates(realEmail, PROJECT_ID);
assert.equal(candidates.length, 8);
assert.deepEqual(
  candidates.map((candidate) => candidate.title),
  [
    "Permettre de réordonner les toitures",
    "Afficher le texte PDF manquant avant les questions",
    "Renommer les titres d’obstacle",
    "Corriger le titre de photo faîtage",
    "Corriger le libellé de la question 243",
    "Remplacer la phrase de l’échelle de versant",
    "Remplacer la phrase des obstacles de toiture",
    "Ajouter le parcours bardelis sur les rives",
  ],
);
assert.match(candidates.at(-1)?.description ?? "", /Si oui alors poser la question/);

assert.deepEqual(
  parseEmailTaskProposals('{"tasks":[{"projectId":"' + PROJECT_ID + '","title":"Tâche","description":"Desc"}]}'),
  [{ projectId: PROJECT_ID, title: "Tâche", description: "Desc", alreadyDone: false, reason: "" }],
);

assert.match(
  buildEmailTaskImportPrompt({
    projectCatalog: `- ${PROJECT_ID}: App Facturation`,
    existingTaskCatalog: "Aucune tâche existante.",
    fallbackProjectId: PROJECT_ID,
    fallbackProjectName: "App Facturation",
    content: realEmail,
  }),
  /Crée une tâche distincte pour chaque puce/,
);

console.log("email-task-import tests passed");
