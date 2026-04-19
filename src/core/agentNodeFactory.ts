import { ClaudeCodeAgent } from "../agents/ClaudeCodeAgent.js";
import { CodexAgent } from "../agents/CodexAgent.js";
import { GeminiAgent } from "../agents/GeminiAgent.js";
import { PiAgent } from "../agents/PiAgent.js";
import type { AgentBase } from "../agents/AgentBase.js";
import { eventBus } from "./eventBus.js";
import type { GiraffeState } from "./state.js";

type AgentConstructor = new () => AgentBase;

const AGENT_REGISTRY: Record<string, AgentConstructor> = {
  claude: ClaudeCodeAgent,
  codex: CodexAgent,
  pi: PiAgent,
  gemini: GeminiAgent,
};

export function makeAgentNode(
  agentKey: string
): (state: GiraffeState) => Promise<Partial<GiraffeState>> {
  return async (state: GiraffeState): Promise<Partial<GiraffeState>> => {
    const AgentClass = AGENT_REGISTRY[agentKey];
    if (!AgentClass) {
      throw new Error(
        `Unknown agent key: "${agentKey}". ` +
          `Valid keys: ${Object.keys(AGENT_REGISTRY).join(", ")}`
      );
    }

    // Find the running step — may be for a fallback agent, so we look by status only
    const runningStep = state.taskPlan.find((s) => s.status === "running");
    if (!runningStep) {
      throw new Error(`makeAgentNode("${agentKey}"): no running step in taskPlan`);
    }

    const agent = new AgentClass();
    agent.spawn();

    // Emit state update so TUI shows which agent is active
    eventBus.emit("stateUpdate", {
      currentAgent: agentKey,
      taskPlan: state.taskPlan,
    });

    agent.sendTask(runningStep.instruction, state.handoffContext);

    const output = await agent.waitForCompletion();
    agent.kill();

    return { liveOutput: output };
  };
}
