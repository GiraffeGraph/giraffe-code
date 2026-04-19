export type ApiKeyCredential = {
  type: "api_key";
  key: string;
};

export type OAuthCredential = {
  type: "oauth";
  access: string;
  refresh: string;
  expires: number; // Unix ms — set slightly before actual expiry for early refresh
  [key: string]: unknown; // provider-specific extras (e.g. accountId for OpenAI)
};

export type AuthCredential = ApiKeyCredential | OAuthCredential;

export type AuthStore = Record<string, AuthCredential>;

export type ProviderMeta = {
  id: string;
  label: string;
  authType: "oauth" | "api_key";
  envVar?: string;
};

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "anthropic",
    label: "Anthropic  (Claude Pro/Max — browser login)",
    authType: "oauth",
  },
  {
    id: "anthropic-key",
    label: "Anthropic  (API Key)",
    authType: "api_key",
    envVar: "ANTHROPIC_API_KEY",
  },
  {
    id: "openai-codex",
    label: "OpenAI     (ChatGPT Plus/Codex — browser login)",
    authType: "oauth",
  },
  {
    id: "openai-key",
    label: "OpenAI     (API Key)",
    authType: "api_key",
    envVar: "OPENAI_API_KEY",
  },
  {
    id: "gemini",
    label: "Google     (Gemini API Key)",
    authType: "api_key",
    envVar: "GEMINI_API_KEY",
  },
];

// Map provider IDs that share credentials (e.g. "anthropic-key" → stored as "anthropic")
export const PROVIDER_STORE_KEY: Record<string, string> = {
  "anthropic-key": "anthropic",
  "openai-key": "openai-codex",
};
