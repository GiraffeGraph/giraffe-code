import { AgentBase } from "../agents/AgentBase.js";
import { eventBus } from "./eventBus.js";
import type { GiraffeState } from "./state.js";

class ConfiguredAgent extends AgentBase {
  constructor(readonly agentKey: string) {
    super();
  }
}

export function makeAgentNode(
  agentKey: string
): (state: GiraffeState) => Promise<Partial<GiraffeState>> {
  return async (state: GiraffeState): Promise<Partial<GiraffeState>> => {
    const runningStep = state.taskPlan.find((s) => s.status === "running");
    if (!runningStep) {
      throw new Error(`makeAgentNode("${agentKey}"): no running step in taskPlan`);
    }

    const agent = new ConfiguredAgent(agentKey);

    // Emit state update so TUI shows which agent is active
    eventBus.emit("stateUpdate", {
      currentAgent: agentKey,
      taskPlan: state.taskPlan,
    });

    try {
      agent.spawn();
      agent.sendTask(runningStep.instruction, state.handoffContext);

      const output = await agent.waitForCompletion();
      return { liveOutput: output };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const output =
        `\n[AGENT_ERROR] ${agentKey}: ${message}\n` +
        `Agent failed before handoff. Trying fallback if configured...\n`;

      eventBus.emit("output", output);
      return { liveOutput: output };
    } finally {
      agent.kill();
    }
  };
}
