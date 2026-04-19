import { execSync } from "child_process";
import { existsSync } from "fs";
import { getConfig } from "../config/loader.js";
import { getUserConfig } from "../config/userConfig.js";
import { getCredential, hasAnyCredential } from "../auth/storage.js";
import type { AuthCredential } from "../auth/types.js";

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  title: string;
  status: DoctorStatus;
  detail: string;
  hint?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
}

const ENV_VARS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  "openai-codex": "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const KNOWN_PLANNER_PROVIDERS = new Set(["anthropic", "openai-codex", "gemini"]);

const INSTALL_HINTS: Record<string, string> = {
  claude: "Install Anthropic CLI and ensure `claude` is in PATH.",
  codex: "Install OpenAI Codex CLI and ensure `codex` is in PATH.",
  gemini: "Install Gemini CLI and ensure `gemini` is in PATH.",
  pi: "Install Pi CLI and ensure `pi` is in PATH.",
};

function commandExists(command: string): boolean {
  if (!command.trim()) return false;

  // Path-like command (absolute/relative)
  if (command.includes("/") || command.includes("\\")) {
    return existsSync(command);
  }

  try {
    if (process.platform === "win32") {
      execSync(`where ${command}`, { stdio: "ignore" });
    } else {
      execSync(`command -v ${command}`, { stdio: "ignore", shell: "/bin/bash" });
    }
    return true;
  } catch {
    return false;
  }
}

function parseOpenAiAccountId(accessToken: string): string | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as Record<string, unknown>;

    const auth = payload["https://api.openai.com/auth"] as
      | Record<string, unknown>
      | undefined;

    const nested = auth?.["chatgpt_account_id"];
    if (typeof nested === "string" && nested.length > 0) return nested;

    const legacy = payload["https://api.openai.com/auth.chatgpt_account_id"];
    return typeof legacy === "string" && legacy.length > 0 ? legacy : undefined;
  } catch {
    return undefined;
  }
}

function describeCredential(providerId: string, cred: AuthCredential | undefined): DoctorCheck {
  const envVar = ENV_VARS[providerId];
  const envConfigured = !!(envVar && process.env[envVar]);

  if (!cred && !envConfigured) {
    return {
      title: `Auth: ${providerId}`,
      status: "warn",
      detail: "No stored credential or environment variable found.",
      hint: `Run: giraffe login  (or set ${envVar})`,
    };
  }

  if (!cred && envConfigured) {
    return {
      title: `Auth: ${providerId}`,
      status: "pass",
      detail: `Using environment variable ${envVar}.`,
    };
  }

  if (!cred) {
    return {
      title: `Auth: ${providerId}`,
      status: "warn",
      detail: "Credential state is unknown.",
    };
  }

  if (cred.type === "api_key") {
    return {
      title: `Auth: ${providerId}`,
      status: "pass",
      detail: "Stored API key credential found.",
    };
  }

  const msLeft = cred.expires - Date.now();
  const minLeft = Math.floor(msLeft / 60_000);

  if (providerId === "openai-codex") {
    const storedAccountId = cred["accountId"];
    const accountId =
      (typeof storedAccountId === "string" ? storedAccountId : undefined) ??
      parseOpenAiAccountId(cred.access);

    if (!accountId) {
      return {
        title: "Auth: openai-codex",
        status: "warn",
        detail: "OAuth token exists, but chatgpt_account_id is missing.",
        hint: "Run: giraffe login  (re-login OpenAI)",
      };
    }
  }

  if (msLeft <= 0) {
    return {
      title: `Auth: ${providerId}`,
      status: "warn",
      detail: "OAuth token is expired; it will refresh on next request.",
    };
  }

  return {
    title: `Auth: ${providerId}`,
    status: "pass",
    detail: `OAuth token is valid (expires in ~${minLeft} min).`,
  };
}

export function runDoctorReport(): DoctorReport {
  const checks: DoctorCheck[] = [];

  checks.push(
    hasAnyCredential()
      ? {
          title: "Credentials",
          status: "pass",
          detail: "At least one provider credential is configured.",
        }
      : {
          title: "Credentials",
          status: "fail",
          detail: "No credentials configured.",
          hint: "Run: giraffe login",
        }
  );

  checks.push(describeCredential("anthropic", getCredential("anthropic")));
  checks.push(describeCredential("openai-codex", getCredential("openai-codex")));
  checks.push(describeCredential("gemini", getCredential("gemini")));

  const userConfig = getUserConfig();
  let config: ReturnType<typeof getConfig> | undefined;

  try {
    config = getConfig();
    checks.push({
      title: "Config",
      status: "pass",
      detail: "agents.yaml loaded successfully.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push({
      title: "Config",
      status: "fail",
      detail: message,
      hint: "Fix config/agents.yaml or run with --config <path>.",
    });
  }

  const plannerProvider =
    userConfig.planner?.provider || config?.planner?.provider || "";
  const plannerModel = userConfig.planner?.model || config?.planner?.model || "";

  if (!plannerProvider) {
    checks.push({
      title: "Planner",
      status: "warn",
      detail: "Provider is set to auto-detect.",
      hint: "Optional: run `giraffe model` to pin provider/model.",
    });
  } else if (!KNOWN_PLANNER_PROVIDERS.has(plannerProvider)) {
    checks.push({
      title: "Planner",
      status: "fail",
      detail: `Unknown planner provider: ${plannerProvider}`,
      hint: "Use anthropic, openai-codex, or gemini.",
    });
  } else {
    const envVar = ENV_VARS[plannerProvider];
    const hasCred = !!getCredential(plannerProvider) || !!(envVar && process.env[envVar]);
    checks.push(
      hasCred
        ? {
            title: "Planner",
            status: "pass",
            detail: `Provider=${plannerProvider}  Model=${plannerModel || "default"}`,
          }
        : {
            title: "Planner",
            status: "warn",
            detail: `Planner provider is ${plannerProvider}, but no credential is available.`,
            hint: "Run: giraffe login  or switch with: giraffe model",
          }
    );
  }

  if (config) {
    for (const [agentKey, agent] of Object.entries(config.agents)) {
      const exists = commandExists(agent.command);
      checks.push(
        exists
          ? {
              title: `Agent CLI: ${agentKey}`,
              status: "pass",
              detail: `Command found: ${agent.command}`,
            }
          : {
              title: `Agent CLI: ${agentKey}`,
              status: "fail",
              detail: `Command not found in PATH: ${agent.command}`,
              hint:
                INSTALL_HINTS[agentKey] ??
                "Install the CLI or change command in config/agents.yaml.",
            }
      );
    }
  }

  const summary = checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );

  return { checks, summary };
}
