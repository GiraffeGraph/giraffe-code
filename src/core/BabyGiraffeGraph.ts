import { StateGraph, START, END } from "@langchain/langgraph";
import { getConfig } from "../config/loader.js";
import { GiraffeAnnotation } from "./state.js";
import { plannerNode } from "./nodes/planner.js";
import { routerNode, routeDecision } from "./nodes/router.js";
import { handoffNode } from "./nodes/handoff.js";
import { makeAgentNode } from "./agentNodeFactory.js";
import type { GiraffeState } from "./state.js";

async function prepareBabyGiraffeNode(
  state: GiraffeState
): Promise<Partial<GiraffeState>> {
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
  const agentKeys = Object.keys(getConfig().agents);
  const subgraph = new StateGraph(GiraffeAnnotation) as any;

  subgraph
    .addNode("bg_prepare", prepareBabyGiraffeNode)
    .addNode("bg_planner", plannerNode)
    .addNode("bg_router", routerNode)
    .addNode("bg_handoff", handoffNode)
    .addEdge(START, "bg_prepare")
    .addEdge("bg_prepare", "bg_planner")
    .addEdge("bg_planner", "bg_router")
    .addConditionalEdges("bg_router", routeDecision, {
      ...Object.fromEntries(agentKeys.map((agentKey) => [agentKey, agentKey])),
      baby_giraffe: END,
      done: END,
    })
    .addEdge("bg_handoff", "bg_router");

  for (const agentKey of agentKeys) {
    subgraph.addNode(agentKey, makeAgentNode(agentKey));
    subgraph.addEdge(agentKey, "bg_handoff");
  }

  return subgraph.compile();
}
