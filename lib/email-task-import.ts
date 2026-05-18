import { z } from "zod";

export const importedEmailTaskSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().optional().default(""),
  alreadyDone: z.boolean().optional().default(false),
  reason: z.string().trim().optional().default(""),
});

export type EmailTaskProposal = z.infer<typeof importedEmailTaskSchema>;

export function normalizeTaskFingerprint(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractJsonPayload(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text;
  const arrayStart = source.indexOf("[");
  const arrayEnd = source.lastIndexOf("]");
  const objectStart = source.indexOf("{");
  const objectEnd = source.lastIndexOf("}");

  if (arrayStart !== -1 && arrayEnd > arrayStart) return source.slice(arrayStart, arrayEnd + 1);
  if (objectStart !== -1 && objectEnd > objectStart) return source.slice(objectStart, objectEnd + 1);
  throw new Error("Réponse IA invalide: JSON introuvable");
}

export function parseEmailTaskProposals(text: string) {
  const parsed = JSON.parse(extractJsonPayload(text)) as unknown;
  const payload =
    Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && "tasks" in parsed
        ? (parsed as { tasks: unknown }).tasks
        : parsed;
  const result = z.array(importedEmailTaskSchema).safeParse(payload);
  if (!result.success) {
    throw new Error("Réponse IA invalide: tâches non reconnues");
  }
  return result.data;
}

export function buildEmailTaskImportPrompt({
  projectCatalog,
  existingTaskCatalog,
  fallbackProjectId,
  fallbackProjectName,
  content,
}: {
  projectCatalog: string;
  existingTaskCatalog: string;
  fallbackProjectId: string;
  fallbackProjectName: string;
  content: string;
}) {
  return `Analyse l’email client ci-dessous. Découpe uniquement les demandes actionnables en petites tâches indépendantes. Crée une tâche distincte pour chaque puce, ligne de demande, capture d’écran annotée ou changement demandé, même si plusieurs demandes concernent le même écran. Conserve le contexte Dashboard/App/PDF dans la description. Ne fusionne pas plusieurs demandes en une seule tâche. Associe chaque tâche au projet existant le plus pertinent avec son projectId. Si une demande semble déjà couverte par une tâche existante, marque alreadyDone=true et explique brièvement reason au lieu de la recréer.

Réponds uniquement avec un tableau JSON. Chaque élément doit respecter exactement ce format:
{"projectId":"uuid-du-projet-ou-null","title":"titre court impératif","description":"contexte utile extrait de l'email","alreadyDone":false,"reason":""}

Projets disponibles:
${projectCatalog}

Tâches existantes à comparer:
${existingTaskCatalog}

Projet de repli si le projet est ambigu: ${fallbackProjectId} (${fallbackProjectName})

Email client:
${content}`;
}

function cleanEmailLine(line: string) {
  return line
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/Capture d[’']ecran\s+\d{4}-\d{2}-\d{2}\s+a\s+\d{2}\.\d{2}\.\d{2}\.png\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleForLine(line: string) {
  const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("changer l'ordre des toitures") || normalized.includes("changer l’ordre des toitures")) {
    return "Permettre de réordonner les toitures";
  }
  if (normalized.includes("texte du rapport pdf") && normalized.includes("apparait pas")) {
    return "Afficher le texte PDF manquant avant les questions";
  }
  if (normalized.includes("obstacle - nombre") || normalized.includes("obstacle - combien")) {
    return "Renommer les titres d’obstacle";
  }
  if (normalized.includes("faitage") && normalized.includes("photo")) {
    return "Corriger le titre de photo faîtage";
  }
  if (normalized.includes("question 243") || normalized.includes("type d'aretier")) {
    return "Corriger le libellé de la question 243";
  }
  if (normalized.includes("echelle de versant")) {
    return "Remplacer la phrase de l’échelle de versant";
  }
  if (normalized.includes("obstacles sur la toiture")) {
    return "Remplacer la phrase des obstacles de toiture";
  }
  if (normalized.includes("bardelis")) {
    return "Ajouter le parcours bardelis sur les rives";
  }

  const withoutLead = line
    .replace(/^il faudrait\s+/i, "")
    .replace(/^pouvoir\s+/i, "")
    .replace(/[.!?]\s*$/, "")
    .trim();
  return withoutLead.charAt(0).toUpperCase() + withoutLead.slice(1, 139);
}

export function extractEmailTaskCandidates(content: string, fallbackProjectId: string) {
  const proposals: EmailTaskProposal[] = [];
  let current: EmailTaskProposal | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = cleanEmailLine(rawLine);
    if (!line || /^app\s*:$/i.test(line)) continue;

    const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const isContinuation =
      current?.title === "Ajouter le parcours bardelis sur les rives" &&
      (/^si\s+(oui|non)\b/.test(normalized) || /^et\s+ensuite\b/.test(normalized));
    if (isContinuation && current) {
      current.description = [current.description, line].filter(Boolean).join("\n");
      continue;
    }

    const actionable =
      /\b(il faudrait|pouvoir|remplacer|ajouter|changer|corriger|on voit que)\b/i.test(line) ||
      normalized.includes("apparait pas") ||
      /\b(bardelis|obstacle|fa[iî]tage|question 243|échelle de versant|echelle de versant)\b/i.test(line);
    if (!actionable) continue;

    current = {
      projectId: fallbackProjectId,
      title: titleForLine(line),
      description: line,
      alreadyDone: false,
      reason: "",
    };
    proposals.push(current);
  }

  const seen = new Set<string>();
  return proposals.filter((proposal) => {
    const key = normalizeTaskFingerprint(proposal.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
