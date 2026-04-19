// ── Canonical message format ──────────────────────────────────────────────────
// All providers translate FROM this format TO their own wire format.
// Mirrors the pi-ai Context/Message design.

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image";
  mimeType: string;
  data: string; // base64
};

export type UserContent = string | (TextContent | ImageContent)[];

export type UserMessage = {
  role: "user";
  content: UserContent;
};

export type AssistantMessage = {
  role: "assistant";
  content: string;
};

export type Message = UserMessage | AssistantMessage;

export type Context = {
  systemPrompt?: string;
  messages: Message[];
};

export type CompletionOptions = {
  model?: string;
  maxTokens?: number;
};

export type CompletionResult = {
  text: string;
  providerId: string;
  model: string;
};

// ── Provider interface ────────────────────────────────────────────────────────

export interface Provider {
  readonly id: string;
  readonly defaultModel: string;
  complete(
    context: Context,
    apiKey: string,
    options?: CompletionOptions
  ): Promise<CompletionResult>;
}
