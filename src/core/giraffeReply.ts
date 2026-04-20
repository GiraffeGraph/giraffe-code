import { getConfig } from "../config/loader.js";
import { getUserConfig } from "../config/userConfig.js";
import { detectActiveProvider, supportsDirectApi } from "../auth/refresh.js";
import { completeSimple } from "../providers/complete.js";
import type { Context } from "../providers/types.js";
import type { AgentOutcome, GiraffeState } from "./state.js";
import { formatLatestHandoffForAgent } from "./workspaceRuntime.js";

async function resolvePlannerProvider(): Promise<{
  providerId: string;
  model: string;
}> {
  const userConfig = getUserConfig();
  if (userConfig.planner?.provider && supportsDirectApi(userConfig.planner.provider)) {
    return {
      providerId: userConfig.planner.provider,
      model: userConfig.planner.model ?? "",
    };
  }

  const config = getConfig();
  if (config.planner?.provider && supportsDirectApi(config.planner.provider)) {
    return {
      providerId: config.planner.provider,
      model: config.planner.model ?? "",
    };
  }

  const detected = await detectActiveProvider();
  if (!detected) {
    throw new Error("No LLM provider configured for Giraffe replies. Run: giraffe login");
  }

  return { providerId: detected, model: "" };
}

function trimReply(text: string): string {
  return text.trim().replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "");
}

export async function askGiraffe(question: string): Promise<string> {
  const { providerId, model } = await resolvePlannerProvider();
  const latestHandoff = formatLatestHandoffForAgent();

  const context: Context = {
    systemPrompt:
      "You are Giraffe Code, the platform-agnostic orchestration brain for coding agents. " +
      "Reply directly to the user in a practical, grounded way. " +
      "Do not invent file changes or claim execution happened unless it actually did. " +
      "If delegation would be useful, mention the best next command briefly, but still answer the question yourself.",
    messages: [
      {
        role: "user",
        content:
          `${latestHandoff ? `${latestHandoff}\n` : ""}` +
          `User message:\n${question}\n\n` +
          "Answer as Giraffe Code. Be concrete and helpful.",
      },
    ],
  };

  const result = await completeSimple(providerId, context, {
    model: model || undefined,
    maxTokens: 1200,
  });

  return trimReply(result.text);
}

function buildFallbackSummary(task: string, outcomes: AgentOutcome[], failedCount: number): string {
  if (outcomes.length === 0) {
    return `I finished the run for \"${task}\", but no agent handoff data was captured.`;
  }

  const finished = outcomes
    .filter((item) => item.status === "done")
    .map((item) => `${item.agent}: ${item.completed}`)
    .join("; ");

  const prefix = failedCount > 0
    ? `Run finished with ${failedCount} failed step${failedCount === 1 ? "" : "s"}.`
    : "All planned steps finished.";

  return `${prefix} Task: ${task}. ${finished}`.trim();
}

export async function summarizeRun(
  task: string,
  finalState: GiraffeState
): Promise<string> {
  const outcomes = finalState.agentOutcomes;
  const failedCount = finalState.taskPlan.filter((step) => step.status === "failed").length;

  if (outcomes.length === 0) {
    return buildFallbackSummary(task, outcomes, failedCount);
  }

  try {
    const { providerId, model } = await resolvePlannerProvider();
    const summaryPayload = outcomes.map((item) => ({
      agent: item.agent,
      status: item.status,
      completed: item.completed,
      files: item.files,
      nextHint: item.nextHint,
    }));

    const context: Context = {
      systemPrompt:
        "You are Giraffe Code. Write the final user-facing completion message for a multi-agent coding run. " +
        "Be clear, confident, and honest about failures. Mention the most important files or results. " +
        "Keep it under 180 words.",
      messages: [
        {
          role: "user",
          content:
            `Original task: ${task}\n` +
            `Failed steps: ${failedCount}\n` +
            `Agent outcomes JSON:\n${JSON.stringify(summaryPayload, null, 2)}\n\n` +
            "Write the final message directly to the user.",
        },
      ],
    };

    const result = await completeSimple(providerId, context, {
      model: model || undefined,
      maxTokens: 400,
    });

    const text = trimReply(result.text);
    return text || buildFallbackSummary(task, outcomes, failedCount);
  } catch {
    return buildFallbackSummary(task, outcomes, failedCount);
  }
}
