import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  chmodSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import type { AuthCredential, AuthStore } from "./types.js";
import { PROVIDER_STORE_KEY } from "./types.js";

const GIRAFFE_DIR = join(homedir(), ".giraffe");
const AUTH_PATH = join(GIRAFFE_DIR, "auth.json");

function ensureDir(): void {
  if (!existsSync(GIRAFFE_DIR)) {
    mkdirSync(GIRAFFE_DIR, { recursive: true, mode: 0o700 });
  }
}

export function readAuthStore(): AuthStore {
  ensureDir();
  if (!existsSync(AUTH_PATH)) return {};
  try {
    return JSON.parse(readFileSync(AUTH_PATH, "utf8")) as AuthStore;
  } catch {
    return {};
  }
}

export function writeAuthStore(store: AuthStore): void {
  ensureDir();
  writeFileSync(AUTH_PATH, JSON.stringify(store, null, 2), {
    mode: 0o600,
    encoding: "utf8",
  });
  // Ensure strict permissions even if file already existed
  chmodSync(AUTH_PATH, 0o600);
}

export function getCredential(providerId: string): AuthCredential | undefined {
  const storeKey = PROVIDER_STORE_KEY[providerId] ?? providerId;
  return readAuthStore()[storeKey];
}

export function setCredential(
  providerId: string,
  cred: AuthCredential
): void {
  const storeKey = PROVIDER_STORE_KEY[providerId] ?? providerId;
  const store = readAuthStore();
  store[storeKey] = cred;
  writeAuthStore(store);
}

export function hasAnyCredential(): boolean {
  const store = readAuthStore();
  const ENV_VARS: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    "openai-codex": "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
  };

  // Check auth.json entries
  if (Object.keys(store).length > 0) return true;

  // Check env vars as fallback
  for (const envVar of Object.values(ENV_VARS)) {
    if (process.env[envVar]) return true;
  }

  return false;
}

export function removeCredential(providerId: string): boolean {
  const storeKey = PROVIDER_STORE_KEY[providerId] ?? providerId;
  const store = readAuthStore();
  if (!(storeKey in store)) return false;
  delete store[storeKey];
  writeAuthStore(store);
  return true;
}

// Resolve a shell-command credential (prefixed with "!")
export function resolveShellCredential(key: string): string {
  if (!key.startsWith("!")) return key;
  return execSync(key.slice(1), { encoding: "utf8" }).trim();
}
