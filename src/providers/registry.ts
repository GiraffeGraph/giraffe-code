import type { Provider } from "./types.js";
import { anthropicProvider } from "./anthropic.js";
import { openaiProvider } from "./openai.js";
import { geminiProvider } from "./gemini.js";

const REGISTRY = new Map<string, Provider>([
  [anthropicProvider.id, anthropicProvider],
  [openaiProvider.id, openaiProvider],
  [geminiProvider.id, geminiProvider],
]);

export function getProvider(id: string): Provider {
  const provider = REGISTRY.get(id);
  if (!provider) {
    throw new Error(
      `Unknown provider: "${id}". Available: ${[...REGISTRY.keys()].join(", ")}`
    );
  }
  return provider;
}

export function listProviders(): Provider[] {
  return [...REGISTRY.values()];
}
