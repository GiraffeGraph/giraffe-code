import { StateGraph, START, END } from "@langchain/langgraph";
import { GiraffeAnnotation } from "./state.js";
import { plannerNode } from "./nodes/planner.js";
import { routerNode, routeDecision } from "./nodes/router.js";
import { handoffNode } from "./nodes/handoff.js";
import { makeAgentNode } from "./agentNodeFactory.js";
import { buildBabyGiraffeGraph } from "./BabyGiraffeGraph.js";
import { eventBus } from "./eventBus.js";
import { summarizeRun } from "./giraffeReply.js";
import {
  appendSessionEvent,
  createWorkspaceSession,
  writeWorkspaceHandoff,
  type WorkspaceMode,
} from "./workspaceRuntime.js";
import type { GiraffeState } from "./state.js";
import type { TaskStep } from "../types/config.js";

export interface RunGraphOptions {
  initialPlan?: TaskStep[];
  initialHandoffContext?: string;
  mode?: Extract<WorkspaceMode, "orchestrate" | "delegate">;
}

export function buildGiraffeGraph() {
  const babyGiraffe = buildBabyGiraffeGraph();

  const graph = new StateGraph(GiraffeAnnotation)
    .addNode("planner", plannerNode)
    .addNode("router", routerNode)
    .addNode("claude", makeAgentNode("claude"))
    .addNode("codex", makeAgentNode("codex"))
    .addNode("pi", makeAgentNode("pi"))
    .addNode("gemini", makeAgentNode("gemini"))
    .addNode("baby_giraffe", babyGiraffe)
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
    .addEdge("claude", "handoff")
    .addEdge("codex", "handoff")
    .addEdge("pi", "handoff")
    .addEdge("gemini", "handoff")
    .addEdge("baby_giraffe", "handoff")
    .addEdge("handoff", "router");

  return graph.compile();
}

export async function runGraph(
  task: string,
  options: RunGraphOptions = {}
): Promise<GiraffeState> {
  const graph = buildGiraffeGraph();
  const mode = options.mode ?? "orchestrate";
  const session = createWorkspaceSession({ mode, task });

  const onOutput = (chunk: string): void => {
    appendSessionEvent(session.sessionId, "ui.output", {
      chunk: chunk.length > 4000 ? chunk.slice(-4000) : chunk,
    });
  };

  const onState = (state: Partial<GiraffeState>): void => {
    const payload: Record<string, unknown> = {};

    if (state.currentAgent) payload["currentAgent"] = state.currentAgent;
    if (state.taskPlan) {
      payload["taskPlan"] = state.taskPlan.map((step) => ({
        agent: step.agent,
        status: step.status,
        retried: step.retried,
      }));
    }
    if (state.agentOutcomes?.length) {
      payload["agentOutcomes"] = state.agentOutcomes.map((item) => ({
        agent: item.agent,
        status: item.status,
        completed: item.completed,
        files: item.files,
      }));
    }

    appendSessionEvent(session.sessionId, "state.update", payload);
  };

  eventBus.on("output", onOutput);
  eventBus.on("stateUpdate", onState);

  const initialState: Partial<GiraffeState> = {
    task,
    sessionId: session.sessionId,
    executionMode: mode,
    taskPlan: options.initialPlan ?? [],
    handoffContext: options.initialHandoffContext ?? "",
    completedAgents: [],
    agentOutcomes: [],
    currentAgent: undefined,
    liveOutput: "",
    lastAgentFailed: false,
    babyGiraffes: [],
    error: undefined,
  };

  try {
    const finalState = await graph.invoke(initialState, {
      recursionLimit: 200,
    });

    const summary = await summarizeRun(task, finalState);
    appendSessionEvent(session.sessionId, "run.summary", { summary });

    writeWorkspaceHandoff({
      sessionId: session.sessionId,
      mode,
      task,
      summary,
      agents: finalState.agentOutcomes,
      generatedAt: new Date().toISOString(),
    });

    appendSessionEvent(session.sessionId, "session.finished", {
      status: finalState.taskPlan.some((step) => step.status === "failed") ? "partial" : "done",
      completedAgents: finalState.completedAgents,
    });

    eventBus.emit("output", `\n🦒 Giraffe:\n${summary}\n`);
    return finalState;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendSessionEvent(session.sessionId, "session.finished", {
      status: "error",
      error: message,
    });
    eventBus.emit("error", message);
    throw err;
  } finally {
    eventBus.off("output", onOutput);
    eventBus.off("stateUpdate", onState);
  }
}
