# Giraffe Code Architecture

## Intent

Giraffe Code is a **thin orchestration layer** for external coding CLIs.

It is **not** trying to replace workers like:

- Claude Code
- Codex
- OpenCode
- Pi
- Gemini

Instead, Giraffe is responsible for:

1. accepting user intent
2. selecting interaction mode
3. orchestrating worker execution
4. carrying handoff/session context across workers
5. exposing a small terminal UI for control and observability

This keeps the product aligned with its core principle:

> Giraffe orchestrates workers. Workers do the actual coding.

---

## Current folder strategy

```text
src/
├── agents/                 # Worker process adapters / transport behavior
├── auth/                   # Provider login, token refresh, storage
├── config/                 # Static + user config loading
├── core/
│   ├── handoff/            # Handoff parsing / normalization helpers
│   ├── orchestration/      # Graph, state, planner/router/handoff nodes
│   └── runtime/            # Sessions, native/headless execution, event bus
├── doctor/                 # Health checks and diagnostics
├── providers/              # Planner / reply model provider adapters
├── tui/
│   ├── components/         # Reusable Ink UI building blocks
│   ├── controllers/        # TUI state, command routing, run actions, hooks
│   └── screens/            # Screen-level Ink views
└── types/                  # Shared zod schemas and TS types
```

---

## Architectural slices

### 1. Worker integration slice

**Folders:** `src/agents`, `config/agents.yaml`

Purpose:
- define how Giraffe launches and observes external worker CLIs
- keep workers config-driven instead of hardcoded

Key idea:
- normal worker onboarding should be mostly a config change

### 2. Orchestration slice

**Folders:** `src/core/orchestration`

Purpose:
- build the multi-step execution graph
- route work between workers
- parse handoffs
- summarize the run back to the user

Key idea:
- orchestration logic is separate from presentation

### 3. Runtime/session slice

**Folders:** `src/core/runtime`, project-local `.giraffe/`

Purpose:
- session logs
- latest handoff persistence
- local workspace continuity
- headless/native mode helpers

Key idea:
- runtime state belongs to the project via `.giraffe/`, not only the machine user profile

### 4. TUI slice

**Folders:** `src/tui/components`, `src/tui/controllers`, `src/tui/screens`

Purpose:
- render terminal UI
- isolate command handling from rendering
- isolate event-bus syncing from rendering
- keep screens presentational where possible

Key idea:
- `screens` render
- `controllers` coordinate
- `components` compose reusable UI blocks

### 5. Handoff slice

**Folders:** `src/core/handoff`

Purpose:
- parse worker handoff blocks
- normalize handoff payloads passed across workers

Key idea:
- handoff concerns remain small and explicit instead of being mixed through orchestration/runtime code

### 6. Infrastructure slice

**Folders:** `src/auth`, `src/providers`, `src/config`, `src/doctor`

Purpose:
- provider auth
- planner/reply API access
- configuration loading
- diagnostics

Key idea:
- external system integrations stay outside the orchestration core

---

## TUI design after refactor

```text
src/tui/
├── components/
│   ├── AgentPanel.tsx
│   ├── GiraffeHeader.tsx
│   ├── InputBox.tsx
│   ├── StatusBar.tsx
│   ├── TaskTree.tsx
│   └── WorkspacePanel.tsx
├── controllers/
│   ├── controllerShared.ts
│   ├── createCommandHandler.ts
│   ├── createRunActions.ts
│   ├── useAppController.ts
│   ├── useAppEvents.ts
│   ├── useAppShortcuts.ts
│   └── useWorkspaceSnapshot.ts
└── screens/
    ├── App.tsx
    ├── AppScreens.tsx
    ├── DoctorScreen.tsx
    ├── LoginSelector.tsx
    ├── LogoutSelector.tsx
    ├── ModelSelector.tsx
    ├── NativeLauncher.tsx
    └── StatusScreen.tsx
```

### TUI layering rules

- `screens/` can compose `components/`
- `screens/` can use `controllers/`
- `components/` should remain presentation-first
- `controllers/` may depend on `core/`, `config/`, and `auth/`
- `components/` should not own orchestration decisions

---

## Current strengths

1. **Worker-first architecture**
   - external CLIs remain primary executors
   - Giraffe stays thin

2. **Config-driven worker graph**
   - scales better than one-class-per-agent orchestration wiring

3. **Project-local runtime memory**
   - `.giraffe/` gives resumability and handoff continuity

4. **TUI concerns are split more clearly now**
   - rendering, commands, events, shortcuts, workspace snapshots are separated

---

## Deliberate non-goals

These are intentionally *not* current goals:

- building a full IDE inside Giraffe
- replacing native worker UIs
- tightly coupling to one vendor or one model provider
- recreating Claude Code internals 1:1

We can take inspiration from large CLI architecture, but Giraffe should remain much smaller and more focused.

---

## Next evolution path

### Phase 1 — done / in progress
- TUI split into `components`, `controllers`, `screens`
- command routing separated
- run actions separated
- event syncing separated
- workspace snapshots separated

### Phase 2 — done
- split `src/core` into clearer sub-domains:
  - `core/orchestration/`
  - `core/runtime/`
  - `core/handoff/`
- preserved behavior while improving navigability

### Phase 3 — optional
- add a lightweight plugin/extension surface for worker packs or orchestration strategies
- add migration/version helpers for `.giraffe/` state evolution

---

## Decision principles

When changing architecture, prefer:

1. **thinner orchestration over heavier abstraction**
2. **config over hardcoded worker wiring**
3. **project-local runtime state over hidden global state**
4. **presentation-only UI components where possible**
5. **small refactors with preserved behavior over big rewrites**

This keeps the codebase scalable without losing the product’s core identity.
