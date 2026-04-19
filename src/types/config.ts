import { z } from "zod";

export const AgentConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  handoff_system_prompt: z.string(),
  strengths: z.array(z.string()).default([]),
  fallback: z.string().optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const PlannerConfigSchema = z.object({
  provider: z.string().default(""),
  model: z.string().default(""),
});

export type PlannerConfig = z.infer<typeof PlannerConfigSchema>;

export const AgentsFileSchema = z.object({
  planner: PlannerConfigSchema.optional(),
  agents: z.record(z.string(), AgentConfigSchema),
});

export type AgentsFile = z.infer<typeof AgentsFileSchema>;

export const TaskStepSchema = z.object({
  agent: z.string(),
  instruction: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
  requiresSubOrchestration: z.boolean().default(false),
  retried: z.boolean().default(false),
});

export type TaskStep = z.infer<typeof TaskStepSchema>;

export const HandoffDataSchema = z.object({
  completed: z.string(),
  files: z.array(z.string()),
  context: z.string(),
  nextHint: z.string(),
});

export type HandoffData = z.infer<typeof HandoffDataSchema>;
