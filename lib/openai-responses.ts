const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type JsonSchemaFormat = {
  type: "json_schema";
  name: string;
  strict: true;
  schema: Record<string, unknown>;
};

type OpenAIResponseOutput = {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
  error?: { message?: string };
};

export const DEFAULT_OPENAI_CV_MODEL =
  process.env.OPENAI_CV_MODEL ?? "gpt-5.4-mini";

function extractOutputText(body: OpenAIResponseBody) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }

  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) {
        return content.text;
      }
    }
  }

  return "";
}

export async function createStructuredOpenAIResponse<T>({
  model = DEFAULT_OPENAI_CV_MODEL,
  system,
  user,
  format,
}: {
  model?: string;
  system: string;
  user: string;
  format: JsonSchemaFormat;
}): Promise<{ data: T; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY manquant dans la configuration");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: system }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: user }],
        },
      ],
      text: { format },
    }),
  });

  const body = (await response.json().catch(() => ({}))) as OpenAIResponseBody;
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `OpenAI a répondu avec le statut ${response.status}`,
    );
  }

  const outputText = extractOutputText(body);
  if (!outputText) {
    throw new Error("OpenAI n'a pas renvoyé de contenu exploitable");
  }

  return { data: JSON.parse(outputText) as T, model };
}
