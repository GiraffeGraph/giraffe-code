import type { Provider, Context, CompletionOptions, CompletionResult } from "./types.js";

// Uses the OpenAI Responses API (/v1/responses) which is what the Codex CLI
// uses and supports gpt-5.x models with subscription OAuth tokens.
// Chat Completions (/v1/chat/completions) does not support these models.

type ResponsesInput = Array<{ role: "user" | "assistant"; content: string }>;

type ResponsesBody = {
  model: string;
  input: ResponsesInput;
  max_output_tokens: number;
  instructions?: string;
};

type ResponsesOutput = {
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
};

type ResponsesResult = {
  output: ResponsesOutput[];
  model: string;
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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as ResponsesResult;

    const text = (data.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text)
      .join("");

    return { text, providerId: this.id, model: data.model ?? model };
  },
};
