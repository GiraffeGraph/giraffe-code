import { getProvider } from "./registry.js";
import { getValidToken } from "../auth/refresh.js";
import type { Context, CompletionOptions, CompletionResult } from "./types.js";

/**
 * Provider-agnostic completion entry point.
 *
 * Resolves credentials for the given providerId (from auth.json / env vars,
 * auto-refreshing OAuth tokens as needed), then dispatches to the matching
 * provider adapter.
 */
export async function completeSimple(
  providerId: string,
  context: Context,
  options?: CompletionOptions
): Promise<CompletionResult> {
  const provider = getProvider(providerId);
  const apiKey = await getValidToken(providerId);
  return provider.complete(context, apiKey, options);
}
