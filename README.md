# AgentForge

CLI to design, generate, and validate Claude Code agent teams from a single manifest.

Define your entire agent team in one `agentforge.yaml` file — AgentForge generates all the Claude Code config files, validates the team for conflicts and security issues, and keeps everything in sync.

## Install

```bash
npm install -g agentforge
```

Or run without installing:

```bash
npx agentforge <command>
```

## Quick start

```bash
# Initialize a new agent team (interactive wizard)
agentforge init

# Or use a preset directly
agentforge init --preset feature-team

# Generate Claude Code config files
agentforge generate

# Validate the team configuration
agentforge validate
```

After `generate`, your project will have:
- `.claude/agents/<name>.md` — one file per agent
- `.claude/settings.json` — permissions and sandbox config
- `CLAUDE.md` — team documentation for Claude Code
- `AGENTS.md` — universal AI agent documentation

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize agent team configuration (interactive wizard) |
| `generate` | Generate Claude Code config files from `agentforge.yaml` |
| `validate` | Check for conflicts, bad handoffs, and security issues |
| `explain` | Show a human-readable view of the agent team architecture |
| `diff` | Preview what would change if you ran `generate` |
| `add agent <name>` | Add a new agent to the team |
| `remove agent <name>` | Remove an agent from the team |

### Options

```bash
agentforge init --preset <name>   # skip wizard, use a preset
agentforge init --yes             # accept all defaults
agentforge generate --dry-run     # preview without writing files
agentforge validate --strict      # exit with error on warnings too
```

## Presets

| Preset | Description |
|--------|-------------|
| `feature-team` | orchestrator → planner → developer → reviewer |
| `solo-dev` | Single developer agent with full tool access |
| `research-and-build` | Researcher (web access) → planner → developer |
| `secure-dev` | Adds a dedicated security-auditor to the feature team |

## Configuration

Everything is defined in `agentforge.yaml` at the root of your project.

### Minimal example

```yaml
version: "1"
project:
  name: my-project

agents:
  developer:
    description: Implements features and fixes bugs
    model: sonnet
    tools:
      allow: [Read, Write, Edit, Bash, Grep, Glob]
```

### Full example

```yaml
version: "1"
project:
  name: my-project
  description: TypeScript/Node.js web app

agents:
  orchestrator:
    description: Coordinates the team and delegates tasks
    model: opus
    tools:
      allow: [Read, Grep, Glob, Task]
      deny: [Edit, Write, Bash]
    handoffs: [planner, developer, reviewer]
    max_turns: 30

  planner:
    description: Analyzes codebase and produces implementation plans
    model: sonnet
    tools:
      allow: [Read, Grep, Glob, WebFetch, WebSearch]
      deny: [Edit, Write, Bash]

  developer:
    description: Implements features based on the plan
    model: sonnet
    tools:
      allow: [Read, Write, Edit, Bash, Grep, Glob]
      deny: [WebFetch, WebSearch]

  reviewer:
    description: Reviews code for quality and security issues
    model: sonnet
    tools:
      allow: [Read, Grep, Glob, Bash]
      deny: [Edit, Write]

policies:
  permissions:
    allow:
      - "Bash(npm run *)"
      - "Bash(npm test)"
      - "Bash(git status)"
      - "Bash(git diff *)"
      - "Bash(git commit *)"
    deny:
      - "Bash(rm -rf *)"
      - "Bash(git push --force *)"
      - "Write(.env*)"
  sandbox:
    enabled: true

settings:
  default_model: sonnet
```

### Agent fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | **Required.** Shown in Claude Code agent picker |
| `model` | `opus` \| `sonnet` \| `haiku` \| `inherit` | Model to use (default: `inherit`) |
| `tools.allow` | string[] | Tools the agent can use |
| `tools.deny` | string[] | Tools the agent cannot use |
| `handoffs` | string[] | Other agents this agent can delegate to (requires `Task` in allow) |
| `skills` | string[] | Skill stubs to generate in `.claude/skills/` |
| `max_turns` | number | Maximum agentic turns |
| `behavior` | string | Freeform behavior instructions injected into the agent file |

**Available tools:** `Read`, `Write`, `Edit`, `MultiEdit`, `Grep`, `Glob`, `Bash`, `WebFetch`, `WebSearch`, `Task`

### Policy fields

```yaml
policies:
  permissions:
    allow: ["Bash(npm run *)", "WebFetch(api.example.com:*)"]
    ask:   ["Bash(git push *)"]
    deny:  ["Bash(rm -rf *)", "Write(.env*)"]
  sandbox:
    enabled: true
    auto_allow_bash: true
```

## Validation

`agentforge validate` runs four checks:

- **Handoff graph** — all handoff targets exist, no cycles, `Task` tool present where needed
- **Tool conflicts** — no tool in both allow and deny for the same agent
- **Role warnings** — orchestrators without write access, developers without internet, etc.
- **Security baseline** — `.env` protection, sandbox enabled, no dangerous permission bypasses

## License

MIT
