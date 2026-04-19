import { eventBus } from "./eventBus.js";
import { runGraph } from "./GiraffeGraph.js";
import type { TaskStep } from "../types/config.js";

function printPlan(plan: TaskStep[]): void {
  process.stdout.write("\n🧠 Generated plan:\n");
  plan.forEach((step, i) => {
    const text =
      step.instruction.length > 120
        ? `${step.instruction.slice(0, 120)}…`
        : step.instruction;
    process.stdout.write(`  ${i + 1}. ${step.agent} — ${text}\n`);
  });
  process.stdout.write("\n");
}

export async function runHeadlessTask(task: string): Promise<number> {
  let planPrinted = false;
  let currentAgent = "";

  const onOutput = (chunk: string): void => {
    process.stdout.write(chunk);
  };

  const onStateUpdate = (state: unknown): void => {
    if (!state || typeof state !== "object") return;

    const s = state as Record<string, unknown>;

    if (!planPrinted && Array.isArray(s["taskPlan"])) {
      const plan = s["taskPlan"] as TaskStep[];
      if (plan.length > 0) {
        printPlan(plan);
        planPrinted = true;
      }
    }

    if (typeof s["currentAgent"] === "string") {
      const next = s["currentAgent"];
      if (next && next !== currentAgent) {
        currentAgent = next;
        process.stdout.write(`\n▶ Running agent: ${currentAgent}\n`);
      }
    }
  };

  const onError = (message: string): void => {
    process.stderr.write(`\n❌ ${message}\n`);
  };

  eventBus.on("output", onOutput);
  eventBus.on("stateUpdate", onStateUpdate);
  eventBus.on("error", onError);

  try {
    process.stdout.write("\n🦒 Giraffe headless mode started\n");
    await runGraph(task);
    process.stdout.write("\n✅ Giraffe headless run completed\n");
    return 0;
  } catch {
    return 1;
  } finally {
    eventBus.off("output", onOutput);
    eventBus.off("stateUpdate", onStateUpdate);
    eventBus.off("error", onError);
  }
}
