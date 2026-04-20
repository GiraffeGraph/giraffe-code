import { TaskStepSchema } from "../../types/config.js";
import { askGiraffe } from "../orchestration/giraffeReply.js";
import { runGraph } from "../orchestration/GiraffeGraph.js";
import {
  appendSessionEvent,
  createWorkspaceSession,
  formatLatestHandoffForAgent,
  getLatestWorkspaceHandoff,
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

function buildResumeInstruction(task: string): string {
  return [
    "Resume the previous workspace task.",
    "Do not repeat already completed work unless it is necessary.",
    "Prefer the next unfinished step implied by the latest handoff.",
    "",
    `Original task: ${task}`,
  ].join("\n");
}

export async function runResumeTask() {
  const latest = getLatestWorkspaceHandoff();
  if (!latest?.task) {
    throw new Error("No resumable .giraffe handoff found yet.");
  }

  return runGraph(buildResumeInstruction(latest.task), {
    initialHandoffContext: formatLatestHandoffForAgent(),
    mode: "orchestrate",
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
