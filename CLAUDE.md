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

### Preferred workflow

For complex tasks, start with **orchestrator**: `orchestrator -> planner -> developer -> reviewer`

For simple single-file changes, work directly without delegation.

## Security Boundaries

- Sandbox is **enabled**
- Blocked operations: Bash(rm -rf *), Bash(git push --force *), Bash(curl *), Bash(wget *), Write(.env*), Edit(.env*)
- Allowed shell commands: Bash(git status), Bash(git diff *), Bash(git add *), Bash(git commit *), Bash(git log), Bash(npm run *), Bash(npm test *), Bash(npx *), Bash(npm install), Bash(node *)

---

*Agent configuration managed by [TeamCast](https://github.com/Katoshy/teamcast). Edit `teamcast.yaml` and run `teamcast generate` to update.*
