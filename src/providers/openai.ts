import type { Provider, Context, CompletionOptions, CompletionResult } from "./types.js";

// Uses the OpenAI Chat Completions API — works with both API keys and
// subscription OAuth tokens from ChatGPT Plus/Codex.
// The Responses API (v1/responses) is the newer alternative but Chat Completions
// is stable and universally supported with subscription tokens.

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

type OpenAIChatResponse = {
  choices: Array<{
    message: { role: string; content: string | null };
  }>;
  model: string;
};

function translateMessages(context: Context): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];

  if (context.systemPrompt) {
    messages.push({ role: "system", content: context.systemPrompt });
  }

  for (const msg of context.messages) {
    if (msg.role === "assistant") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }

    if (typeof msg.content === "string") {
      messages.push({ role: "user", content: msg.content });
      continue;
    }

    messages.push({
      role: "user",
      content: msg.content.map((block) => {
        if (block.type === "text") {
          return { type: "text" as const, text: block.text };
        }
        return {
          type: "image_url" as const,
          image_url: { url: `data:${block.mimeType};base64,${block.data}` },
        };
      }),
    });
  }

  return messages;
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
    const messages = translateMessages(context);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens ?? 1024,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const text = data.choices[0]?.message?.content ?? "";

    return { text, providerId: this.id, model: data.model };
  },
};
