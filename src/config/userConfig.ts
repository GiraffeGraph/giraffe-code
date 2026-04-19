import { readFileSync, writeFileSync, existsSync, chmodSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface UserConfig {
  planner?: {
    provider: string;
    model: string;
  };
}

const CONFIG_PATH = join(homedir(), ".giraffe", "config.json");

export function getUserConfig(): UserConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as UserConfig;
  } catch {
    return {};
  }
}

export function setUserConfig(config: UserConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    mode: 0o600,
    encoding: "utf8",
  });
  chmodSync(CONFIG_PATH, 0o600);
}
