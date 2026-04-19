import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { load } from "js-yaml";
import { AgentsFile, AgentsFileSchema } from "../types/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedConfig: AgentsFile | null = null;
let configPath = resolve(__dirname, "../../config/agents.yaml");

export function setConfigPath(path: string): void {
  configPath = resolve(path);
  cachedConfig = null;
}

export function getConfig(): AgentsFile {
  if (cachedConfig) return cachedConfig;

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    throw new Error(
      `Could not read agents config at: ${configPath}\n` +
        "Run from the giraffe-code project root or pass --config <path>."
    );
  }

  const parsed = load(raw);
  cachedConfig = AgentsFileSchema.parse(parsed);
  return cachedConfig;
}

export function validateApiKey(): void {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required.\n" +
        "Set it with:  export ANTHROPIC_API_KEY=sk-ant-..."
    );
  }
}
