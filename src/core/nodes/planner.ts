import { getConfig } from "../../config/loader.js";
import { getUserConfig } from "../../config/userConfig.js";
import { TaskStepSchema } from "../../types/config.js";
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

function buildPlannerContext(task: string, agentDescriptions: string): Context {
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
          `Use at most ${MAX_PLAN_STEPS} steps.\n\n` +
          `Available agents:\n${agentDescriptions}\n\n` +
          `User task: ${task}\n\n` +
          `Return a JSON array only:\n` +
          `[{ "agent": "<key>", "instruction": "<what to do>", "requiresSubOrchestration": false }]`,
      },
    ],
  };
}

function buildRepairContext(invalidOutput: string, parseError: string): Context {
  return {
    systemPrompt:
      "You repair malformed JSON. Output only valid JSON array; no markdown, no explanation.",
    messages: [
      {
        role: "user",
        content:
          `The following planner output is invalid JSON.\n` +
          `Parse error: ${parseError}\n` +
          `Keep the repaired output to at most ${MAX_PLAN_STEPS} steps.\n\n` +
          `Invalid output:\n${invalidOutput}\n\n` +
          `Return ONLY a corrected JSON array with schema:\n` +
          `[{ "agent": "<key>", "instruction": "<what to do>", "requiresSubOrchestration": false }]`,
      },
    ],
  };
}

const MAX_PLAN_STEPS = 7;

function buildFallbackPlan(task: string): PlannerStep[] {
  const config = getConfig();
  const knownAgents = Object.keys(config.agents);
  const fallbackAgent = knownAgents.includes("claude")
    ? "claude"
    : (knownAgents[0] ?? "claude");

  return [
    {
      agent: fallbackAgent,
      instruction: task,
      requiresSubOrchestration: false,
    },
  ];
}

export async function plannerNode(
  state: GiraffeState
): Promise<Partial<GiraffeState>> {
  const config = getConfig();
  const { providerId, model } = await resolvePlannerProvider();

  const agentDescriptions = Object.entries(config.agents)
    .map(
      ([key, agent]) =>
        `- ${key} (${agent.name}): strengths → ${agent.strengths.join(", ")}`
    )
    .join("\n");

  const baseContext = buildPlannerContext(state.task, agentDescriptions);

  let rawPlan: PlannerStep[] | null = null;
  let invalidOutput = "";
  let parseError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const context =
      attempt === 0
        ? baseContext
        : buildRepairContext(invalidOutput, parseError || "Unknown JSON parse error");

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
    rawPlan = buildFallbackPlan(state.task);
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

  const taskPlan = limitedPlan.map((step) =>
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
