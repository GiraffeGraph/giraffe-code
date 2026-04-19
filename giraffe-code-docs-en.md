# 🦒 Giraffe Code — Project Documentation

> **Version:** 0.1.0-alpha
> **Date:** April 2026
> **Author:** Yahya Efe Kuruçay
> **Status:** Design Phase

---

## 1. Project Overview

**Giraffe Code** is a hierarchical multi-agent orchestration tool that coordinates multiple AI coding agents (Claude Code, Codex CLI, Pi, Gemini CLI, etc.) from a single terminal interface.

The user provides a single task. Giraffe Code analyzes it, decides which agents do what, runs them sequentially (parallel in future versions), and streams every agent's output **live** in one unified screen.

**The key difference:** other tools are tied to *one* agent. Giraffe Code is the **orchestrator of agents**.

---

## 2. Project Name & Hierarchy Metaphor

```
🦒 Giraffe (Root Orchestrator)
    └── 🦒 Baby Giraffe 1 (Sub-Orchestrator)
            ├── Claude Code  (Worker Agent)
            ├── Codex CLI    (Worker Agent)
            └── Pi           (Worker Agent)
    └── 🦒 Baby Giraffe 2 (Sub-Orchestrator)
            ├── Gemini CLI   (Worker Agent)
            └── Aider        (Worker Agent)
```

- **Giraffe (Root):** The main orchestrator. Receives the task, distributes it to Baby Giraffes or directly to Worker Agents.
- **Baby Giraffe:** A sub-orchestrator that manages its own agent chain for a specific sub-task.
- **Worker Agent:** The CLI tools that do the actual coding work (Claude Code, Codex, Pi, etc.).

---

## 3. User Experience (UX Flow)

```
User: "Add an auth system to this project, write tests, and document it"

┌──────────────────────────────────────────────────────────────┐
│  🦒 GIRAFFE CODE                            [Tab]  [Q: Quit] │
├─────────────────────┬────────────────────────────────────────┤
│  TASK PLAN          │  AGENT OUTPUT (Live)                   │
│                     │                                        │
│  ✅ 1. Claude Code  │  > Writing auth/index.ts...            │
│     Write auth code │  > Created: src/auth/index.ts          │
│                     │  > Created: src/auth/middleware.ts     │
│  ⏳ 2. Codex CLI    │  > Running tests...                    │
│     Write tests     │  ✓ All 12 tests passed                 │
│                     │                                        │
│  ⏸  3. Pi           │  [WAITING FOR HANDOFF...]             │
│     Write docs      │                                        │
├─────────────────────┴────────────────────────────────────────┤
│  STATUS: Claude Code running... (Step 1 of 3)               │
└──────────────────────────────────────────────────────────────┘
```

- **Left panel:** Task plan tree with agent statuses
- **Right panel:** Live PTY output stream of the active agent
- **Bottom bar:** Global status, handoff info, shortcuts

---

## 4. Technical Architecture

### 4.1 Layers

```
┌────────────────────────────────────────────────────┐
│                  TUI LAYER (Ink)                   │
│   AgentPanel | TaskTree | StatusBar | InputBox     │
└─────────────────────┬──────────────────────────────┘
                      │  React state / event emitter
┌─────────────────────▼──────────────────────────────┐
│         ORCHESTRATION LAYER (LangGraph JS)         │
│   GiraffeGraph | BabyGiraffeSubgraph               │
│   PlannerNode | RouterNode | HandoffNode           │
└─────────────────────┬──────────────────────────────┘
                      │  spawn + PTY
┌─────────────────────▼──────────────────────────────┐
│              AGENT LAYER (node-pty)                │
│   ClaudeAgent | CodexAgent | PiAgent | ...         │
│   Each: PTY process + stdout parser                │
└────────────────────────────────────────────────────┘
```

### 4.2 Technology Stack

| Layer            | Technology              | Notes                                       |
|------------------|-------------------------|---------------------------------------------|
| TUI              | Ink (React for CLI)     | React components rendered in the terminal   |
| Orchestration    | @langchain/langgraph    | StateGraph, Checkpointing, Subgraph support |
| PTY Management   | node-pty                | Each agent runs in its own PTY session      |
| Language         | TypeScript              | Entire project in one language              |
| Config           | YAML                    | Agent definitions, model selections        |
| Checkpoint Store | SQLite (in-memory)      | Crash recovery, session history             |

### 4.3 LangGraph State Definition

```typescript
import { StateGraph, StateSchema, ReducedValue, START, END } from "@langchain/langgraph";
import { z } from "zod";

const GiraffeState = new StateSchema({
  // Task
  task: z.string(),
  taskPlan: z.array(z.object({
    agent:       z.string(),
    instruction: z.string(),
    status:      z.enum(["pending", "running", "done", "failed"]),
  })),

  // Handoff mechanism
  handoffContext:   z.string().default(""),
  completedAgents:  z.array(z.string()).default([]),
  currentAgent:     z.string().optional(),

  // Live output streamed to TUI
  liveOutput: z.string().default(""),

  // Baby Giraffe sub-tasks
  babyGiraffes: z.array(z.object({
    id:      z.string(),
    subTask: z.string(),
    status:  z.enum(["pending", "running", "done"]),
  })).default([]),
});
```

### 4.4 Graph Structure

```typescript
const giraffeGraph = new StateGraph(GiraffeState)
  // Analyze incoming task, generate plan
  .addNode("planner", plannerNode)

  // Decide which agent runs next
  .addNode("router", routerNode)

  // Worker agent nodes (each opens a PTY session)
  .addNode("claude_agent", claudeAgentNode)
  .addNode("codex_agent",  codexAgentNode)
  .addNode("pi_agent",     piAgentNode)
  .addNode("gemini_agent", geminiAgentNode)

  // Handoff: parse completed agent's output,
  // prepare context for the next agent
  .addNode("handoff", handoffNode)

  // Baby Giraffe subgraph
  .addNode("baby_giraffe", babyGiraffeSubgraph)

  .addEdge(START, "planner")
  .addEdge("planner", "router")

  .addConditionalEdges("router", routeDecision, {
    claude:      "claude_agent",
    codex:       "codex_agent",
    pi:          "pi_agent",
    gemini:      "gemini_agent",
    baby:        "baby_giraffe",
    done:        END,
  })

  // Every agent goes to handoff when done
  .addEdge("claude_agent",  "handoff")
  .addEdge("codex_agent",   "handoff")
  .addEdge("pi_agent",      "handoff")
  .addEdge("gemini_agent",  "handoff")
  .addEdge("baby_giraffe",  "handoff")

  // After handoff, loop back to router (chain continues)
  .addEdge("handoff", "router")

  .compile({ checkpointer: sqliteCheckpointer });
```

---

## 5. Handoff Protocol

When an agent completes its task, it signals Giraffe using this structured format:

```
[GIRAFFE_HANDOFF]
COMPLETED: Auth system implemented, 3 files created
FILES: src/auth/index.ts, src/auth/middleware.ts, src/auth/types.ts
CONTEXT: JWT-based auth, bcrypt hashing, Express-compatible middleware
NEXT_HINT: Write tests for middleware edge cases, especially token expiry
[/GIRAFFE_HANDOFF]
```

Giraffe parses this block and forwards it to the next agent as:

```
Previous agent (Claude Code) completed the following:
- [COMPLETED and FILES info]
- [CONTEXT summary]

Your task: [next instruction]
Hint: [NEXT_HINT from previous agent]
```

Each agent's system prompt is injected with instructions on how to produce the handoff format when finishing.

---

## 6. PTY Agent Wrapper

Every worker agent extends the same abstract base class:

```typescript
import { IPty, spawn } from "node-pty";

abstract class AgentBase {
  protected pty: IPty;
  protected outputBuffer: string = "";

  // Start PTY session
  abstract spawn(): void;

  // Inject task into agent (writes to stdin)
  sendTask(task: string, handoffContext: string): void {
    const fullPrompt = handoffContext
      ? `Context:\n${handoffContext}\n\nTask:\n${task}`
      : task;
    this.pty.write(fullPrompt + "\r");
  }

  // Listen to output, detect handoff block
  onOutput(callback: (chunk: string) => void): void {
    this.pty.onData((data) => {
      this.outputBuffer += data;
      callback(data); // Stream to TUI live
      this.detectHandoff();
    });
  }

  private detectHandoff(): HandoffData | null {
    const match = this.outputBuffer.match(
      /\[GIRAFFE_HANDOFF\]([\s\S]*?)\[\/GIRAFFE_HANDOFF\]/
    );
    if (match) return parseHandoff(match[1]);
    return null;
  }
}

class ClaudeCodeAgent extends AgentBase {
  spawn() {
    this.pty = spawn("claude", [], { cols: 120, rows: 40 });
  }
}

class CodexAgent extends AgentBase {
  spawn() {
    this.pty = spawn("codex", [], { cols: 120, rows: 40 });
  }
}
```

---

## 7. Project Directory Structure

```
giraffe-code/
├── src/
│   ├── core/
│   │   ├── GiraffeGraph.ts          # Root LangGraph StateGraph
│   │   ├── BabyGiraffeGraph.ts      # Sub-graph definition
│   │   ├── nodes/
│   │   │   ├── planner.ts           # Generates task plan via LLM call
│   │   │   ├── router.ts            # Decides which agent runs next
│   │   │   └── handoff.ts           # Parses handoff + prepares context
│   │   └── state.ts                 # GiraffeState schema definition
│   ├── agents/
│   │   ├── AgentBase.ts             # Abstract PTY wrapper base class
│   │   ├── ClaudeCodeAgent.ts
│   │   ├── CodexAgent.ts
│   │   ├── PiAgent.ts
│   │   └── GeminiAgent.ts
│   ├── tui/
│   │   ├── App.tsx                  # Ink root component
│   │   ├── AgentPanel.tsx           # Live output panel
│   │   ├── TaskTree.tsx             # Task plan & statuses
│   │   ├── StatusBar.tsx            # Bottom status bar
│   │   └── InputBox.tsx             # User input field
│   └── index.ts                     # Entry point
├── config/
│   └── agents.yaml                  # Agent definitions and commands
├── package.json
├── tsconfig.json
└── README.md
```

---

## 8. Agent Configuration (agents.yaml)

```yaml
agents:
  claude:
    name: "Claude Code"
    command: "claude"
    args: []
    handoff_system_prompt: |
      When you finish your task, you MUST output this exact format:
      [GIRAFFE_HANDOFF]
      COMPLETED: <what you did>
      FILES: <created/modified files>
      CONTEXT: <important info for the next agent>
      NEXT_HINT: <suggestions for the next step>
      [/GIRAFFE_HANDOFF]
    strengths:
      - backend_code
      - architecture
      - refactoring

  codex:
    name: "Codex CLI"
    command: "codex"
    args: []
    handoff_system_prompt: |
      [same format as above...]
    strengths:
      - testing
      - code_completion
      - bug_fixing

  pi:
    name: "Pi"
    command: "pi"
    args: []
    strengths:
      - frontend
      - ui_components
      - styling

  gemini:
    name: "Gemini CLI"
    command: "gemini"
    args: []
    strengths:
      - documentation
      - summarization
      - large_codebase_analysis
```

---

## 9. Planner Node (LLM Call)

The planner analyzes the user's task and determines which agents run in which order:

```
Input:  "Add an auth system to this project, write tests, and document it"

Output (JSON plan):
[
  { "agent": "claude", "instruction": "Implement JWT-based auth system",         "order": 1 },
  { "agent": "codex",  "instruction": "Write unit and integration tests for auth","order": 2 },
  { "agent": "pi",     "instruction": "Document the auth API endpoints",          "order": 3 }
]
```

The planner uses a **small, fast model** (e.g. `gpt-4o-mini` or `claude-haiku`).
Heavy models are reserved for the actual worker agents that do the coding.

---

## 10. Router Node Logic

```typescript
function routeDecision(state: GiraffeState): string {
  const pendingStep = state.taskPlan.find(s => s.status === "pending");

  if (!pendingStep) return "done"; // All steps complete

  // Check if this step needs a Baby Giraffe (complex sub-task)
  if (pendingStep.requiresSubOrchestration) return "baby";

  return pendingStep.agent; // "claude" | "codex" | "pi" | "gemini"
}
```

The router can also fall back to a different agent if the preferred one fails:

```typescript
if (state.lastAgentFailed) {
  return getFallbackAgent(pendingStep.agent); // e.g. claude → codex
}
```

---

## 11. MVP Roadmap

### Phase 1 — Basic Skeleton (MVP)
- [ ] Single agent PTY wrapper (Claude Code only)
- [ ] Ink TUI with live output streaming
- [ ] Handoff protocol (parse + inject)
- [ ] Manual agent ordering (read from config, no planner yet)

### Phase 2 — Full Orchestration
- [ ] LangGraph StateGraph integration
- [ ] Router node with conditional edges
- [ ] All agent wrappers (Codex, Pi, Gemini)
- [ ] Task tree visualization in TUI

### Phase 3 — Smart Planner
- [ ] LLM-based planner node
- [ ] Strength-based routing from agents.yaml
- [ ] Fallback agent selection on failure

### Phase 4 — Baby Giraffe
- [ ] Sub-orchestrator (BabyGiraffeSubgraph)
- [ ] Parallel Baby Giraffe execution
- [ ] Split-panel TUI for multiple active agents

### Phase 5 — Polish & Distribution
- [ ] LangSmith integration (debug / tracing)
- [ ] Session history via SQLite checkpointer
- [ ] Configuration UI
- [ ] Publish as npm package

---

## 12. Dependencies

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.3.x",
    "@langchain/core": "^0.3.x",
    "ink": "^5.x",
    "react": "^18.x",
    "node-pty": "^1.x",
    "js-yaml": "^4.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "^18.x",
    "@types/node": "^20.x",
    "tsx": "^4.x"
  }
}
```

---

## 13. CLI Usage

```bash
# Install globally
npm install -g giraffe-code

# Run with a task
giraffe "Add an auth system, write tests, and document it"

# Specify a custom config
giraffe --config ./giraffe.yaml "Refactor the database layer"

# Force a specific agent chain
giraffe --chain claude,codex,pi "Build the payment module"

# Interactive mode (no task, opens TUI prompt)
giraffe
```

---

## 14. Design Principles

1. **Lightweight first.** Zero bloat. Every dependency must earn its place.
2. **Don't break the PTY.** Agents' own TUIs must not be corrupted. Giraffe only watches output and writes to stdin.
3. **Handoff is the standard.** All agents speak the same handoff format. Adding a new agent takes 5 minutes.
4. **Parallel-ready, sequential first.** LangGraph architecture supports parallelism; MVP runs sequentially.
5. **Human always in the loop.** If Giraffe makes a wrong decision, the user must be able to intervene at any step.
6. **Config over code.** Agent definitions, routing priorities, and model selections live in `agents.yaml`, not hardcoded.

---

## 15. Key Technical Decisions & Rationale

| Decision | Why |
|---|---|
| TypeScript (not Python) | Single language for TUI + orchestration + agents |
| LangGraph JS | Native checkpointing, subgraph support, conditional edges — avoids writing state machine from scratch |
| Ink (not Textual/blessed) | React model makes TUI components declarative and easy to reason about |
| node-pty (not child_process) | Full PTY emulation preserves agent TUI colors, cursor, and interactive behavior |
| YAML config | Agent definitions must be user-editable without touching source code |
| Sequential MVP | Parallel is complex to debug; sequential proves the handoff protocol first |

---

*This document is the living specification of the project. It should be updated as each phase is completed.*
