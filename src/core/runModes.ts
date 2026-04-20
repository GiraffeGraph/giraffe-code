import { TaskStepSchema } from "../types/config.js";
import { askGiraffe } from "./giraffeReply.js";
import { runGraph } from "./GiraffeGraph.js";
import {
  appendSessionEvent,
  createWorkspaceSession,
  formatLatestHandoffForAgent,
  writeWorkspaceHandoff,
} from "./workspaceRuntime.js";

export async function runDelegateTask(agentKey: string, task: string) {
  const initialPlan = [
    TaskStepSchema.parse({
      agent: agentKey,
      instruction: task,
      status: "pending",
      requiresSubOrchestration: false,
      retried: false,
    }),
  ];

  return runGraph(task, {
    initialPlan,
    initialHandoffContext: formatLatestHandoffForAgent(),
    mode: "delegate",
  });
}

export async function runChatReply(question: string): Promise<string> {
  const session = createWorkspaceSession({ mode: "chat", task: question });
  appendSessionEvent(session.sessionId, "chat.request", { question });

  try {
    const reply = await askGiraffe(question);
    appendSessionEvent(session.sessionId, "chat.reply", { reply });
    appendSessionEvent(session.sessionId, "session.finished", { status: "done" });

    writeWorkspaceHandoff({
      sessionId: session.sessionId,
      mode: "chat",
      task: question,
      summary: reply,
      agents: [],
      generatedAt: new Date().toISOString(),
    });

    return reply;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendSessionEvent(session.sessionId, "session.finished", {
      status: "error",
      error: message,
    });
    throw err;
  }
}
