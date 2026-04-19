import { getConfig } from "../../config/loader.js";
import { eventBus } from "../eventBus.js";
import type { GiraffeState } from "../state.js";

export async function routerNode(
  state: GiraffeState
): Promise<Partial<GiraffeState>> {
  const pendingStep = state.taskPlan.find((s) => s.status === "pending");
  if (!pendingStep) {
    // No pending steps — nothing to update, conditional edge will route to "done"
    return {};
  }

  const updatedPlan = state.taskPlan.map((step) =>
    step === pendingStep ? { ...step, status: "running" as const } : step
  );

  const stepIndex = state.taskPlan.indexOf(pendingStep) + 1;
  const total = state.taskPlan.length;
  const brief =
    pendingStep.instruction.length > 100
      ? `${pendingStep.instruction.slice(0, 100)}…`
      : pendingStep.instruction;
  eventBus.emit(
    "output",
    `\n🧭 Step ${stepIndex}/${total} → ${pendingStep.agent}: ${brief}\n`
  );

  return {
    taskPlan: updatedPlan,
    currentAgent: pendingStep.agent,
    lastAgentFailed: false,
  };
}

export function routeDecision(state: GiraffeState): string {
  const runningStep = state.taskPlan.find((s) => s.status === "running");

  if (!runningStep) {
    // No running step means no more pending work
    return "done";
  }

  if (state.lastAgentFailed) {
    const config = getConfig();
    const agentConf = config.agents[runningStep.agent];
    const fallback = agentConf?.fallback ?? "claude";
    return fallback;
  }

  if (runningStep.requiresSubOrchestration) {
    return "baby_giraffe";
  }

  return runningStep.agent;
}
