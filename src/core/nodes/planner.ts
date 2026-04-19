import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../../config/loader.js";
import { TaskStepSchema } from "../../types/config.js";
import { z } from "zod";
import type { GiraffeState } from "../state.js";

const anthropic = new Anthropic();

const PlannerResponseSchema = z.array(
  z.object({
    agent: z.string(),
    instruction: z.string(),
    requiresSubOrchestration: z.boolean().optional().default(false),
  })
);

export async function plannerNode(
  state: GiraffeState
): Promise<Partial<GiraffeState>> {
  const config = getConfig();

  const agentDescriptions = Object.entries(config.agents)
    .map(
      ([key, agent]) =>
        `- ${key} (${agent.name}): strengths → ${agent.strengths.join(", ")}`
    )
    .join("\n");

  const prompt = `You are a task planner for a multi-agent AI coding system called Giraffe Code.
Break the user's task into an ordered sequence of steps, assigning each step to the most appropriate agent based on its strengths.

Available agents:
${agentDescriptions}

User task: ${state.task}

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
Schema: [{ "agent": "<key>", "instruction": "<what to do>", "requiresSubOrchestration": false }]

Rules:
- Use agent keys exactly as listed above (claude, codex, pi, gemini)
- "instruction" must be a clear, actionable task description
- Set "requiresSubOrchestration" to true only for genuinely complex sub-tasks that need their own agent chain
- Order steps logically (implementation before testing, code before docs)`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected non-text response from planner LLM");
  }

  let rawText = content.text.trim();

  // Strip markdown code fences if the model added them despite instructions
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
