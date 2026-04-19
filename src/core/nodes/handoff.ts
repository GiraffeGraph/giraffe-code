import { getConfig } from "../../config/loader.js";
import {
  extractHandoff,
  formatHandoffForNextAgent,
} from "../HandoffParser.js";
import { eventBus } from "../eventBus.js";
import type { GiraffeState } from "../state.js";

export function handoffNode(state: GiraffeState): Partial<GiraffeState> {
  const runningStep = state.taskPlan.find((s) => s.status === "running");
  if (!runningStep) return {};

  const handoffData = extractHandoff(state.liveOutput);

  if (handoffData) {
    const config = getConfig();
    const agentName =
      config.agents[runningStep.agent]?.name ?? runningStep.agent;

    const handoffContext = formatHandoffForNextAgent(agentName, handoffData);

    const updatedPlan = state.taskPlan.map((step) =>
      step === runningStep ? { ...step, status: "done" as const } : step
    );

    const nextState: Partial<GiraffeState> = {
      taskPlan: updatedPlan,
      handoffContext,
      completedAgents: [runningStep.agent],
      liveOutput: "",
      lastAgentFailed: false,
    };

    eventBus.emit(
      "output",
      `\n✅ ${runningStep.agent} completed step successfully.\n`
    );
    eventBus.emit("stateUpdate", nextState);
    return nextState;
  }

  // No handoff block found — agent exited without completing the handoff protocol
  const config = getConfig();
  const agentConf = config.agents[runningStep.agent];
  const hasFallback = !!agentConf?.fallback && !runningStep.retried;

  if (hasFallback) {
    // Reset step to pending with fallback agent, mark as retried
    const updatedPlan = state.taskPlan.map((step) =>
      step === runningStep
        ? {
            ...step,
            agent: agentConf!.fallback!,
            status: "pending" as const,
            retried: true,
          }
        : step
    );

    const nextState: Partial<GiraffeState> = {
      taskPlan: updatedPlan,
      liveOutput: "",
      lastAgentFailed: true,
    };

    eventBus.emit(
      "output",
      `\n⚠ ${runningStep.agent} exited without handoff. Retrying with fallback ${agentConf!.fallback!}.\n`
    );
    eventBus.emit("stateUpdate", nextState);
    return nextState;
  }

  // No fallback or already retried — mark as failed and continue to next step
  const updatedPlan = state.taskPlan.map((step) =>
    step === runningStep ? { ...step, status: "failed" as const } : step
  );

  const nextState: Partial<GiraffeState> = {
    taskPlan: updatedPlan,
    liveOutput: "",
    lastAgentFailed: false,
  };

  eventBus.emit(
    "output",
    `\n❌ ${runningStep.agent} failed without valid handoff and no fallback left.\n`
  );
  eventBus.emit("stateUpdate", nextState);
  return nextState;
}
