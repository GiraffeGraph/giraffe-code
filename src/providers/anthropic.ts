import type { Provider, Context, CompletionOptions, CompletionResult } from "./types.js";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicResponse = {
  content: Array<{ type: string; text?: string }>;
  model: string;
};

function translateMessages(context: Context): {
  messages: AnthropicMessage[];
  system?: string;
} {
  const messages: AnthropicMessage[] = context.messages.map((msg) => {
    if (msg.role === "assistant") {
      return { role: "assistant", content: msg.content };
    }

    if (typeof msg.content === "string") {
      return { role: "user", content: msg.content };
    }

    const blocks: AnthropicContentBlock[] = msg.content.map((block) => {
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      return {
        type: "image",
        source: { type: "base64", media_type: block.mimeType, data: block.data },
      };
    });

    return { role: "user", content: blocks };
  });

  return { messages, system: context.systemPrompt };
}

export const anthropicProvider: Provider = {
  id: "anthropic",
  defaultModel: "claude-haiku-4-5-20251001",

  async complete(
    context: Context,
    apiKey: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const model = options?.model ?? this.defaultModel;
    const { messages, system } = translateMessages(context);

    const body: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens ?? 1024,
      messages,
    };

    if (system) {
      body["system"] = system;
    }

    // OAuth tokens start with sk-ant-oat; API keys start with sk-ant-api
    const isOAuth = apiKey.startsWith("sk-ant-oat");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };

    if (isOAuth) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["anthropic-beta"] = "claude-code-20250219,oauth-2025-04-20";
      headers["x-app"] = "cli";
    } else {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text =
      data.content.find((b) => b.type === "text")?.text ?? "";

    return { text, providerId: this.id, model: data.model };
  },
};
