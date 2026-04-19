import { getCredential, setCredential, resolveShellCredential } from "./storage.js";
import { refreshAnthropic } from "./oauth/anthropic.js";
import { refreshOpenAI } from "./oauth/openai.js";
import type { OAuthCredential } from "./types.js";

const ENV_VARS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  "openai-codex": "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

type RefreshFn = (cred: OAuthCredential) => Promise<OAuthCredential>;

const REFRESH_FNS: Record<string, RefreshFn> = {
  anthropic: refreshAnthropic,
  "openai-codex": refreshOpenAI,
};

/**
 * Resolves a valid bearer token for the given provider ID.
 *
 * Resolution order:
 *  1. auth.json api_key entry (supports !shell-command prefix)
 *  2. auth.json OAuth token (auto-refreshed if expired)
 *  3. Environment variable
 *
 * Throws if no credential is found — caller should direct user to `giraffe login`.
 */
export async function getValidToken(providerId: string): Promise<string> {
  const cred = getCredential(providerId);

  if (cred) {
    if (cred.type === "api_key") {
      return resolveShellCredential(cred.key);
    }

    if (cred.type === "oauth") {
      if (Date.now() < cred.expires) {
        return cred.access;
      }

      // Token expired — silently refresh
      const refreshFn = REFRESH_FNS[providerId];
      if (!refreshFn) {
        throw new Error(
          `OAuth token for "${providerId}" has expired and cannot be automatically refreshed.\n` +
            `Run: giraffe login`
        );
      }

      const refreshed = await refreshFn(cred);
      setCredential(providerId, refreshed);
      return refreshed.access;
    }
  }

  // Fall back to environment variable
  const envVar = ENV_VARS[providerId];
  if (envVar) {
    const val = process.env[envVar];
    if (val) return val;
  }

  throw new Error(
    `No credentials found for provider: "${providerId}".\n` +
      `Run: giraffe login`
  );
}

/**
 * Returns true if the stored credential for this provider can make
 * direct API calls (i.e. there is any stored credential to try).
 * If the token turns out to be invalid, the API call will fail with a
 * clear error — we don't pre-emptively block based on token type.
 */
export function supportsDirectApi(providerId: string): boolean {
  const cred = getCredential(providerId);
  if (cred) return true;

  const envVar = ENV_VARS[providerId];
  return !!(envVar && process.env[envVar]);
}

/** Returns the first provider ID that has a resolvable credential for direct API use. */
export async function detectActiveProvider(): Promise<string | undefined> {
  const candidates = ["anthropic", "openai-codex", "gemini"];

  for (const id of candidates) {
    if (!supportsDirectApi(id)) continue;
    try {
      await getValidToken(id);
      return id;
    } catch {
      // not available — try next
    }
  }

  return undefined;
}
