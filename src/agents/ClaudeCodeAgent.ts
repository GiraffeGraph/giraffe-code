import { AgentBase } from "./AgentBase.js";

export class ClaudeCodeAgent extends AgentBase {
  readonly agentKey = "claude" as const;
}
