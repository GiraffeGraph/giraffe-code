import { eventBus } from "../../core/runtime/eventBus.js";
import { runGraph } from "../../core/orchestration/GiraffeGraph.js";
import { runChatReply, runDelegateTask, runResumeTask } from "../../core/runtime/runModes.js";
import {
  beginRun,
  createChatSeedPlan,
  createDelegateSeedPlan,
  type RunSetters,
} from "./controllerShared.js";

function emitRunResult(promise: Promise<unknown>): void {
  promise
    .then(() => { eventBus.emit("done"); })
    .catch((err: Error) => { eventBus.emit("error", err.message); });
}

interface RunActionDeps {
  runSetters: RunSetters;
}

export function createRunActions({ runSetters }: RunActionDeps) {
  const startGraph = (taskToRun: string): void => {
    beginRun(runSetters, "Analyzing task...");
    emitRunResult(runGraph(taskToRun));
  };

  const startDelegate = (agentKey: string, taskToRun: string): void => {
    beginRun(
      runSetters,
      `Delegating directly to ${agentKey}...`,
      createDelegateSeedPlan(agentKey, taskToRun)
    );
    runSetters.setCurrentAgent(agentKey);
    emitRunResult(runDelegateTask(agentKey, taskToRun));
  };

  const startChat = (message: string): void => {
    beginRun(runSetters, "Giraffe is thinking...", createChatSeedPlan(message));
    runSetters.setCurrentAgent("giraffe");
    runSetters.setStepInfo("Reply mode");

    runChatReply(message)
      .then((reply) => {
        eventBus.emit("output", `\n🦒 ${reply}\n`);
        runSetters.setTaskPlan([{ ...createChatSeedPlan(message)[0]!, status: "done" }]);
        runSetters.setStatus("Giraffe replied. Press Enter for a new task.");
        runSetters.setCurrentAgent("—");
        runSetters.setIsBusy(false);
      })
      .catch((err: Error) => { eventBus.emit("error", err.message); });
  };

  const startResume = (): void => {
    beginRun(runSetters, "Resuming from latest .giraffe handoff...");
    emitRunResult(runResumeTask());
  };

  return {
    startGraph,
    startDelegate,
    startChat,
    startResume,
  };
}
