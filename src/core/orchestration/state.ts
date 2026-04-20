import { Annotation } from "@langchain/langgraph";
import type { HandoffData, TaskStep } from "../../types/config.js";

export type BabyGiraffeEntry = {
  id: string;
  subTask: string;
  status: "pending" | "running" | "done";
};

export type AgentOutcome = HandoffData & {
  agent: string;
  status: "done" | "failed";
};

export const GiraffeAnnotation = Annotation.Root({
  task: Annotation<string>({
    reducer: (_prev: string, next: string) => next,
    default: () => "",
  }),
  sessionId: Annotation<string | undefined>({
    reducer: (_prev: string | undefined, next: string | undefined) => next,
    default: () => undefined,
  }),
  executionMode: Annotation<"orchestrate" | "delegate">({
    reducer: (_prev: "orchestrate" | "delegate", next: "orchestrate" | "delegate") => next,
    default: () => "orchestrate",
  }),
  taskPlan: Annotation<TaskStep[]>({
    reducer: (_prev: TaskStep[], next: TaskStep[]) => next,
    default: () => [],
  }),
  handoffContext: Annotation<string>({
    reducer: (_prev: string, next: string) => next,
    default: () => "",
  }),
  completedAgents: Annotation<string[]>({
    reducer: (prev: string[], next: string[]) => [...prev, ...next],
    default: () => [],
  }),
  agentOutcomes: Annotation<AgentOutcome[]>({
    reducer: (prev: AgentOutcome[], next: AgentOutcome[]) => [...prev, ...next],
    default: () => [],
  }),
  currentAgent: Annotation<string | undefined>({
    reducer: (_prev: string | undefined, next: string | undefined) => next,
    default: () => undefined,
  }),
  liveOutput: Annotation<string>({
    reducer: (_prev: string, next: string) => next,
    default: () => "",
  }),
  lastAgentFailed: Annotation<boolean>({
    reducer: (_prev: boolean, next: boolean) => next,
    default: () => false,
  }),
  babyGiraffes: Annotation<BabyGiraffeEntry[]>({
    reducer: (_prev: BabyGiraffeEntry[], next: BabyGiraffeEntry[]) => next,
    default: () => [],
  }),
  error: Annotation<string | undefined>({
    reducer: (_prev: string | undefined, next: string | undefined) => next,
    default: () => undefined,
  }),
});

export type GiraffeState = typeof GiraffeAnnotation.State;
