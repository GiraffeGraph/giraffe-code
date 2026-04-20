# .giraffe

Project-local runtime state for Giraffe Code.

## Purpose

This directory is the codebase-scoped counterpart to `~/.giraffe`.

- `~/.giraffe` keeps user-level auth/config
- `.giraffe/` keeps repo-level sessions, handoffs, and mode defaults

## Layout

- `config.json` — local interactive defaults such as mode and default delegate agent
- `sessions/*.jsonl` — append-only run/session event logs
- `handoffs/latest.md` / `latest.json` — latest platform-agnostic handoff
- `handoffs/<session-id>.md|json` — per-session handoff snapshots

## Notes

- Session files are runtime artifacts.
- Handoffs are intentionally simple so different CLIs/TUIs can pick them up.
- The latest handoff is reused by manual `/delegate` flows to keep context moving between agents.
