import { getConfig } from "../../config/loader.js";
import { getUserConfig } from "../../config/userConfig.js";
import { TaskStepSchema } from "../../types/config.js";
import { z } from "zod";
import { completeSimple } from "../../providers/complete.js";
import { detectActiveProvider, supportsDirectApi } from "../../auth/refresh.js";
import type { GiraffeState } from "../state.js";
import type { Context } from "../../providers/types.js";

const PlannerResponseSchema = z.array(
  z.object({
    agent: z.string(),
    instruction: z.string(),
    requiresSubOrchestration: z.boolean().optional().default(false),
  })
);

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

  const context: Context = {
    systemPrompt:
      "You are a task planner for a multi-agent AI coding system called Giraffe Code. " +
      "Return only valid JSON — no markdown, no explanation, no code fences.",
    messages: [
      {
        role: "user",
        content:
          `Break the following task into an ordered sequence of steps, assigning each step ` +
          `to the most appropriate agent based on its strengths.\n\n` +
          `Available agents:\n${agentDescriptions}\n\n` +
          `User task: ${state.task}\n\n` +
          `Return a JSON array only:\n` +
          `[{ "agent": "<key>", "instruction": "<what to do>", "requiresSubOrchestration": false }]`,
      },
    ],
  };

  const result = await completeSimple(providerId, context, {
    model: model || undefined,
    maxTokens: 1024,
  });

  let rawText = result.text.trim();
  // Strip markdown code fences if the model added them despite the system prompt
  rawText = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");

  const rawPlan = PlannerResponseSchema.parse(JSON.parse(rawText));

  const taskPlan = rawPlan.map((step) =>
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
