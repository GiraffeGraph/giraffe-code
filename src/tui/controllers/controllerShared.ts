import React from "react";
import { getConfig } from "../../config/loader.js";
import { getWorkspaceConfig } from "../../core/runtime/workspaceRuntime.js";
import type { TaskStep } from "../../types/config.js";

export type AppScreen =
  | "login"
  | "input"
  | "running"
  | "model"
  | "status"
  | "logout"
  | "doctor"
  | "native_launcher";

export type InteractiveMode = "orchestrate" | "chat" | "delegate";

export function parseApiError(msg: string): string {
  const jsonMatch = msg.match(/:\s*(\{[\s\S]*\})\s*$/);
  if (!jsonMatch) return msg;
  try {
    const parsed = JSON.parse(jsonMatch[1] ?? "") as {
      error?: { message?: string };
    };
    const apiMsg = parsed?.error?.message;
    if (apiMsg) return msg.replace(jsonMatch[0], `: ${apiMsg}`);
  } catch {
    return msg;
  }
  return msg;
}

export function parseInlineArgs(input: string): string[] {
  const result: string[] = [];
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^\s]+)/g;

  for (const match of input.matchAll(regex)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    result.push(value.replace(/\\(["'\\])/g, "$1"));
  }

  return result;
}

export function resolveInteractiveMode(): InteractiveMode {
  const saved = getWorkspaceConfig().defaultMode;
  if (saved === "chat" || saved === "delegate") return saved;
  return "orchestrate";
}

export function resolveDelegateAgent(): string {
  const knownAgents = Object.keys(getConfig().agents);
  const saved = getWorkspaceConfig().defaultDelegateAgent;

  if (saved && knownAgents.includes(saved)) return saved;
  if (knownAgents.includes("claude")) return "claude";
  return knownAgents[0] ?? "claude";
}

export interface RunSetters {
  setScreen: (screen: AppScreen) => void;
  setStatus: (status: string) => void;
  setOutputLines: React.Dispatch<React.SetStateAction<string[]>>;
  setTaskPlan: React.Dispatch<React.SetStateAction<TaskStep[]>>;
  setCurrentAgent: (agent: string) => void;
  setStepInfo: (info: string) => void;
  setIsBusy: (busy: boolean) => void;
}

export function beginRun(setters: RunSetters, status: string, seedPlan: TaskStep[] = []): void {
  setters.setScreen("running");
  setters.setStatus(status);
  setters.setOutputLines([]);
  setters.setTaskPlan(seedPlan);
  setters.setCurrentAgent("—");
  setters.setStepInfo("");
  setters.setIsBusy(true);
}

export function createDelegateSeedPlan(agentKey: string, task: string): TaskStep[] {
  return [
    {
      agent: agentKey,
      instruction: task,
      status: "pending",
      requiresSubOrchestration: false,
      retried: false,
    },
  ];
}

export function createChatSeedPlan(message: string): TaskStep[] {
  return [
    {
      agent: "giraffe",
      instruction: message,
      status: "running",
      requiresSubOrchestration: false,
      retried: false,
    },
  ];
}
