import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import type { AgentOutcome } from "../orchestration/state.js";

export type WorkspaceMode = "orchestrate" | "chat" | "delegate" | "native";

export interface WorkspaceConfig {
  defaultMode?: WorkspaceMode;
  defaultDelegateAgent?: string;
  lastSessionId?: string;
}

export interface SessionStart {
  mode: WorkspaceMode;
  task: string;
  agent?: string;
}

export interface WorkspaceSession {
  sessionId: string;
  path: string;
}

export interface StoredHandoff {
  sessionId: string;
  mode: WorkspaceMode;
  task: string;
  summary: string;
  agents: AgentOutcome[];
  generatedAt: string;
}

export interface RecentSession {
  sessionId: string;
  path: string;
}

function safeReadJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendJsonl(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildSessionId(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}`;
}

export function getWorkspaceRoot(): string {
  return join(process.cwd(), ".giraffe");
}

export function ensureWorkspaceRuntime(): {
  root: string;
  sessionsDir: string;
  handoffsDir: string;
  configPath: string;
} {
  const root = getWorkspaceRoot();
  const sessionsDir = join(root, "sessions");
  const handoffsDir = join(root, "handoffs");
  const configPath = join(root, "config.json");

  for (const dir of [root, sessionsDir, handoffsDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  return { root, sessionsDir, handoffsDir, configPath };
}

export function getWorkspaceConfig(): WorkspaceConfig {
  const { configPath } = ensureWorkspaceRuntime();
  return safeReadJson<WorkspaceConfig>(configPath, {});
}

export function setWorkspaceConfig(next: WorkspaceConfig): WorkspaceConfig {
  const { configPath } = ensureWorkspaceRuntime();
  writeJson(configPath, next);
  return next;
}

export function updateWorkspaceConfig(
  patch: Partial<WorkspaceConfig>
): WorkspaceConfig {
  const current = getWorkspaceConfig();
  return setWorkspaceConfig({ ...current, ...patch });
}

export function createWorkspaceSession(start: SessionStart): WorkspaceSession {
  const { sessionsDir } = ensureWorkspaceRuntime();
  const sessionId = buildSessionId();
  const path = join(sessionsDir, `${sessionId}.jsonl`);

  appendJsonl(path, {
    type: "session.started",
    at: nowIso(),
    sessionId,
    ...start,
    cwd: process.cwd(),
  });

  updateWorkspaceConfig({ lastSessionId: sessionId });
  return { sessionId, path };
}

export function appendSessionEvent(
  sessionId: string,
  type: string,
  payload: Record<string, unknown> = {}
): void {
  const { sessionsDir } = ensureWorkspaceRuntime();
  const path = join(sessionsDir, `${sessionId}.jsonl`);

  appendJsonl(path, {
    type,
    at: nowIso(),
    sessionId,
    ...payload,
  });
}

function renderHandoffMarkdown(handoff: StoredHandoff): string {
  const lines = [
    "# Giraffe Handoff",
    "",
    `- Session: ${handoff.sessionId}`,
    `- Mode: ${handoff.mode}`,
    `- Generated: ${handoff.generatedAt}`,
    `- Task: ${handoff.task}`,
    "",
    "## Summary",
    handoff.summary,
    "",
    "## Agents",
  ];

  if (handoff.agents.length === 0) {
    lines.push("- No agent outcomes were captured.");
  } else {
    for (const item of handoff.agents) {
      const status = item.status === "done" ? "done" : "failed";
      lines.push(`- ${item.agent} — ${status}: ${item.completed || "no summary"}`);
      if (item.files.length > 0) {
        lines.push(`  - Files: ${item.files.join(", ")}`);
      }
      if (item.context) {
        lines.push(`  - Context: ${item.context}`);
      }
      if (item.nextHint) {
        lines.push(`  - Next hint: ${item.nextHint}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export function writeWorkspaceHandoff(handoff: StoredHandoff): void {
  const { handoffsDir } = ensureWorkspaceRuntime();
  const base = join(handoffsDir, handoff.sessionId);

  writeJson(`${base}.json`, handoff);
  writeFileSync(`${base}.md`, renderHandoffMarkdown(handoff), "utf8");

  writeJson(join(handoffsDir, "latest.json"), handoff);
  writeFileSync(
    join(handoffsDir, "latest.md"),
    renderHandoffMarkdown(handoff),
    "utf8"
  );
}

export function getLatestWorkspaceHandoff(): StoredHandoff | null {
  const { handoffsDir } = ensureWorkspaceRuntime();
  const path = join(handoffsDir, "latest.json");

  if (!existsSync(path)) return null;
  return safeReadJson<StoredHandoff | null>(path, null);
}

export function listRecentWorkspaceSessions(limit = 10): RecentSession[] {
  const { sessionsDir } = ensureWorkspaceRuntime();

  return readdirSync(sessionsDir)
    .filter((name) => name.endsWith(".jsonl"))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit)
    .map((name) => ({
      sessionId: name.replace(/\.jsonl$/, ""),
      path: join(sessionsDir, name),
    }));
}

export function renderLatestWorkspaceHandoff(): string {
  const { handoffsDir } = ensureWorkspaceRuntime();
  const path = join(handoffsDir, "latest.md");

  if (!existsSync(path)) {
    return "No .giraffe handoff found yet.";
  }

  return readFileSync(path, "utf8").trim();
}

export function formatLatestHandoffForAgent(): string {
  const latest = getLatestWorkspaceHandoff();
  if (!latest) return "";

  const lines = [
    "Workspace handoff context:",
    `- Session: ${latest.sessionId}`,
    `- Task: ${latest.task}`,
    `- Summary: ${latest.summary}`,
  ];

  for (const item of latest.agents.slice(-4)) {
    lines.push(`- ${item.agent} (${item.status}): ${item.completed || "no summary"}`);
    if (item.files.length > 0) {
      lines.push(`  Files: ${item.files.join(", ")}`);
    }
    if (item.nextHint) {
      lines.push(`  Hint: ${item.nextHint}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
