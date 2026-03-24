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

## Workflow

Classify every task by complexity before choosing a mode:

| Level | Examples | Mode |
|-------|----------|------|
| META | explain code, git operations, answer question | Handle directly |
| MICRO | typo, rename, 1-2 line fix | Handle directly |
| SMALL | bug fix, single module, <50 lines | Delegate to **developer** |
| MEDIUM | new feature, refactor, 2-5 files | Delegate to **orchestrator** |
| LARGE | new subsystem, cross-cutting concern, 5+ files | Supervised coordination |
| CRITICAL | security change, breaking API, data migration | Supervised + user confirmation at each step |

### Supervised mode (LARGE / CRITICAL)

Do NOT delegate to **orchestrator**. Personally coordinate the chain:
1. Delegate to **planner** — present result to user
2. Delegate to **developer** — present result to user
3. Delegate to **reviewer** — present result, decide next step

## Security Boundaries

- Sandbox is **enabled**
- Blocked operations: Bash(rm -rf *), Bash(git push --force *), Bash(curl *), Bash(wget *), Write(.env*), Edit(.env*)
- Allowed shell commands: Bash(git status), Bash(git diff *), Bash(git add *), Bash(git commit *), Bash(npm run *), Bash(npm test *), Bash(npx *), Bash(npm install), Bash(node *)

---

*Agent configuration managed by [TeamCast](https://github.com/Katoshy/teamcast). Edit `teamcast.yaml` and run `teamcast generate` to update.*
