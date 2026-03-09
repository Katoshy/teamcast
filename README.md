# TeamCast

CLI to design, generate, and validate Claude Code subagents from a single manifest.

Define your subagents in one `teamcast.yaml` file. TeamCast generates Claude Code config files, validates the configuration, and keeps generated output in sync with the manifest.

## Install

```bash
npm install -g teamcast
```

Or run without installing:

```bash
npx teamcast <command>
```

## Quick Start

```bash
# Initialize a new team with the interactive wizard
teamcast init

# Or skip the wizard and use a preset directly
teamcast init --preset feature-team

# Generate Claude Code config files from teamcast.yaml
teamcast generate

# Validate the manifest
teamcast validate
```

After `generate`, your project will have:
- `.claude/agents/<name>.md` - one file per agent
- `.claude/skills/<skill>/SKILL.md` - one stub file per unique skill
- `.claude/settings.json` - permissions and sandbox config
- `.claude/settings.local.json` - local Claude settings when enabled
- `CLAUDE.md` - team documentation for Claude Code
- `AGENTS.md` - universal AI agent documentation

## Native Claude Code Model

TeamCast now uses a canonical agent shape that separates:

- `agents.<name>.claude` - native Claude Code subagent runtime fields
- `agents.<name>.forge` - TeamCast-only metadata such as delegation graph

Legacy flat manifests are still accepted and normalized automatically, but new writes use the canonical shape.

## Command Summary

| Command | Description |
|---------|-------------|
| `init` | Initialize `teamcast.yaml` and generate files |
| `generate` | Generate Claude Code files from `teamcast.yaml` |
| `validate` | Validate the team configuration |
| `validate --format json` | Machine-readable validation output for CI pipelines |
| `explain` | Print a human-readable view of the team architecture |
| `diff` | Show what generated files would change |
| `add agent <name>` | Add a new agent |
| `edit agent <name>` | Edit an existing agent |
| `remove agent <name>` | Remove an agent and clean up handoffs |
| `create skill <name>` | Create a new skill and assign it to one agent |
| `assign skill <name>` | Assign an existing skill to more agents |
| `import` | Import an existing `.claude/` setup into `teamcast.yaml` |
| `reset` | Delete generated files, keep `teamcast.yaml` |
| `clean` | Delete generated files and `teamcast.yaml` |

Useful options:

```bash
teamcast init --preset <name>   # skip wizard and use a preset
teamcast init --from <path>     # initialize from an existing YAML file
teamcast init --yes             # non-interactive init, uses defaults
teamcast generate --dry-run     # preview generated files without writing
teamcast validate --strict      # fail on warnings as well as errors
teamcast validate --format json # JSON output, useful in CI scripts
teamcast import --yes           # skip import confirmation
teamcast reset --yes            # skip reset confirmation
teamcast clean --yes            # skip clean confirmation
```

## Presets

| Preset | Description |
|--------|-------------|
| `feature-team` | orchestrator -> planner -> developer -> reviewer |
| `solo-dev` | single developer agent with broad tool access |
| `research-and-build` | orchestrator -> researcher -> planner -> developer |
| `secure-dev` | orchestrator -> planner -> developer -> security-auditor -> reviewer |

The built-in preset files live in `templates/presets/` and are valid TeamCast YAML. Use them as a reference when creating custom presets, or copy one as a starting point:

```bash
cp node_modules/teamcast/templates/presets/feature-team.yaml ./my-team.yaml
teamcast init --from ./my-team.yaml
```

## Flows

### `init`

`teamcast init` creates a fresh `teamcast.yaml`, validates it, and generates all output files.

Interactive wizard flow:

1. `Project name:`
   - default is auto-detected from the current directory
   - must match lowercase letters, numbers, and hyphens
2. `How do you want to set up your agent team?`
   - `Use a preset`
   - `Custom team`
   - `Single agent`
3. If you choose `Use a preset`:
   - `Select a preset:`
4. If you choose `Custom team`:
   - `Select roles for your team:`
   - available roles: `orchestrator`, `planner`, `researcher`, `developer`, `tester`, `reviewer`, `security-auditor`
   - if `orchestrator` is selected with other roles, handoffs are auto-wired to the other selected agents
5. `Customize agents before generating?`
   - if yes, each agent gets:
   - `Model for <agent>:`
6. Preview:
   - shows the files that will be created
   - asks `Generate these files?`

Important limitations of the wizard:

- It does not let you rename individual agents.
- It does not ask for custom `claude.instructions`.
- It does not ask for custom `claude.skills`, `forge.handoffs`, `claude.max_turns`, or exact tool lists.
- Those values come from built-in presets or role templates.
- If you want deeper customization, edit `teamcast.yaml` after init and run `teamcast generate`.

Non-interactive `init` flows:

- `teamcast init --preset <name>`
  - skips the wizard
  - loads the preset
  - uses the detected directory name as `project.name`
  - writes `teamcast.yaml`
  - generates files immediately
- `teamcast init --from ./my-team.yaml`
  - loads a custom YAML file
  - validates schema and manifest rules
  - writes `teamcast.yaml`
  - generates files immediately
- `teamcast init --yes`
  - runs wizard defaults without prompts
  - uses detected project name
  - uses the `feature-team` preset
  - skips final confirmation

### `add agent <name>`

`teamcast add agent <name>` adds a new agent to an existing manifest, writes `teamcast.yaml`, then regenerates all files.

Two modes are supported:

- `teamcast add agent <name>`
  - creates a custom agent from a short interactive flow
- `teamcast add agent <name> --template <role>`
  - creates an agent from a built-in role template

Interactive questions for `add agent <name>`:

1. `Agent description (when should Claude delegate to this agent?):`
2. `Model:`
   - `sonnet`
   - `opus`
   - `haiku`
3. `Can this agent write/edit files?`
4. `Can this agent run shell commands?`
5. `Can this agent access the internet?`
6. `Can this agent delegate to other agents?`

How those answers map into the manifest:

- Every custom agent gets `Read`, `Grep`, and `Glob`.
- If write access is enabled, TeamCast adds `Write`, `Edit`, `MultiEdit`.
- If bash access is enabled, TeamCast adds `Bash`.
- If internet access is enabled, TeamCast adds `WebFetch`, `WebSearch`.
- If delegation is enabled, TeamCast adds `Agent`.
- For disabled write/bash/web capabilities, the matching tools are written into `claude.disallowed_tools`.

What `add agent` does not ask for:

- `claude.instructions`
- `claude.skills`
- `forge.handoffs`
- `claude.max_turns`
- `claude.permission_mode`
- `claude.mcp_servers`
- a fully custom `claude.tools` / `claude.disallowed_tools` list

That means a custom agent added this way starts with a minimal prompt. To make it useful, edit `teamcast.yaml` and add fields such as `claude.instructions`, `claude.skills`, and `forge.handoffs`.

### `edit agent <name>`

`teamcast edit agent <name>` updates an existing agent, writes `teamcast.yaml`, then regenerates all files.

Two modes are supported:

- Non-interactive:

```bash
teamcast edit agent reviewer --description "Reviews backend changes"
teamcast edit agent reviewer --model opus
teamcast edit agent reviewer --max-turns 40
```

- Interactive:

```bash
teamcast edit agent reviewer
```

Interactive questions:

1. `Description:`
2. `Model:`
   - `sonnet`
   - `opus`
   - `haiku`
   - `inherit`
3. `Max turns (leave empty to keep current):`
4. `Customize tools?`
5. If yes:
   - `Select allowed tools:`
   - `claude.disallowed_tools` is computed automatically as the inverse of the selected allow-list

Important limitations:

- `edit agent` does not edit `claude.instructions`, `claude.skills`, `forge.handoffs`, `claude.permission_mode`, or `claude.mcp_servers`.
- If you pass any direct flags such as `--description`, `--model`, or `--max-turns`, the command updates only those fields and skips the interactive tool editor.

### `remove agent <name>`

`teamcast remove agent <name>` removes an agent from the manifest, removes that agent from any `forge.handoffs`, deletes the orphaned `.claude/agents/<name>.md` file, and regenerates the rest.

Interactive flow:

1. Shows the current agent name
2. Asks:
   - `Remove agent "<name>"? This will also remove it from any handoffs.`

Use `--yes` to skip confirmation.

### `create skill <name>`

`teamcast create skill <name>` registers a new skill name on one agent, writes `teamcast.yaml`, and generates `.claude/skills/<name>/SKILL.md`.

Rules and prompts:

- skill names must start with a letter and use lowercase letters, numbers, and hyphens only
- if the skill already exists anywhere in the manifest, the command fails
- existing skill names are shown for context
- then TeamCast asks:
  - `Which agent should own this skill?`

The generated `SKILL.md` file is a stub intended for manual editing. TeamCast will not overwrite an existing skill stub on later `generate` runs.

### `assign skill <name>`

`teamcast assign skill <name>` adds an existing skill to one or more additional agents, writes `teamcast.yaml`, and regenerates files.

Interactive flow:

1. Validates that the skill already exists somewhere in the manifest
2. Prints agents that already have the skill
3. Asks:
   - `Assign to which agents?`

The prompt is a multi-select list and requires at least one target agent.

### `generate`

`teamcast generate` reads `teamcast.yaml`, validates it for blocking issues, and writes generated files.

```bash
teamcast generate
teamcast generate --dry-run
```

Behavior:

- `generate` overwrites generated agent/docs/settings files
- skill stub files under `.claude/skills/` are created only if missing
- `--dry-run` shows what would be generated without writing anything

### `diff`

`teamcast diff` compares the current manifest to generated files already on disk.

It reports:

- new files
- modified files with added or removed line counts when available
- unchanged files

Use it to preview drift before running `teamcast generate`.

### `validate`

`teamcast validate` runs the validator against `teamcast.yaml`.

```bash
teamcast validate
teamcast validate --strict
teamcast validate --format json
```

Behavior:

- exits non-zero on validation errors
- with `--strict`, also exits non-zero on warnings
- with `--format json`, prints a JSON result object instead of human-readable output; useful for CI scripts that need to parse results programmatically

Validation categories include:

- handoff graph correctness
- tool conflicts
- role-based warnings
- security baseline checks

#### Policy Assertions

Assertions are declarative rules about your team that `validate` enforces. Define them under `policies.assertions`:

```yaml
policies:
  assertions:
    - rule: require_sandbox_with_execute
    - rule: no_unrestricted_execute
    - rule: max_agents
      count: 6
    - rule: deny_skill_for_role
      agent: reviewer
      skill: write_files
```

Available rules:

| Rule | Parameters | Description |
|------|-----------|-------------|
| `require_sandbox_with_execute` | — | Any agent with `execute` skill must have sandbox enabled |
| `no_unrestricted_execute` | — | `execute` skill must have a permission scope (e.g. `Bash(npm *)`) |
| `require_skill` | `skill` | All agents must have the specified skill |
| `deny_skill_for_role` | `agent`, `skill` | A named agent must not have the specified skill |
| `forbid_skill_combination` | `skills[]` | No single agent may hold all listed skills at once |
| `max_agents` | `count` | Team must not exceed the given number of agents |
| `require_instruction_block` | `kind` | All agents must include an instruction block of the given kind |
| `require_delegation_chain` | — | At least one agent must have the `delegate` skill |

The `secure-dev` preset includes several security assertions by default.

### `explain`

`teamcast explain` prints a human-readable summary of the team:

- project metadata
- agents
- models
- tools
- handoffs
- skills

Use this after `init`, `import`, or larger manifest edits to sanity-check the architecture.

### `import`

`teamcast import` converts an existing `.claude/` setup into `teamcast.yaml`.

Preconditions:

- `.claude/` must exist
- `teamcast.yaml` must not already exist

Flow:

1. Scans `.claude/agents/*.md`
2. Scans `.claude/settings.json`
3. Builds a manifest
4. Prints import warnings, if any
5. Prints discovered agents and policy categories
6. Validates the imported manifest
7. Asks:
   - `Write teamcast.yaml with imported configuration?`

Use `--yes` to skip confirmation.

Important note:

- `import` writes `teamcast.yaml`
- it does not run `generate`
- imported instructions are extracted from the agent markdown body text
- legacy TeamCast markdown is still supported, and old generated `Skills`, `Delegation`, and `Constraints` sections are stripped during import

### `reset`

`teamcast reset` deletes generated output but keeps `teamcast.yaml`.

It targets:

- `.claude/agents`
- `.claude/skills`
- `.claude/settings.json`
- `.claude/settings.local.json`
- `CLAUDE.md`
- `AGENTS.md`

Flow:

1. Shows the files that will be deleted
2. Asks:
   - `Delete these files?`

Use `--yes` to skip confirmation.

### `clean`

`teamcast clean` is the destructive version of `reset`.

It deletes:

- everything removed by `reset`
- `teamcast.yaml`

Flow:

1. Shows the files that will be deleted
2. Asks:
   - `Delete everything including teamcast.yaml?`

Use `--yes` to skip confirmation.

## Prompt Generation

Everything is defined in `teamcast.yaml` at the root of your project.

For each agent, TeamCast renders `.claude/agents/<name>.md` from `agents.<name>.claude`.

Native Claude Code fields are rendered into frontmatter:

- `description`
- `model`
- `tools`
- `disallowedTools`
- `permissionMode`
- `maxTurns`
- `skills`
- `mcpServers`
- `background`

`claude.instructions` becomes the markdown body.

`forge` metadata is not rendered into the agent markdown. It is used by TeamCast for validation, workflow docs, and delegation modeling.

This is important for custom agents:

- role templates and presets come with built-in `claude.instructions`
- `add agent <name>` without `--template` does not ask for `claude.instructions`
- a custom agent created from `add agent` therefore starts with a very minimal prompt until you edit `teamcast.yaml`

## Configuration

Everything is defined in `teamcast.yaml` at the root of your project.

### Minimal Example

```yaml
version: "1"
project:
  name: my-project

agents:
  developer:
    claude:
      description: Implements features and fixes bugs
      model: sonnet
      tools: [Read, Write, Edit, Bash, Grep, Glob]
      disallowed_tools: [WebFetch, WebSearch]
      instructions: |
        Implement the requested changes.
        Write tests when behavior changes.
```

### Full Example

```yaml
version: "1"
project:
  name: my-project
  description: TypeScript/Node.js web app

agents:
  orchestrator:
    claude:
      description: Coordinates the team and delegates tasks
      model: opus
      tools: [Read, Grep, Glob, Agent]
      disallowed_tools: [Edit, Write, Bash]
      max_turns: 30
      instructions: |
        You are the coordinator for the project.
        Read the request, break it into subtasks, and delegate to the right agents.
        Never modify files yourself.
    forge:
      handoffs: [planner, developer, reviewer]

  planner:
    claude:
      description: Analyzes codebase and produces implementation plans
      model: sonnet
      tools: [Read, Grep, Glob, WebFetch, WebSearch]
      disallowed_tools: [Edit, Write, Bash]
      instructions: |
        Read the codebase and produce a step-by-step implementation plan.
        Never modify files.

  developer:
    claude:
      description: Implements features based on the plan
      model: sonnet
      tools: [Read, Write, Edit, Bash, Grep, Glob]
      disallowed_tools: [WebFetch, WebSearch]
      skills: [test-first, clean-code]
      instructions: |
        Implement the plan, write tests, and verify the result.

  reviewer:
    claude:
      description: Reviews code for quality and security issues
      model: sonnet
      tools: [Read, Grep, Glob, Bash]
      disallowed_tools: [Edit, Write]
      instructions: |
        Review the implementation for correctness, style, and security.
        Do not modify files yourself.

policies:
  permissions:
    allow:
      - "Bash(npm run *)"
      - "Bash(npm test)"
      - "Bash(git status)"
      - "Bash(git diff *)"
      - "Bash(git commit *)"
    ask:
      - "Bash(git push *)"
    deny:
      - "Bash(rm -rf *)"
      - "Bash(git push --force *)"
      - "Write(.env*)"
  sandbox:
    enabled: true
    auto_allow_bash: true

settings:
  default_model: sonnet
  generate_docs: true
  generate_local_settings: true
```

### Agent Fields

| Field | Type | Description |
|-------|------|-------------|
| `claude.description` | string | Required. Shown in the Claude Code subagent picker |
| `claude.model` | `opus \| sonnet \| haiku \| inherit` | Model alias to use |
| `claude.tools` | string[] | Native Claude Code tool allow-list |
| `claude.disallowed_tools` | string[] | Native Claude Code tool deny-list |
| `claude.skills` | string[] | Skill names. Each unique skill generates `.claude/skills/<skill>/SKILL.md` |
| `claude.max_turns` | number | Maximum agentic turns |
| `claude.mcp_servers` | object[] | MCP server definitions |
| `claude.permission_mode` | `default \| acceptEdits \| bypassPermissions \| plan \| dontAsk` | Claude Code permission mode |
| `claude.instructions` | string | Freeform instructions used as the markdown body |
| `forge.handoffs` | string[] | Other agents this agent can delegate to. Requires `Agent` in `claude.tools` |

Available Claude Code tools:

`Read`, `Write`, `Edit`, `MultiEdit`, `Grep`, `Glob`, `Bash`, `WebFetch`, `WebSearch`, `Agent`

### Abstract Skills

Instead of listing raw tool names, you can specify platform-agnostic skills in `claude.tools`. TeamCast expands each skill to the appropriate Claude Code tools automatically.

| Skill | Expands to |
|-------|-----------|
| `read_files` | `Read`, `Grep`, `Glob` |
| `write_files` | `Write`, `Edit`, `MultiEdit` |
| `execute` | `Bash` |
| `search` | `Glob`, `Grep` |
| `web` | `WebFetch`, `WebSearch` |
| `delegate` | `Agent` |
| `interact` | `AskUserQuestion`, `TodoWrite`, `TodoRead` |
| `notebook` | `NotebookEdit` |

Example:

```yaml
developer:
  claude:
    tools: [read_files, write_files, execute]
```

Raw tool names and skills can be mixed in the same `tools` array.

### Policy Fields

```yaml
policies:
  permissions:
    allow: ["Bash(npm run *)", "WebFetch(api.example.com:*)"]
    ask: ["Bash(git push *)"]
    deny: ["Bash(rm -rf *)", "Write(.env*)"]
    default_mode: acceptEdits
  sandbox:
    enabled: true
    auto_allow_bash: true
```

## Custom Templates

Use `--from` to initialize from any valid TeamCast YAML file:

```bash
teamcast init --from ./my-team-template.yaml
```

This validates the file against the schema, writes `teamcast.yaml`, and generates all config files.

## Preset Metadata

When sharing presets, you can add optional metadata:

```yaml
preset_meta:
  author: your-name
  tags: [typescript, fullstack, security]
  min_version: "0.5.0"
```

## Validation

`teamcast validate` checks:

- handoff graph correctness
- tool allow or deny conflicts
- role-based warnings
- security baseline configuration
- policy assertions (when defined in `policies.assertions`)
