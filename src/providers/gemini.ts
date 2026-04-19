import type { Provider, Context, CompletionOptions, CompletionResult } from "./types.js";

// Gemini uses Google's Generative Language API (raw fetch, no SDK dependency).
// Auth: API key via x-goog-api-key header.
// OAuth (Google account) is not yet implemented — use GEMINI_API_KEY for now.

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates: Array<{
    content: { parts: Array<{ text?: string }> };
  }>;
  modelVersion?: string;
};

function translateMessages(context: Context): {
  contents: GeminiContent[];
  systemInstruction?: { parts: [{ text: string }] };
} {
  const contents: GeminiContent[] = context.messages.map((msg) => {
    if (msg.role === "assistant") {
      return {
        role: "model" as const,
        parts: [{ text: msg.content }],
      };
    }

    if (typeof msg.content === "string") {
      return { role: "user" as const, parts: [{ text: msg.content }] };
    }

    const parts: GeminiPart[] = msg.content.map((block) => {
      if (block.type === "text") return { text: block.text };
      return { inlineData: { mimeType: block.mimeType, data: block.data } };
    });

    return { role: "user" as const, parts };
  });

  const systemInstruction = context.systemPrompt
    ? ({ parts: [{ text: context.systemPrompt }] } as {
        parts: [{ text: string }];
      })
    : undefined;

  return { contents, systemInstruction };
}

export const geminiProvider: Provider = {
  id: "gemini",
  defaultModel: "gemini-1.5-flash",

  async complete(
    context: Context,
    apiKey: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const model = options?.model ?? this.defaultModel;
    const { contents, systemInstruction } = translateMessages(context);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 1024,
      },
    };

    if (systemInstruction) {
      body["systemInstruction"] = systemInstruction;
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text =
      data.candidates[0]?.content.parts.find((p) => p.text != null)?.text ??
      "";

    return { text, providerId: this.id, model };
  },
};
