import { StateGraph, START, END } from "@langchain/langgraph";
import { GiraffeAnnotation } from "./state.js";
import { plannerNode } from "./nodes/planner.js";
import { routerNode, routeDecision } from "./nodes/router.js";
import { handoffNode } from "./nodes/handoff.js";
import { makeAgentNode } from "./agentNodeFactory.js";
import { buildBabyGiraffeGraph } from "./BabyGiraffeGraph.js";
import { eventBus } from "./eventBus.js";
import type { GiraffeState } from "./state.js";

export function buildGiraffeGraph() {
  const babyGiraffe = buildBabyGiraffeGraph();

  const graph = new StateGraph(GiraffeAnnotation)
    // Analyze task and generate ordered agent plan
    .addNode("planner", plannerNode)

    // Passthrough node — routing happens on the conditional edge below
    .addNode("router", routerNode)

    // Worker agent nodes — each opens a PTY session
    .addNode("claude", makeAgentNode("claude"))
    .addNode("codex", makeAgentNode("codex"))
    .addNode("pi", makeAgentNode("pi"))
    .addNode("gemini", makeAgentNode("gemini"))

    // Sub-orchestrator for complex sub-tasks (Phase 4)
    .addNode("baby_giraffe", babyGiraffe)

    // Parse completed agent output, prepare context for next agent
    .addNode("handoff", handoffNode)

    .addEdge(START, "planner")
    .addEdge("planner", "router")

    .addConditionalEdges("router", routeDecision, {
      claude: "claude",
      codex: "codex",
      pi: "pi",
      gemini: "gemini",
      baby_giraffe: "baby_giraffe",
      done: END,
    })

    // Every worker routes through handoff when done
    .addEdge("claude", "handoff")
    .addEdge("codex", "handoff")
    .addEdge("pi", "handoff")
    .addEdge("gemini", "handoff")
    .addEdge("baby_giraffe", "handoff")

    // Loop: handoff → router → next agent (or done)
    .addEdge("handoff", "router");

  return graph.compile();
}

export async function runGraph(task: string): Promise<void> {
  const graph = buildGiraffeGraph();

  const initialState: Partial<GiraffeState> = {
    task,
    taskPlan: [],
    handoffContext: "",
    completedAgents: [],
    currentAgent: undefined,
    liveOutput: "",
    lastAgentFailed: false,
    babyGiraffes: [],
    error: undefined,
  };

  try {
    await graph.invoke(initialState, {
      // Default LangGraph recursion limit (25) is too low for multi-step
      // orchestration (router -> agent -> handoff loop). Increase it so
      // normal plans don't fail with false-positive recursion errors.
      recursionLimit: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    eventBus.emit("error", message);
    throw err;
  }
}
