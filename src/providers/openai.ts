import type { Provider, Context, CompletionOptions, CompletionResult } from "./types.js";

type ResponsesInput = Array<{ role: "user" | "assistant"; content: string }>;

type ResponsesBody = {
  model: string;
  input: ResponsesInput;
  max_output_tokens: number;
  instructions?: string;
  stream?: boolean;
  store?: boolean;
  text?: { verbosity: "low" | "medium" | "high" };
};

type ResponsesResult = {
  output?: Array<{
    type: string;
    role?: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
  output_text?: string;
  model?: string;
};

function buildInput(context: Context): { input: ResponsesInput; instructions?: string } {
  const input: ResponsesInput = [];

  for (const msg of context.messages) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    const content =
      typeof msg.content === "string"
        ? msg.content
        : msg.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");

    input.push({ role, content });
  }

  return {
    input,
    instructions: context.systemPrompt,
  };
}

function extractAccountId(jwtToken: string): string | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(jwtToken.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as Record<string, unknown>;

    const auth = payload["https://api.openai.com/auth"] as
      | Record<string, unknown>
      | undefined;

    const fromNested = auth?.["chatgpt_account_id"];
    if (typeof fromNested === "string" && fromNested.length > 0) {
      return fromNested;
    }

    const legacy = payload["https://api.openai.com/auth.chatgpt_account_id"];
    return typeof legacy === "string" && legacy.length > 0
      ? legacy
      : undefined;
  } catch {
    return undefined;
  }
}

function isLikelySubscriptionToken(token: string): boolean {
  // OpenAI API keys start with sk-. OAuth access tokens are JWTs.
  return !token.startsWith("sk-") && token.split(".").length === 3;
}

function extractText(data: ResponsesResult): string {
  if (typeof data.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }

  return (data.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
}

async function completeWithApiKey(
  model: string,
  token: string,
  body: ResponsesBody
): Promise<ResponsesResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  return (await response.json()) as ResponsesResult;
}

async function completeWithSubscriptionToken(
  model: string,
  token: string,
  body: ResponsesBody
): Promise<ResponsesResult> {
  const accountId = extractAccountId(token);
  if (!accountId) {
    throw new Error(
      "OpenAI OAuth token is missing chatgpt_account_id. Please run: giraffe login"
    );
  }

  const codexBody: ResponsesBody = {
    ...body,
    model,
    store: false,
    stream: false,
    text: { verbosity: "medium" },
  };

  const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "chatgpt-account-id": accountId,
      "OpenAI-Beta": "responses=experimental",
      originator: "giraffe",
    },
    body: JSON.stringify(codexBody),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Codex API error (${response.status}): ${err}`);
  }

  return (await response.json()) as ResponsesResult;
}

export const openaiProvider: Provider = {
  id: "openai-codex",
  defaultModel: "gpt-5.4-mini",

  async complete(
    context: Context,
    apiKey: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const model = options?.model ?? this.defaultModel;
    const { input, instructions } = buildInput(context);

    const body: ResponsesBody = {
      model,
      input,
      max_output_tokens: options?.maxTokens ?? 1024,
    };

    if (instructions) {
      body.instructions = instructions;
    }

    const data = isLikelySubscriptionToken(apiKey)
      ? await completeWithSubscriptionToken(model, apiKey, body)
      : await completeWithApiKey(model, apiKey, body);

    return {
      text: extractText(data),
      providerId: this.id,
      model: data.model ?? model,
    };
  },
};
