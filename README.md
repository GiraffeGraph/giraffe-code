# 🦒 Giraffe Code

Hierarchical multi-agent orchestration for AI coding tools. Give one task, get all your agents working in sequence — live-streamed in a single terminal.

```
┌──────────────────────────────────────────────────────────────┐
│  🦒 GIRAFFE CODE                            [Tab]  [Q: Quit] │
├─────────────────────┬────────────────────────────────────────┤
│  TASK PLAN          │  AGENT OUTPUT (Live)                   │
│                     │                                        │
│  ✅ 1. claude       │  > Writing auth/index.ts...            │
│     Write auth code │  > Created: src/auth/index.ts          │
│                     │  > Created: src/auth/middleware.ts     │
│  ⏳ 2. codex        │  > Running tests...                    │
│     Write tests     │  ✓ All 12 tests passed                 │
│                     │                                        │
│  ⏸  3. gemini       │  [WAITING FOR HANDOFF...]             │
│     Write docs      │                                        │
├─────────────────────┴────────────────────────────────────────┤
│  STATUS: codex running... (Step 2 of 3)       [Q: Quit]      │
└──────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### OS-level (macOS)

```bash
xcode-select --install   # Required for node-pty native compilation
```

### Agent CLIs

Install whichever agents you plan to use:

```bash
npm install -g @anthropic-ai/claude-code   # Claude Code
npm install -g @openai/codex               # Codex CLI
# pi: see https://pi.ai/cli
# gemini: see https://ai.google.dev/gemini-api/docs/cli
```

### Authentication

Use the built-in login flow (recommended):

```bash
giraffe login
```

You can still use environment variables if you prefer (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`).

---

## Setup

```bash
git clone <repo>
cd giraffe-code
npm install
```

`npm install` triggers `node-pty` native compilation automatically.

---

## Run

### With a task argument

```bash
npm run dev -- "Add an auth system, write tests, document it"
```

### Interactive mode (no task — opens input prompt)

```bash
npm run dev
```

### Dogfood mode (let Giraffe improve this repo)

```bash
giraffe improve
giraffe improve "focus on onboarding UX and docs"
```

### Headless mode (CI / non-TTY)

```bash
giraffe --headless "Refactor the database layer"
giraffe improve --headless "focus on planner reliability"
```

### With custom config

```bash
npm run dev -- --config ./my-agents.yaml "Refactor the database layer"
```

### Built binary

```bash
npm run build
node dist/index.js "Your task here"
```

### Global install

```bash
npm run build
npm link
giraffe "Your task here"
```

### Native handover mode (real agent UI, 1:1)

```bash
giraffe native
giraffe native claude "build a todo app"
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `q` | Quit |
| `Ctrl+C` | Force quit |

## Slash Commands (Interactive)

- `/login`
- `/logout`
- `/model`
- `/status`
- `/doctor`
- `/native` (or `/native <agent> <task>`)
- `/improve` (or `/improve <focus>`)


---

## Configuration — `config/agents.yaml`

This file is the single source of truth for all agent definitions. Edit it to add, remove, or reconfigure agents — no code changes needed.

```yaml
agents:
  claude:
    name: "Claude Code"
    command: "claude"
    args: []
    handoff_system_prompt: |
      When you complete your task, you MUST output EXACTLY this block...
    strengths:
      - backend_code
      - architecture
    fallback: codex   # Agent to use if this one fails
```

### Adding a New Agent

1. Add an entry to `config/agents.yaml` with the agent's CLI command and handoff prompt
2. Create `src/agents/MyAgent.ts`:
   ```typescript
   import { AgentBase } from "./AgentBase.js";
   export class MyAgent extends AgentBase {
     readonly agentKey = "myagent" as const;
   }
   ```
3. Register it in `src/core/agentNodeFactory.ts`:
   ```typescript
   import { MyAgent } from "../agents/MyAgent.js";
   const AGENT_REGISTRY = { ..., myagent: MyAgent };
   ```
4. Add it to the graph in `src/core/GiraffeGraph.ts`

---

## Handoff Protocol

When an agent finishes its task, it must output:

```
[GIRAFFE_HANDOFF]
COMPLETED: Auth system implemented, 3 files created
FILES: src/auth/index.ts, src/auth/middleware.ts, src/auth/types.ts
CONTEXT: JWT-based auth, bcrypt hashing, Express-compatible middleware
NEXT_HINT: Write tests for middleware edge cases, especially token expiry
[/GIRAFFE_HANDOFF]
```

Giraffe parses this block and forwards the context to the next agent automatically.

---

## Architecture

```
src/
├── core/
│   ├── GiraffeGraph.ts       # Root LangGraph StateGraph
│   ├── BabyGiraffeGraph.ts   # Sub-orchestrator subgraph (Phase 4)
│   ├── HandoffParser.ts      # Parses [GIRAFFE_HANDOFF] blocks
│   ├── eventBus.ts           # Typed EventEmitter3 for TUI↔graph comms
│   ├── state.ts              # LangGraph Annotation state definition
│   └── nodes/
│       ├── planner.ts        # LLM call → task plan
│       ├── router.ts         # Decides next agent
│       └── handoff.ts        # Parses output, prepares next context
├── agents/
│   ├── AgentBase.ts          # Abstract PTY wrapper
│   ├── ClaudeCodeAgent.ts
│   ├── CodexAgent.ts
│   ├── PiAgent.ts
│   └── GeminiAgent.ts
├── tui/
│   ├── App.tsx               # Root Ink component
│   ├── AgentPanel.tsx        # Live PTY output (right panel)
│   ├── TaskTree.tsx          # Task plan with status icons (left panel)
│   ├── StatusBar.tsx         # Bottom status bar
│   └── InputBox.tsx          # Interactive mode input
├── config/
│   └── loader.ts             # YAML config loader + validation
├── types/
│   └── config.ts             # Zod schemas and TypeScript types
└── index.ts                  # CLI entry point
```

---

## MVP Roadmap

- [x] Phase 1 — Basic Skeleton: PTY wrapper, Ink TUI, handoff protocol, config loading
- [x] Phase 2 — Full Orchestration: LangGraph StateGraph, all agents, task tree TUI
- [x] Phase 3 — Smart Planner: LLM-based planner, strength-based routing, fallback agent selection
- [ ] Phase 4 — Baby Giraffe: Sub-orchestrator subgraph, parallel execution, split-panel TUI
- [ ] Phase 5 — Polish: LangSmith tracing, SQLite session history, npm publish

---

## Design Principles

1. **Lightweight first.** Zero bloat — every dependency earns its place.
2. **Don't break the PTY.** Agent TUIs render intact; Giraffe only watches output and writes to stdin.
3. **Handoff is the standard.** All agents speak the same protocol. Adding a new agent takes 5 minutes.
4. **Config over code.** Agent definitions live in `agents.yaml`, not hardcoded.
5. **Human always in the loop.** Press `q` at any point to exit.
