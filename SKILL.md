---
name: mandordantukangv3
description: Use when orchestrating one planner/reviewer agent plus ui/coder/sec worker agents across Orca IDE panes via orca-bridge.
---

# Mandor dan Tukang v3 (Multi-Agent Squad Architecture)

Deterministic multi-agent orchestration for AI pair programming across Orca IDE terminal panes via `orca-bridge`. A frontier-model Mandor plans and reviews while fast/deep-reasoning worker agents execute in parallel within strict allowlists.

## Roster by Tier

1. **Mandor (Pane 1, Frontier Model)**:
   - Lead architect, system planner, and final review gate.
   - Minimal direct execution: plans architecture, writes dense English specs, audits diffs, and enforces quality gates.
2. **Tukang UI (Pane 2, Fast Model)**:
   - UI/UX implementation, component styling, responsive layouts, WCAG AA accessibility, and visual QA screenshots.
3. **Tukang Coder (Pane 3, Fast Model)**:
   - Core business logic, backend APIs, data plumbing, database migrations, minimal diffs, and release packaging.
4. **Tukang Security & QA (Pane 4, Deep-Reasoning Model)**:
   - 7-point OWASP security core, vulnerability auditing, test suite execution, and regression prevention.

## Strict Anti-Handoff-Leak Contract

- **Explicit File Allowlist**: Workers touch only files listed in `allowed_files`. Out-of-scope edits or exploration attempts are blocked.
- **Single Verification Command**: Mandor provides a deterministic check command (`verification_command`). The bridge runs it before handoff and gate approval.
- **Mandor-Only Review Gate**: Workers never self-approve. Mandor reviews evidence and diffs before running `task approve`.
- **Max 1 Retry**: A failed task gets at most one targeted rejection before Mandor takes over.

## Configuration and Rules Paths

- Skill installation directory: default `~/.agents/skills/mandordantukangv3` (override with `MANDOR_HOME`).
- Rules files: `$MANDOR_HOME/rules/{common,mandor,tukang-ui,tukang-coder,tukang-sec}.md`.
- Personal profile: `$MANDOR_HOME/profile.local.md` (template at `profile.example.md`, gitignored).
- State directory: `${XDG_STATE_HOME:-~/.local/state}/mandordantukangv3` (override with `MANDOR_STATE_DIR`).

## Quick Commands

```bash
# Launch 2x2 grid squad in Orca IDE
orca-squad [project_dir]

# Check squad connection and active task status
orca-bridge status

# Delegate structured task to a worker
orca-bridge delegate --to <ui|coder|sec> --spec task.json

# Report task completion (run by worker)
orca-bridge report DONE --task <id> "1-line summary | skills: <applied skills>"

# Review and gate task (run by Mandor)
orca-bridge task approve <id>
orca-bridge task reject <id> "<targeted 1-line English fix>"

# Token usage and ledger reporting
orca-bridge usage report
orca-bridge scorecard 1
```
