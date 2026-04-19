import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { getConfig } from "../../config/loader.js";
import { getUserConfig } from "../../config/userConfig.js";
import { TaskStepSchema, type AgentConfig } from "../../types/config.js";
import { z } from "zod";
import { completeSimple } from "../../providers/complete.js";
import { detectActiveProvider, supportsDirectApi } from "../../auth/refresh.js";
import { eventBus } from "../eventBus.js";
import type { GiraffeState } from "../state.js";
import type { Context } from "../../providers/types.js";

const PlannerResponseSchema = z.array(
  z.object({
    agent: z.string(),
    instruction: z.string(),
    requiresSubOrchestration: z.boolean().optional().default(false),
  })
);

type PlannerStep = z.infer<typeof PlannerResponseSchema>[number];
type AgentEntry = [string, AgentConfig];

const MAX_PLAN_STEPS = 7;

function isCommandAvailable(command: string): boolean {
  if (!command.trim()) return false;

  // Absolute/relative binary path
  if (command.includes("/") || command.includes("\\")) {
    return existsSync(command);
  }

  try {
    if (process.platform === "win32") {
      execFileSync("where", [command], { stdio: "ignore" });
    } else {
      execFileSync("which", [command], { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

function getAvailableAgents(config: ReturnType<typeof getConfig>): AgentEntry[] {
  return Object.entries(config.agents).filter(([, agent]) =>
    isCommandAvailable(agent.command)
  );
}

async function resolvePlannerProvider(): Promise<{
  providerId: string;
  model: string;
}> {
  // User config (~/.giraffe/config.json) takes highest priority
  const userConfig = getUserConfig();
  if (userConfig.planner?.provider) {
    const id = userConfig.planner.provider;
    // Silently fall through if credential can't do direct API calls
    if (supportsDirectApi(id)) {
      return { providerId: id, model: userConfig.planner.model ?? "" };
    }
  }

  // Project config (agents.yaml) is next
  const config = getConfig();
  const plannerConfig = config.planner;

  if (plannerConfig?.provider && supportsDirectApi(plannerConfig.provider)) {
    return {
      providerId: plannerConfig.provider,
      model: plannerConfig.model ?? "",
    };
  }

  // Auto-detect first available authenticated provider
  const detected = await detectActiveProvider();
  if (!detected) {
    throw new Error(
      "No LLM provider configured for the planner.\nRun: giraffe login"
    );
  }

  return { providerId: detected, model: "" };
}

function extractJsonCandidates(raw: string): string[] {
  const candidates: string[] = [];
  const trimmed = raw.trim();

  if (trimmed) candidates.push(trimmed);

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (withoutFence && withoutFence !== trimmed) candidates.push(withoutFence);

  const firstBracket = withoutFence.indexOf("[");
  const lastBracket = withoutFence.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.push(withoutFence.slice(firstBracket, lastBracket + 1));
  }

  const unique = new Set<string>();
  return candidates.filter((c) => {
    if (unique.has(c)) return false;
    unique.add(c);
    return true;
  });
}

function parsePlannerSteps(raw: string): PlannerStep[] {
  let lastError: unknown;

  for (const candidate of extractJsonCandidates(raw)) {
    try {
      return PlannerResponseSchema.parse(JSON.parse(candidate));
    } catch (err) {
      lastError = err;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Planner output was not valid JSON: ${detail}`);
}

function buildPlannerContext(
  task: string,
  agentDescriptions: string,
  allowedKeys: string
): Context {
  return {
    systemPrompt:
      "You are a task planner for a multi-agent AI coding system called Giraffe Code. " +
      "Return only valid JSON — no markdown, no explanation, no code fences.",
    messages: [
      {
        role: "user",
        content:
          `Break the following task into an ordered sequence of steps, assigning each step ` +
          `to the most appropriate agent based on its strengths.\n` +
          `Use at most ${MAX_PLAN_STEPS} steps.\n` +
          `Allowed agent keys: ${allowedKeys}\n\n` +
          `Available agents:\n${agentDescriptions}\n\n` +
          `User task: ${task}\n\n` +
          `Return a JSON array only:\n` +
          `[{ "agent": "<key>", "instruction": "<what to do>", "requiresSubOrchestration": false }]`,
      },
    ],
  };
}

function buildRepairContext(
  invalidOutput: string,
  parseError: string,
  allowedKeys: string
): Context {
  return {
    systemPrompt:
      "You repair malformed JSON. Output only valid JSON array; no markdown, no explanation.",
    messages: [
      {
        role: "user",
        content:
          `The following planner output is invalid JSON.\n` +
          `Parse error: ${parseError}\n` +
          `Keep the repaired output to at most ${MAX_PLAN_STEPS} steps.\n` +
          `Allowed agent keys: ${allowedKeys}\n\n` +
          `Invalid output:\n${invalidOutput}\n\n` +
          `Return ONLY a corrected JSON array with schema:\n` +
          `[{ "agent": "<key>", "instruction": "<what to do>", "requiresSubOrchestration": false }]`,
      },
    ],
  };
}

function buildFallbackPlan(task: string, fallbackAgent: string): PlannerStep[] {
  return [
    {
      agent: fallbackAgent,
      instruction: task,
      requiresSubOrchestration: false,
    },
  ];
}

function sanitizePlanAgents(
  rawPlan: PlannerStep[],
  availableAgentKeys: Set<string>,
  fallbackAgent: string
): PlannerStep[] {
  let rewrites = 0;

  const normalized = rawPlan.map((step) => {
    if (availableAgentKeys.has(step.agent)) return step;
    rewrites++;
    return { ...step, agent: fallbackAgent };
  });

  if (rewrites > 0) {
    eventBus.emit(
      "output",
      `\n[PLANNER_WARNING] Rewrote ${rewrites} step(s) to available agent "${fallbackAgent}".\n`
    );
  }

  return normalized;
}

export async function plannerNode(
  state: GiraffeState
): Promise<Partial<GiraffeState>> {
  const config = getConfig();
  const { providerId, model } = await resolvePlannerProvider();

  const availableAgents = getAvailableAgents(config);
  if (availableAgents.length === 0) {
    throw new Error(
      "No runnable agent CLIs found in PATH.\n" +
        "Run: giraffe doctor\n" +
        "Then install missing CLIs or update config/agents.yaml commands."
    );
  }

  const availableAgentKeys = new Set(availableAgents.map(([key]) => key));
  const fallbackAgent = availableAgentKeys.has("claude")
    ? "claude"
    : availableAgents[0]![0];

  const agentDescriptions = availableAgents
    .map(
      ([key, agent]) =>
        `- ${key} (${agent.name}): strengths → ${agent.strengths.join(", ")}`
    )
    .join("\n");

  const allowedKeys = [...availableAgentKeys].join(", ");
  const baseContext = buildPlannerContext(state.task, agentDescriptions, allowedKeys);

  let rawPlan: PlannerStep[] | null = null;
  let invalidOutput = "";
  let parseError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const context =
      attempt === 0
        ? baseContext
        : buildRepairContext(
            invalidOutput,
            parseError || "Unknown JSON parse error",
            allowedKeys
          );

    const result = await completeSimple(providerId, context, {
      model: model || undefined,
      maxTokens: 1024,
    });

    invalidOutput = result.text.trim();

    try {
      rawPlan = parsePlannerSteps(invalidOutput);
      break;
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!rawPlan) {
    rawPlan = buildFallbackPlan(state.task, fallbackAgent);
    eventBus.emit(
      "output",
      `\n[PLANNER_WARNING] Planner returned malformed JSON. Falling back to single-step plan.\n`
    );
  }

  const limitedPlan = rawPlan.slice(0, MAX_PLAN_STEPS);

  if (rawPlan.length > MAX_PLAN_STEPS) {
    eventBus.emit(
      "output",
      `\n[PLANNER_WARNING] Plan had ${rawPlan.length} steps; truncated to ${MAX_PLAN_STEPS}.\n`
    );
  }

  const sanitizedPlan = sanitizePlanAgents(
    limitedPlan,
    availableAgentKeys,
    fallbackAgent
  );

  const taskPlan = sanitizedPlan.map((step) =>
    TaskStepSchema.parse({
      agent: step.agent,
      instruction: step.instruction,
      status: "pending",
      requiresSubOrchestration: step.requiresSubOrchestration ?? false,
      retried: false,
    })
  );

  return { taskPlan };
}
