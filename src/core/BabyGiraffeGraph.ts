import { StateGraph, START, END } from "@langchain/langgraph";
import { GiraffeAnnotation } from "./state.js";
import { plannerNode } from "./nodes/planner.js";
import { routerNode, routeDecision } from "./nodes/router.js";
import { handoffNode } from "./nodes/handoff.js";
import { makeAgentNode } from "./agentNodeFactory.js";
import type { GiraffeState } from "./state.js";

/**
 * Baby Giraffe is a sub-orchestrator that manages its own agent chain
 * for a complex sub-task. It uses the same state shape as the parent graph
 * and is compiled as a standalone runnable, then added as a node to GiraffeGraph.
 *
 * Before entering this subgraph, a prepareBabyGiraffe node in the parent
 * sets state.task = the sub-task's instruction and clears state.taskPlan,
 * giving the baby giraffe a clean slate to plan and execute.
 */

async function prepareBabyGiraffeNode(
  state: GiraffeState
): Promise<Partial<GiraffeState>> {
  // The running step's instruction becomes the baby giraffe's top-level task
  const runningStep = state.taskPlan.find((s) => s.status === "running");
  if (!runningStep) return {};

  return {
    task: runningStep.instruction,
    taskPlan: [],
    handoffContext: state.handoffContext,
    completedAgents: [],
    liveOutput: "",
    lastAgentFailed: false,
  };
}

export function buildBabyGiraffeGraph() {
  const subgraph = new StateGraph(GiraffeAnnotation)
    .addNode("bg_prepare", prepareBabyGiraffeNode)
    .addNode("bg_planner", plannerNode)
    .addNode("bg_router", routerNode)
    .addNode("claude", makeAgentNode("claude"))
    .addNode("codex", makeAgentNode("codex"))
    .addNode("pi", makeAgentNode("pi"))
    .addNode("gemini", makeAgentNode("gemini"))
    .addNode("bg_handoff", handoffNode)
    .addEdge(START, "bg_prepare")
    .addEdge("bg_prepare", "bg_planner")
    .addEdge("bg_planner", "bg_router")
    .addConditionalEdges("bg_router", routeDecision, {
      claude: "claude",
      codex: "codex",
      pi: "pi",
      gemini: "gemini",
      baby_giraffe: END, // Baby giraffes don't nest further in MVP
      done: END,
    })
    .addEdge("claude", "bg_handoff")
    .addEdge("codex", "bg_handoff")
    .addEdge("pi", "bg_handoff")
    .addEdge("gemini", "bg_handoff")
    .addEdge("bg_handoff", "bg_router");

  return subgraph.compile();
}
