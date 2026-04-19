import {
  readFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
  mkdirSync,
} from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

export interface UserConfig {
  planner?: {
    provider: string;
    model: string;
  };
  native?: {
    defaultAgent?: string;
    lastTask?: string;
    savedTasks?: string[];
  };
}

const CONFIG_PATH = join(homedir(), ".giraffe", "config.json");

function ensureConfigDir(): void {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

export function getUserConfig(): UserConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as UserConfig;
  } catch {
    return {};
  }
}

export function setUserConfig(config: UserConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    mode: 0o600,
    encoding: "utf8",
  });
  chmodSync(CONFIG_PATH, 0o600);
}
