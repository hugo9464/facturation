const GITHUB_PR_URL_RE =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;

export type TodoSummaryImplementationContextInput = {
  taskNumber: number;
  taskTitle: string;
  taskDescription: string | null;
  taskPrUrl: string | null;
  taskPreviewUrl: string | null;
  jobPrUrl?: string | null;
  jobPreviewUrl?: string | null;
  jobBranchName?: string | null;
  jobLogs?: string | null;
};

export type GithubPullRequestRef = {
  owner: string;
  repo: string;
  number: string;
};

type GithubPullRequestPayload = {
  title?: string;
  body?: string | null;
  state?: string;
  merged?: boolean;
  base?: { ref?: string };
  head?: { ref?: string };
  changed_files?: number;
  additions?: number;
  deletions?: number;
};

type GithubPullRequestFilePayload = {
  filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
};

export function parseGithubPullRequestUrl(
  url: string | null | undefined,
): GithubPullRequestRef | null {
  if (!url) return null;
  const match = url.trim().match(GITHUB_PR_URL_RE);
  if (!match) return null;
  const [, owner, repo, number] = match;
  if (!owner || !repo || !number) return null;
  return { owner, repo, number };
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 80)).trimEnd()}\n…[tronqué: ${
    value.length - maxChars
  } caractères supplémentaires]`;
}

function compactLogs(logs: string | null | undefined) {
  if (!logs) return null;
  const safeLines = logs
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/(token|authorization|bearer|secret|api[_-]?key|password)/i.test(line),
    );
  if (safeLines.length === 0) return null;
  return truncateText(safeLines.slice(-24).join("\n"), 3_000);
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return {
    accept: "application/vnd.github+json",
    "user-agent": "facturation-todo-summary",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchGithubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchGithubPullRequestContext(
  ref: GithubPullRequestRef,
): Promise<string> {
  const apiRoot = `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;
  const [pull, files] = await Promise.all([
    fetchGithubJson<GithubPullRequestPayload>(apiRoot),
    fetchGithubJson<GithubPullRequestFilePayload[]>(`${apiRoot}/files?per_page=100`),
  ]);

  const fileSummaries = files
    .slice(0, 40)
    .map((file) => {
      const changed = [
        file.status,
        `${file.additions ?? 0}+`,
        `${file.deletions ?? 0}-`,
      ]
        .filter(Boolean)
        .join(", ");
      const patch = file.patch
        ? `\n${truncateText(file.patch, 1_200)}`
        : "";
      return `- ${file.filename ?? "fichier inconnu"} (${changed})${patch}`;
    })
    .join("\n");

  return truncateText(
    [
      `PR GitHub: ${ref.owner}/${ref.repo}#${ref.number}`,
      `Titre PR: ${pull.title ?? "(sans titre)"}`,
      `État: ${pull.state ?? "inconnu"}${pull.merged ? ", mergée" : ""}`,
      `Branches: ${pull.head?.ref ?? "?"} → ${pull.base?.ref ?? "?"}`,
      `Diffstat: ${pull.changed_files ?? files.length} fichier(s), ${
        pull.additions ?? 0
      } additions, ${pull.deletions ?? 0} suppressions`,
      pull.body?.trim() ? `Description PR:\n${truncateText(pull.body.trim(), 2_000)}` : null,
      fileSummaries ? `Fichiers et extraits de diff:\n${fileSummaries}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    18_000,
  );
}

export async function buildTodoSummaryImplementationContext(
  items: TodoSummaryImplementationContextInput[],
): Promise<string> {
  const sections = await Promise.all(
    items.map(async (item) => {
      const prUrl = item.taskPrUrl ?? item.jobPrUrl ?? null;
      const prRef = parseGithubPullRequestUrl(prUrl);
      const logs = compactLogs(item.jobLogs);
      let githubContext: string | null = null;
      if (prRef) {
        try {
          githubContext = await fetchGithubPullRequestContext(prRef);
        } catch (error) {
          githubContext = `Contexte GitHub indisponible pour ${prUrl}: ${
            error instanceof Error ? error.message : "erreur inconnue"
          }.`;
        }
      }

      return [
        `UC-${item.taskNumber} — ${item.taskTitle}`,
        prUrl ? `PR: ${prUrl}` : null,
        item.taskPreviewUrl || item.jobPreviewUrl
          ? `Preview: ${item.taskPreviewUrl ?? item.jobPreviewUrl}`
          : null,
        item.jobBranchName ? `Branche: ${item.jobBranchName}` : null,
        logs ? `Logs Hermes récents:\n${logs}` : null,
        githubContext,
      ]
        .filter(Boolean)
        .join("\n\n");
    }),
  );

  return truncateText(sections.filter(Boolean).join("\n\n---\n\n"), 36_000);
}
