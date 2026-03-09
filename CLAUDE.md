# teamcast

TeamCast development team. TypeScript/Node.js CLI project.

## Agent Team

This project uses a multi-agent setup. Delegate tasks to the appropriate agent:

| Agent | When to use |
|-------|-------------|
| **orchestrator** | Use for any feature request, bug fix, or refactoring in the TeamCast project that involves planning + implementation + review. Entry point for the team pipeline. |
| **planner** | Use when a task requires deep codebase analysis before implementation. Reads src/ files, identifies patterns, and produces a step-by-step plan. Never modifies files. |
| **developer** | Use when a clear implementation plan is ready. Writes TypeScript code, runs vitest tests, and verifies CLI commands work. No internet access. |
| **reviewer** | Use after implementation is complete. Reviews TypeScript types, ESM imports, test coverage, pure function integrity, and CLI output style. Read-only, provides recommendations only. |

### Delegation rules (MANDATORY)

**ALWAYS delegate code tasks to subagents. NEVER write code, tests, or implementation directly in the main conversation.**

- Any task that involves writing/editing code, writing tests, or running tests → delegate to **orchestrator** (full pipeline) or **developer** (if plan is already clear).
- Any task that requires codebase analysis before implementation → delegate to **planner** first.
- After implementation is complete → delegate to **reviewer**.
- The main conversation should only: coordinate agents, communicate with the user, and make architectural decisions.
- The only exception: single-line trivial fixes (typos, renaming a variable in one place) — may be done directly.

## Security Boundaries

- Sandbox is **enabled**
- Blocked operations: Bash(rm -rf *), Bash(git push --force *), Bash(curl *), Bash(wget *), Write(.env*), Edit(.env*)
- Allowed shell commands: Bash(npm run *), Bash(npm test), Bash(npm test *), Bash(npx tsx *), Bash(npx vitest *), Bash(git status), Bash(git diff *), Bash(git add *), Bash(git commit *), Bash(git log *)

---

*Agent configuration managed by [TeamCast](https://github.com/teamcast/teamcast). Edit `teamcast.yaml` and run `teamcast generate` to update.*
