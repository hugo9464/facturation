const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Haiku 4.5 par défaut — surchargeable via ANTHROPIC_SUMMARY_MODEL.
export const TASK_SUMMARY_MODEL =
  process.env.ANTHROPIC_SUMMARY_MODEL ?? "claude-haiku-4-5";

export async function generateText({
  model,
  system,
  prompt,
  maxTokens = 1024,
}: {
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquant dans la configuration");
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Anthropic API ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Réponse vide du modèle");
  return text;
}
