# TeamCast Architecture Specification v2

## 1. Vision

TeamCast is a **constructor for agent teams** — like Docker Compose for AI agents:

- Define a team in YAML
- Environment auto-detected (Node/Python/etc.)
- Agents assembled from reusable blocks
- Rendered to a specific platform (Claude, Codex, ...)
- Future: community registry of blocks (extension packs)

---

## 2. Primitives (7 atomic building blocks)

The system is built from 7 types of blocks. Each block has a unique ID, type, and scope.

### 2.1 Capability (abstract agent ability)

Platform-independent ability that maps to platform-specific tools.

```typescript
type CapabilityId =
  | 'read_files'    // read project files
  | 'write_files'   // create/edit files
  | 'execute'       // run shell commands
  | 'search'        // search the codebase
  | 'web'           // internet access
  | 'delegate'      // delegate tasks to other agents
  | 'interact'      // user interaction
  | 'notebook';     // Jupyter notebooks

interface CapabilityDefinition {
  id: CapabilityId;
  description: string;
}
```

**Rule**: Capability is platform-agnostic. Mapping Capability -> Tool[target] happens in the renderer layer.

### 2.2 Tool (platform-specific instrument)

```typescript
interface ToolDefinition {
  name: string;           // e.g., 'Read', 'Bash', 'WebSearch'
  target: TargetName;     // 'claude' | 'codex'
  description: string;
  capability: CapabilityId; // reverse link: which capability this tool implements
}
```

**Capability -> Tools mapping (per target):**

| Capability | Claude Tools | Codex Tools |
|------------|-------------|-------------|
| `read_files` | Read, Glob | read_file, list_directory |
| `write_files` | Write, Edit, MultiEdit, NotebookEdit | write_file, apply_patch |
| `execute` | Bash | shell |
| `search` | Grep, Glob | search_codebase |
| `web` | WebFetch, WebSearch | web_search |
| `delegate` | Agent | sub-agent spawning (via [agents.*] config) |
| `interact` | AskUserQuestion, TodoWrite, TodoRead | ask_user |
| `notebook` | NotebookEdit | — |

**Rule**: Each tool belongs to exactly one capability. A capability can provide multiple tools.

> **Note on Codex evolution (2026):** Codex now supports SKILL.md files, MCP servers,
> multi-agent orchestration via `config.toml`, and `AGENTS.md` for custom instructions.
> The tools table above reflects Codex's built-in sandbox tools; MCP-provided tools
> are added dynamically via `[mcp_servers]` in config.

### 2.3 Capability Trait (named bundle of capabilities)

```typescript
interface CapabilityTrait {
  id: CapabilityTraitId;
  grant: CapabilityId[];    // grant these capabilities
  deny: CapabilityId[];     // deny these capabilities
}
```

**Catalog:**

| Trait ID | Grant | Deny |
|----------|-------|------|
| `base-read` | `read_files`, `search` | — |
| `file-authoring` | `write_files` | — |
| `command-execution` | `execute` | — |
| `web-research` | `web` | — |
| `delegation` | `delegate` | — |
| `interaction` | `interact` | — |
| `notebook-editing` | `notebook` | — |
| `no-file-edits` | — | `write_files` |
| `no-commands` | — | `execute` |
| `no-web` | — | `web` |
| `full-access` | all capabilities | — |

**Rules**:
- Trait is atomic. Does not depend on other traits.
- Grant and deny of the same capability across different traits on one agent -> **CONFLICT** (see validation).

### 2.4 Policy Fragment (named security rule)

```typescript
interface PolicyFragment {
  id: PolicyFragmentId;
  effect: 'allow' | 'ask' | 'deny';
  patterns: string[];      // glob-patterns for matching
  scope?: 'sandbox' | 'permissions' | 'network';
}
```

**Catalog:**

| Fragment ID | Effect | Patterns |
|-------------|--------|----------|
| `allow-git-read` | allow | `Bash(git status)`, `Bash(git diff *)`, `Bash(git log)` |
| `allow-git-write` | allow | `Bash(git add *)`, `Bash(git commit *)` |
| `ask-git-push` | ask | `Bash(git push *)` |
| `deny-destructive-shell` | deny | `Bash(rm -rf *)`, `Bash(git push --force *)` |
| `deny-network-downloads` | deny | `Bash(curl *)`, `Bash(wget *)` |
| `deny-dynamic-exec` | deny | `Bash(eval *)`, `Bash(exec *)` |
| `deny-env-files` | deny | `Write(.env*)`, `Edit(.env*)` |
| `sandbox-enabled` | — | — (sets sandbox.enabled: true) |

**Rules**:
- Each fragment is exactly one effect + set of patterns.
- Fragment does not know about capabilities or tools. It operates at **pattern matching** level on target-native commands.

### 2.5 Instruction Fragment (prompt block)

```typescript
type InstructionKind = 'behavior' | 'workflow' | 'safety' | 'style' | 'delegation';

interface InstructionFragment {
  id: InstructionFragmentId;
  kind: InstructionKind;
  content: string;
  requires_capabilities?: CapabilityId[];       // "this fragment only makes sense if agent has these"
  conflicts_with?: InstructionFragmentId[];      // "incompatible with"
}
```

**Key field `requires_capabilities`**: enables cross-validation with agent capabilities.

Example:
```typescript
{
  id: 'development-workflow',
  kind: 'workflow',
  content: 'Read code before editing. Run tests after changes.',
  requires_capabilities: ['read_files', 'write_files', 'execute'],
}
```

**Rules**:
- Fragment belongs to one `kind`.
- Two fragments of the same `kind` on one agent is allowed (concatenation), but `conflicts_with` can prohibit it.

### 2.6 Skill (full-featured agent skill)

Claude Skills are **not just prompt templates**. A skill is a directory with instructions, reference files, scripts, and MCP dependencies.

```typescript
interface SkillDefinition {
  // Identity
  id: string;                          // 'deploy-check', 'figma-to-code'
  name: string;                        // display name
  description: string;                 // trigger description (for auto-discovery)

  // Content
  instructions: string;                // markdown body
  reference_files?: Record<string, string>;  // path -> content
  scripts?: Record<string, string>;          // path -> content

  // Requirements
  allowed_tools?: string[];            // tools the skill uses
  required_capabilities?: CapabilityId[];  // abstract capabilities needed by agent
  required_mcp_servers?: string[];     // MCP servers that must be configured

  // Metadata
  source: 'builtin' | 'user' | 'extension';
  metadata?: {
    author?: string;
    version?: string;
    tags?: string[];
  };
  compatibility?: {
    targets?: TargetName[];            // which targets fully support this skill
    degraded_targets?: TargetName[];   // targets where skill works with feature loss
    unsupported_features?: Record<TargetName, string[]>;  // what's lost per target
  };
  conflicts_with?: string[];          // incompatible skills or instruction fragments

  // Codex-specific (rendered into agents/openai.yaml)
  codex_metadata?: {
    display_name?: string;
    icon_small?: string;
    icon_large?: string;
    brand_color?: string;
    default_prompt?: string;
    allow_implicit_invocation?: boolean;   // default: true
  };
}
```

**Rendering per target:**

Both Claude and Codex now support SKILL.md-based skills with similar directory structures:

```
Claude target:
  .claude/skills/{id}/SKILL.md     <- frontmatter (name, description, allowed-tools) + instructions
  .claude/skills/{id}/reference/   <- reference_files
  .claude/skills/{id}/scripts/     <- scripts

Codex target:
  .agents/skills/{id}/SKILL.md     <- frontmatter (name, description) + instructions
  .agents/skills/{id}/references/  <- reference_files
  .agents/skills/{id}/scripts/     <- scripts
  .agents/skills/{id}/agents/openai.yaml <- UI metadata, invocation policy, MCP tool dependencies
```

**Key differences between targets:**

| Aspect | Claude | Codex |
|--------|--------|-------|
| Skill location | `.claude/skills/{id}/` | `.agents/skills/{id}/` |
| Frontmatter fields | `name`, `description`, `allowed-tools` | `name`, `description` |
| Tool dependencies | `allowed-tools` in SKILL.md frontmatter | `agents/openai.yaml` → `dependencies.tools[]` |
| MCP in skill | Configured globally in settings.json | Declared per-skill in `agents/openai.yaml` |
| Invocation | Slash command `/{id}` | `$skillname` or `/skills` menu |
| Auto-invocation | Always available when matched | `allow_implicit_invocation` policy (default: true) |
| UI metadata | None | `agents/openai.yaml` → `interface` (icon, color, display_name) |

**Skill sources:**
1. **Builtin** (registry/skills/) — shipped with TeamCast
2. **User-defined** (inline in YAML via `skill_blocks`)
3. **Extension pack** (future) — e.g., `figma-pack:figma-to-code`
4. **Community** (future) — shared skill repositories

### 2.7 Environment (project runtime context)

```typescript
interface Environment {
  id: EnvironmentId;          // 'node', 'python', 'rust', 'go'
  description: string;
  detect: (cwd: string) => boolean;  // auto-detection

  // Fixed, validated bundle of blocks
  policy_fragments: PolicyFragmentId[];
  instruction_fragments: InstructionFragmentId[];

  // Environment-specific permission rules (not covered by fragments)
  permission_rules: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
  };
}
```

**Catalog:**

| Environment | Detect | Permission Rules | Instruction Fragments |
|-------------|--------|------------------|-----------------------|
| `node` | `package.json` exists | allow: `npm run *`, `npm test *`, `npx *`, `npm install`, `node *` | `node-testing` |
| `python` | `pyproject.toml` or `requirements.txt` or `setup.py` | allow: `python *`, `pip install *`, `pytest *`, `uv *` | `python-testing` |

**Rules**:
- Environment is applied **entirely** or not at all. No cherry-picking.
- Multiple environments simultaneously is allowed (monorepo with Node + Python). Rules are additive.
- Environment does NOT touch agents/capabilities/traits. Only policies and common instructions.

### 2.8 Preset (team template)

```typescript
interface Preset {
  id: string;
  description: string;
  tags: string[];
  agents: Record<string, PresetAgentConfig>;
  policy_fragments?: PolicyFragmentId[];
  // Preset does NOT include environments — those are orthogonal
}
```

**Rule**: Preset is the starting point. User can override any agent field in their YAML.

---

## 3. Composition

### 3.1 Pipeline

```
teamcast.yaml
    |
    v
+-----------------------------------------------------+
|  1. PARSE: read YAML -> TeamCastManifest             |
|  2. PRESET: if preset specified, load template       |
|  3. MERGE: user YAML overrides on top of preset      |
|  4. ENVIRONMENT: detect + apply environments         |
|  5. RESOLVE: traits -> capabilities -> tools[target] |
|  6. COMPOSE: policy fragments -> merged policies     |
|  7. VALIDATE: conflicts, coherence (57 checks)       |
|  8. RENDER: CoreTeam -> target-specific files         |
+-----------------------------------------------------+
```

### 3.2 Agent Resolution (step 5 in detail)

For each agent:

```
Input:
  capability_traits: ['base-read', 'file-authoring', 'no-web']
  tools: ['execute']              <- explicit tools from YAML
  disallowed_tools: []

Step 1 - Expand traits:
  granted_capabilities:  {read_files, search, write_files}  (from base-read + file-authoring)
  denied_capabilities:   {web}                               (from no-web)

Step 2 - Add explicit:
  explicit_capabilities: {execute}                           (parsed from tools[])

Step 3 - Check conflicts:
  intersection(granted U explicit, denied) -> must be empty
  -> if {web} intersection (granted U explicit) != empty -> ERROR

Step 4 - Final capability set:
  final_capabilities = (granted U explicit) - denied
  = {read_files, search, write_files, execute}

Step 5 - Map to platform tools:
  claude: [Read, Glob, Grep, Write, Edit, MultiEdit, Bash]
  codex:  [read_file, list_directory, search_codebase, write_file, apply_patch, shell]
```

### 3.3 Policy Composition (step 6 in detail)

Policies are assembled from three sources in **strict priority order**:

```
Layer 1 (lowest):  Environment permission_rules     <- node-env: allow npm
Layer 2:           Policy fragments (from manifest)  <- allow-git-read, deny-env-files
Layer 3 (highest): Inline policies (from YAML)       <- user's custom rules
```

Merge algorithm:

```typescript
function composePolicies(layers: PolicyLayer[]): ResolvedPolicies {
  const allow: Set<string> = new Set();
  const ask: Set<string> = new Set();
  const deny: Set<string> = new Set();

  // Collect all rules
  for (const layer of layers) {
    layer.allow?.forEach(p => allow.add(p));
    layer.ask?.forEach(p => ask.add(p));
    layer.deny?.forEach(p => deny.add(p));
  }

  // Priority: deny > ask > allow
  for (const pattern of deny) {
    allow.delete(pattern);
    ask.delete(pattern);
  }
  for (const pattern of ask) {
    allow.delete(pattern);
  }

  return { allow: [...allow], ask: [...ask], deny: [...deny] };
}
```

**Key change**: instead of silent merge with undefined behavior — **explicit priority `deny > ask > allow`**. Conflict is not an error, but deterministic resolution with a warning.

---

## 4. Validation Specification (57 checks, 10 phases)

### Architecture

```typescript
validate(team: CoreTeam, context: ValidationContext): ValidationResult

interface ValidationContext {
  manifest: TeamCastManifest;
  targetName: TargetName;
  cwd: string;
  registry: Registry;
  skillMap: SkillToolMap;           // capability -> tools for current target
  mcpServers: McpServerConfig[];
  environments: EnvironmentId[];
}
```

Validation runs **10 phases** sequentially. If phase N finds ERROR, subsequent phases still execute (collect all errors, not fail-fast).

### Phase 1: REGISTRY — do all references exist

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `UNKNOWN_CAPABILITY_TRAIT` | ERROR | Trait ID not found in registry | `Agent "developer": unknown capability trait "full-stack"` |
| `UNKNOWN_POLICY_FRAGMENT` | ERROR | Fragment ID not found | `Unknown policy fragment "allow-docker"` |
| `UNKNOWN_INSTRUCTION_FRAGMENT` | ERROR | Fragment ID not found | `Agent "planner": unknown instruction fragment "planning-v3"` |
| `UNKNOWN_SKILL` | ERROR | Skill ID not found | `Agent "developer": unknown skill "deploy-check"` |
| `UNKNOWN_ENVIRONMENT` | ERROR | Environment ID not found | `Unknown environment "rust"` |
| `UNKNOWN_EXTENSION` | ERROR | Extension pack not installed | `Extension "django-pack" is not installed` |
| `UNKNOWN_MODEL` | WARNING | Model ID not in catalog | `Agent "developer": model "gpt-6" not found in model catalog — will be passed as-is` |
| `UNKNOWN_CAPABILITY_IN_TOOLS` | WARNING | String is not a CapabilityId or tool name | `Agent "dev": "deploy" is not a known capability or tool for target "claude"` |
| `NAMESPACED_BLOCK_MISSING` | ERROR | Extension exists but block-id not in it | `Block "safe-migrations" not found in extension "django-pack"` |

### Phase 2: TRAITS -> CAPABILITIES — resolve agent abilities

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `TRAIT_CAPABILITY_CONFLICT` | ERROR | Same capability in grant (from one trait) and deny (from another) | `Agent "orchestrator": capability "web" is granted by trait "web-research" and denied by trait "no-web" — contradiction` |
| `EXPLICIT_TOOL_DENIED_BY_TRAIT` | ERROR | Agent explicitly lists capability in tools but trait denies it | `Agent "planner": explicitly lists capability "execute" in tools but trait "no-commands" denies it` |
| `ORPHAN_DENY_TRAIT` | INFO | Deny trait for capability not granted by any other trait | `Agent "reviewer": trait "no-web" denies "web" which is not granted — redundant` |
| `EMPTY_CAPABILITIES` | WARNING | Agent has no capabilities after resolution | `Agent "reporter" has no capabilities after trait resolution — agent cannot use any tools` |
| `DUPLICATE_TRAIT` | INFO | Same trait listed twice | `Agent "developer": trait "base-read" is listed twice` |

### Phase 3: CAPABILITIES -> TOOLS — platform mapping

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `CAPABILITY_NO_TOOLS_FOR_TARGET` | WARNING | Capability has no mapping for current target | `Agent "developer": capability "notebook" has no tool mapping for target "codex" — capability will be ignored` |
| `DISALLOWED_TOOL_NOT_IN_GRANTED` | INFO | Disallowed tool not in any granted capability | `Agent "dev": disallowed tool "WebSearch" is not granted by any capability — redundant` |

### Phase 4: POLICIES — coherence check

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `POLICY_ALLOW_DENY_CONFLICT` | WARNING | Same pattern in allow AND deny | `Pattern "Bash(curl *)" is in both allow and deny — deny wins (from fragment "deny-network-downloads" vs environment "node")` |
| `POLICY_ALLOW_ASK_OVERLAP` | INFO | Same pattern in allow AND ask | `Pattern "Bash(git push *)" is in both allow and ask — ask wins` |
| `POLICY_ASK_DENY_OVERLAP` | INFO | Same pattern in ask AND deny | `Pattern "Bash(rm -rf *)" is in both ask and deny — deny wins` |
| `DUPLICATE_POLICY_FRAGMENT` | INFO | Same fragment listed twice | `Policy fragment "allow-git-read" is referenced twice` |
| `DUPLICATE_POLICY_PATTERN` | INFO | Same pattern twice in one category | `Pattern "Bash(git status)" appears twice in allow rules` |
| `SANDBOX_CONTRADICTION` | WARNING | sandbox.enabled: false + auto_allow_bash: true | `Sandbox is disabled but auto_allow_bash is true — auto_allow_bash has no effect` |
| `EMPTY_DENY_RULES` | INFO | No deny rules at all | `No deny rules configured — all tool calls will be allowed or prompted` |

**Pattern overlap detection:**

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `POLICY_DENY_SHADOWS_ALLOW` | WARNING | Deny glob fully covers allow glob | `Deny pattern "Bash(*)" shadows allow pattern "Bash(npm run *)" — allow rule is unreachable` |
| `POLICY_ALLOW_NARROWS_DENY` | INFO | Allow pattern is subset of deny pattern | `Allow "Bash(git status)" is more specific than deny "Bash(git *)" — allow takes precedence for exact match` |

### Phase 5: CAPABILITIES <-> POLICIES — cross-validation

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `CAPABILITY_FULLY_DENIED` | ERROR | Agent has capability but ALL tools for it are denied | `Agent "developer": has capability "execute" (tools: [Bash]) but ALL its tools are denied by policy — capability is unusable` |
| `CAPABILITY_PARTIALLY_DENIED` | WARNING | Agent has capability, SOME tools denied | `Agent "developer": capability "write_files" has tool "MultiEdit" denied by policy — remaining tools: [Write, Edit]` |
| `POLICY_ALLOWS_UNGRANTED_TOOL` | INFO | Policy allows tool not granted to any agent | `Policy allows "Bash(npm run *)" but no agent has capability "execute" — rule has no effect` |
| `AGENT_LACKS_CAPABILITY_FOR_ALLOWED_PATTERN` | INFO | Policy allows pattern for tool agent doesn't have | `Agent "planner": policy allows "Bash(git status)" but agent lacks capability "execute"` |

Algorithm for `CAPABILITY_FULLY_DENIED`:

```typescript
for (const agent of team.agents) {
  for (const capability of agent.resolvedCapabilities) {
    const tools = skillMap[capability];  // e.g., execute -> [Bash]
    const allDenied = tools.every(tool =>
      denyRules.some(pattern => matchesPattern(pattern, tool))
    );
    if (allDenied) -> ERROR;

    const someDenied = tools.some(tool =>
      denyRules.some(pattern => matchesPattern(pattern, tool))
    );
    if (someDenied && !allDenied) -> WARNING;
  }
}
```

### Phase 6: SKILLS — skill validation

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `SKILL_MISSING_CAPABILITY` | ERROR | Skill requires capability agent doesn't have | `Agent "planner": skill "test-first" requires capability "execute" but agent lacks it — skill cannot function` |
| `SKILL_CAPABILITY_DENIED_BY_TRAIT` | ERROR | Skill requires capability explicitly denied by trait | `Agent "planner": skill "test-first" requires "execute" which is denied by trait "no-commands"` |
| `SKILL_TOOL_FULLY_DENIED` | ERROR | ALL tools the skill uses are denied | `Agent "developer": skill "deploy-check" uses tool "Bash" which is fully denied by policy` |
| `SKILL_TOOL_PARTIALLY_DENIED` | WARNING | Some tools the skill uses are denied | `Skill "deploy-check" uses tool "Bash" — some Bash patterns are denied, skill may partially fail` |
| `SKILL_MISSING_MCP` | ERROR | Skill requires MCP server not configured | `Skill "figma-to-code" requires MCP server "figma" which is not configured in manifest` |
| `SKILL_TARGET_INCOMPATIBLE` | WARNING | Skill doesn't support current target | `Skill "figma-to-code" is not compatible with target "codex" — instructions will be inlined` |
| `SKILL_MCP_TARGET_INCOMPATIBLE` | WARNING | MCP needed but target doesn't support it | `Skill "figma-to-code" requires MCP but target "X" has no MCP support` |
| `SKILL_DUPLICATE` | INFO | Same skill listed twice on one agent | `Agent "developer": skill "test-first" is listed twice` |
| `SKILL_INSTRUCTION_CONFLICT` | WARNING | Skill conflicts with instruction fragment on agent | `Agent "dev": skill "test-first" conflicts with instruction fragment "skip-tests"` |

**Full validation chain for one skill:**

```
Skill "deploy-check" on Agent "developer":
|
+- 1. Skill exists in registry?                    -> UNKNOWN_SKILL
+- 2. required_capabilities <= agent.capabilities?  -> SKILL_MISSING_CAPABILITY
+- 3. required_capabilities & agent.denied?         -> SKILL_CAPABILITY_DENIED_BY_TRAIT
+- 4. allowed_tools denied by policies?             -> SKILL_TOOL_FULLY_DENIED
+- 5. required_mcp_servers configured?              -> SKILL_MISSING_MCP
+- 6. compatible with target?                       -> SKILL_TARGET_INCOMPATIBLE
+- 7. MCP + target supports MCP?                    -> SKILL_MCP_TARGET_INCOMPATIBLE
+- 8. conflicts_with active fragments?              -> SKILL_INSTRUCTION_CONFLICT
```

### Phase 7: INSTRUCTIONS — prompt block checks

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `INSTRUCTION_REQUIRES_MISSING_CAPABILITY` | WARNING | Fragment declares requires_capabilities, agent lacks one | `Agent "planner": instruction "development-workflow" requires capability "execute" but agent lacks it` |
| `INSTRUCTION_MUTUAL_CONFLICT` | ERROR | Two fragments on same agent, one in conflicts_with of other | `Agent "dev": instruction fragments "solo-dev-core" and "coordination-core" are mutually exclusive` |
| `INSTRUCTION_DUPLICATE` | INFO | Same fragment listed twice | `Agent "developer": instruction fragment "development-core" listed twice` |
| `INSTRUCTION_KIND_OVERLOAD` | INFO | More than 3 fragments of same kind on one agent | `Agent "dev" has 5 fragments of kind "behavior" — consider consolidating` |
| `INSTRUCTION_EMPTY_CONTENT` | WARNING | Block has empty content | `Agent "dev": instruction block of kind "workflow" has empty content` |
| `INSTRUCTION_CONTRADICTS_CAPABILITY` | WARNING | Content says "do not modify files" but agent has write_files | `Agent "dev": instruction says "do not modify files" but agent has capability "write_files" — possible contradiction` |
| `INSTRUCTION_REFERENCES_MISSING_AGENT` | WARNING | Content says "delegate to X" but X not in handoffs | `Agent "orchestrator": instruction mentions "delegate to tester" but "tester" is not in handoffs` |

**Heuristic patterns for soft checks:**

```typescript
const CONTRADICTION_PATTERNS = [
  {
    pattern: /do not (modify|edit|write|change) files/i,
    deniedCapability: 'write_files',
    code: 'INSTRUCTION_CONTRADICTS_CAPABILITY',
  },
  {
    pattern: /run (tests|the test suite|npm test|pytest)/i,
    requiredCapability: 'execute',
    code: 'INSTRUCTION_REQUIRES_MISSING_CAPABILITY',
  },
  {
    pattern: /search the web|look up|find documentation online/i,
    requiredCapability: 'web',
    code: 'INSTRUCTION_REQUIRES_MISSING_CAPABILITY',
  },
  {
    pattern: /delegate to (\w+)/i,
    requiredCapability: 'delegate',
    code: 'INSTRUCTION_REQUIRES_MISSING_CAPABILITY',
  },
];
```

### Phase 8: TEAM GRAPH — cross-agent integrity

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `HANDOFF_TARGET_MISSING` | ERROR | Handoff references agent not in team | `Agent "orchestrator": handoff target "tester" does not exist in team` |
| `DELEGATION_WITHOUT_CAPABILITY` | ERROR | Agent has handoffs but lacks delegate capability | `Agent "orchestrator" has handoffs [planner, developer] but lacks capability "delegate"` |
| `CIRCULAR_HANDOFF` | ERROR | Cycle in handoff graph | `Circular handoff: orchestrator -> planner -> orchestrator` |
| `ORPHAN_AGENT` | WARNING | Agent not reachable from any handoff chain | `Agent "reviewer" is not reachable from any handoff chain — may never be invoked` |
| `MULTIPLE_ROOTS` | INFO | Multiple agents with no incoming handoffs | `Multiple root agents: ["orchestrator", "standalone-dev"] — this may be intentional` |
| `HANDOFF_TO_SELF` | ERROR | Agent in its own handoff list | `Agent "orchestrator" hands off to itself` |
| `HANDOFF_CAPABILITY_MISMATCH` | WARNING | Agent delegates to agent without needed capabilities | `Agent "orchestrator" hands off to "planner" but planner lacks capability "web"` |

Cycle detection algorithm:

```typescript
function detectCycles(agents: Record<string, CoreAgent>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(agentId: string, path: string[]): void {
    if (inStack.has(agentId)) {
      const cycleStart = path.indexOf(agentId);
      cycles.push(path.slice(cycleStart).concat(agentId));
      return;
    }
    if (visited.has(agentId)) return;

    visited.add(agentId);
    inStack.add(agentId);

    const handoffs = agents[agentId]?.metadata?.handoffs ?? [];
    for (const target of handoffs) {
      dfs(target, [...path, agentId]);
    }

    inStack.delete(agentId);
  }

  for (const agentId of Object.keys(agents)) {
    dfs(agentId, []);
  }
  return cycles;
}
```

### Phase 9: ENVIRONMENT — environment validation

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `ENVIRONMENT_NOT_DETECTED` | WARNING | Environment listed but detect() returns false | `Environment "node" is listed but package.json not found in project root` |
| `ENVIRONMENT_DUPLICATE` | INFO | Same environment listed twice | `Environment "node" listed twice` |
| `ENVIRONMENT_POLICY_CONFLICT` | WARNING | Environment adds allow rule, fragment adds deny for same pattern | `Environment "node" allows "Bash(npm run *)" but policy fragment "deny-all-bash" denies "Bash(*)" — deny wins` |

### Phase 10: MCP SERVERS — MCP configuration validation

| Code | Severity | Condition | Message |
|------|----------|-----------|---------|
| `MCP_UNUSED` | INFO | MCP server configured but no skill requires it | `MCP server "postgres" is configured but no skill requires it` |
| `MCP_MISSING_CONFIG` | ERROR | MCP server without required fields | `MCP server "figma": missing required field "url" or "command"` |
| `MCP_TARGET_UNSUPPORTED` | WARNING | MCP configured for target that doesn't support MCP | `MCP servers configured but target "X" does not support MCP — servers will be ignored` |
| `MCP_DUPLICATE` | WARNING | Two MCP servers with same name | `Duplicate MCP server name "figma"` |

---

## 5. Validation Summary

| Phase | Count | ERROR | WARNING | INFO |
|-------|-------|-------|---------|------|
| 1. Registry | 9 | 5 | 2 | 2 |
| 2. Traits -> Capabilities | 5 | 2 | 1 | 2 |
| 3. Capabilities -> Tools | 2 | 0 | 1 | 1 |
| 4. Policy coherence | 9 | 0 | 3 | 6 |
| 5. Capabilities <-> Policies | 4 | 1 | 1 | 2 |
| 6. Skills | 9 | 4 | 3 | 2 |
| 7. Instructions | 7 | 1 | 4 | 2 |
| 8. Team graph | 7 | 4 | 2 | 1 |
| 9. Environment | 3 | 0 | 2 | 1 |
| 10. MCP | 4 | 1 | 2 | 1 |
| **Total** | **59** | **18** | **21** | **20** |

---

## 6. Types

```typescript
type Severity = 'error' | 'warning' | 'info';

type ValidationPhase =
  | 'registry'
  | 'traits'
  | 'tools'
  | 'policies'
  | 'capabilities-policies'
  | 'skills'
  | 'instructions'
  | 'team-graph'
  | 'environment'
  | 'mcp';

interface ValidationEntry {
  code: ValidationCode;
  severity: Severity;
  phase: ValidationPhase;
  message: string;

  // Context
  agent?: string;
  skill?: string;
  fragments?: string[];
  patterns?: string[];

  // Help
  suggestion?: string;       // "Consider removing trait 'no-web' or skill 'web-search'"
}

interface ValidationResult {
  valid: boolean;              // true if zero ERRORs

  entries: ValidationEntry[];
  errors: ValidationEntry[];
  warnings: ValidationEntry[];
  infos: ValidationEntry[];

  // Grouping for CLI output
  byPhase: Record<ValidationPhase, ValidationEntry[]>;
  byAgent: Record<string, ValidationEntry[]>;
}
```

---

## 7. Target code structure

```
src/
+-- registry/                    # single catalog of all blocks
|   +-- types.ts                 # CapabilityDef, ToolDef, TraitDef, PolicyFragmentDef, ...
|   +-- index.ts                 # Registry class + default instance
|   +-- capabilities.ts          # built-in capabilities catalog
|   +-- traits.ts                # built-in capability traits
|   +-- policy-fragments.ts      # built-in policy fragments
|   +-- instruction-fragments.ts # built-in instruction fragments
|   +-- skills.ts                # built-in skill definitions (full SkillDefinition[])
|   +-- environments.ts          # built-in environments (node, python)
|   +-- models.ts                # built-in model catalog
|   +-- extensions.ts            # future: extension pack loader
|
+-- core/                        # domain: types + pure logic
|   +-- types.ts                 # Capability, CoreAgent, CoreTeam, AgentRuntime, ...
|   +-- resolve-agent.ts         # traits -> capabilities -> tools
|   +-- resolve-skills.ts        # skill requirements validation
|   +-- compose-policies.ts      # fragments -> merged policies (single function)
|   +-- instructions.ts          # InstructionBlock types
|
+-- validator/                   # all validation in one module
|   +-- index.ts                 # validate(team): ValidationResult
|   +-- types.ts                 # ValidationEntry, ValidationResult, Severity, ValidationCode
|   +-- checks/
|   |   +-- registry.ts          # Phase 1
|   |   +-- trait-capability.ts  # Phase 2
|   |   +-- capability-tools.ts  # Phase 3
|   |   +-- policy-coherence.ts  # Phase 4
|   |   +-- capability-policy.ts # Phase 5
|   |   +-- skill-requirements.ts # Phase 6
|   |   +-- instructions.ts      # Phase 7
|   |   +-- team-graph.ts        # Phase 8
|   |   +-- environment.ts       # Phase 9
|   |   +-- mcp.ts               # Phase 10
|   +-- conflict-detector.ts     # pattern matching for allow/deny overlap detection
|
+-- manifest/                    # YAML <-> internal types
|   +-- reader.ts
|   +-- writer.ts
|   +-- normalize.ts             # YAML -> CoreTeam (calls registry + resolve)
|   +-- types.ts                 # TeamCastManifest (YAML shape)
|
+-- renderers/                   # CoreTeam -> platform files
|   +-- types.ts                 # PlatformRenderer, RenderedFile
|   +-- claude/
|   |   +-- index.ts
|   |   +-- skill-map.ts         # CapabilityId -> Claude tool names
|   |   +-- skill-renderer.ts    # SkillDefinition -> .claude/skills/{id}/SKILL.md
|   |   +-- ...
|   +-- codex/
|       +-- index.ts             # CodexRenderer
|       +-- skill-map.ts         # CapabilityId -> Codex tool names
|       +-- skill-renderer.ts    # SkillDefinition -> .agents/skills/{id}/SKILL.md + agents/openai.yaml
|       +-- config-toml.ts       # generates .codex/config.toml (agents, MCP, sandbox)
|       +-- agents-md.ts         # generates AGENTS.md (instructions)
|
+-- presets/                     # preset templates
+-- wizard/                      # interactive setup
+-- cli/                         # commander commands
```

**Key differences from current structure:**
1. `src/plugins/` -> `src/registry/` — flat catalog instead of plugin lifecycle
2. `src/components/` dissolved — traits, instruction-fragments, policy-fragments move to `registry/`
3. Single `compose-policies.ts` — instead of two mergePolicies in different modules
4. Validator expanded — checks from Phases 1-10 as separate checker modules
5. `resolve-agent.ts` — all traits -> capabilities -> tools logic in one place
6. `resolve-skills.ts` — new module for skill requirement validation
7. `skill-renderer.ts` — per-target: Claude renders to `.claude/skills/`, Codex renders to `.agents/skills/{id}/` + `agents/openai.yaml`
8. `codex/config-toml.ts` — new: generates `.codex/config.toml` with agents, MCP, sandbox
9. `codex/agents-md.ts` — new: generates `AGENTS.md` with team instructions

---

## 8. YAML schema (user-facing)

```yaml
version: "2"

project:
  name: my-app
  preset: feature-team           # optional: starting template
  description: "E-commerce API"
  environments: [node]           # optional: auto or explicit

extensions: [django-pack]        # future: community packs

claude:
  policies:
    fragments:                   # named rules
      - allow-git-read
      - allow-git-write
      - deny-env-files
      - django-pack:safe-migrations   # future: from extension
    permissions:                 # inline rules (Layer 3, highest priority)
      rules:
        allow:
          - "Bash(npm run *)"
        deny:
          - "Bash(rm -rf *)"
    sandbox:
      enabled: true

  agents:
    orchestrator:
      description: "Team coordinator"
      model: opus
      capability_traits:
        - base-read
        - delegation
        - no-file-edits
        - no-commands
        - no-web
      skills: [triage, routing]
      max_turns: 30
      forge:
        handoffs: [planner, developer, reviewer]
      instruction_fragments:
        - coordination-core
        - delegate-first
      instruction_blocks:
        - kind: behavior
          content: "You coordinate the team..."

    developer:
      description: "Developer"
      model: sonnet
      capability_traits:
        - base-read
        - file-authoring
        - command-execution
        - no-web
      skills: [test-first, clean-code, figma-to-code]
      instruction_fragments:
        - development-core
        - development-workflow
      skill_blocks:              # inline custom skills
        - name: my-deploy-check
          description: "Validates deployment readiness"
          instructions: |
            ## Steps
            1. Run all tests
            2. Check for TODO comments
            3. Verify no .env files are committed

codex:
  policies:
    sandbox:
      default_mode: workspace-write   # read-only | workspace-write
  agents:
    explorer:
      description: "Codebase explorer"
      model: gpt-5.3
      sandbox_mode: read-only
      capability_traits:
        - base-read
        - no-file-edits
        - no-commands
    worker:
      description: "Implementation agent"
      model: codex-1
      sandbox_mode: workspace-write
      capability_traits:
        - base-read
        - file-authoring
        - command-execution
      skills: [test-first, clean-code]
```

---

## 8b. Platform-specific output (what TeamCast generates)

### Claude target output

```
project/
├── CLAUDE.md                          <- team instructions, policies, agent definitions
├── .claude/
│   ├── settings.json                  <- mcpServers, permissions
│   └── skills/
│       ├── test-first/
│       │   └── SKILL.md               <- frontmatter + instructions
│       └── deploy-check/
│           ├── SKILL.md
│           ├── reference/
│           └── scripts/
└── .claude/agents/                    <- per-agent CLAUDE.md overrides (subagent_type)
```

### Codex target output

```
project/
├── AGENTS.md                          <- team instructions (free-form markdown)
├── .codex/
│   └── config.toml                    <- agents, MCP servers, sandbox, models
└── .agents/
    └── skills/
        ├── test-first/
        │   └── SKILL.md               <- skill instructions
        └── deploy-check/
            ├── SKILL.md
            ├── references/
            ├── scripts/
            └── agents/
                └── openai.yaml        <- UI metadata, invocation policy, tool deps
```

### Mapping table

| TeamCast concept | Claude output | Codex output |
|------------------|--------------|--------------|
| **Agent definition** | Section in CLAUDE.md | `[agents.<name>]` in config.toml |
| **Agent model** | `model` in agent prompt | `model` field in `[agents.<name>]` |
| **Agent instructions** | Per-agent section in CLAUDE.md | `developer_instructions` in config.toml + AGENTS.md |
| **Capabilities → Tools** | `allowed-tools` list | tool whitelist + `sandbox_mode` |
| **Policies (allow/deny)** | Security section in CLAUDE.md + settings.json | `sandbox_mode` per agent + AGENTS.md rules |
| **Skills** | `.claude/skills/{id}/SKILL.md` | `.agents/skills/{id}/SKILL.md` + `agents/openai.yaml` |
| **MCP servers** | `mcpServers` in settings.json | `[mcp_servers.<name>]` in config.toml |
| **Delegation / handoffs** | Agent tool + `subagent_type` param | `max_threads` + `max_depth` + agent roles |
| **Environment rules** | Inline in CLAUDE.md permissions | Inline in AGENTS.md + config.toml |

### Model catalog

| Model alias | Claude (Anthropic) | Codex (OpenAI) |
|-------------|-------------------|----------------|
| `flagship` | claude-opus-4-6 | gpt-5.4 |
| `balanced` | claude-sonnet-4-6 | gpt-5.3 |
| `fast` | claude-haiku-4-5 | gpt-5.3-mini |
| `code` | claude-sonnet-4-6 | codex-1 |
| `reasoning` | claude-opus-4-6 | o4-mini |

> Model aliases are convenience shortcuts. Users can always specify exact model IDs directly.

---

## 9. Extension Pack (future)

```typescript
interface ExtensionPack {
  name: string;                    // 'django-pack'
  version: string;
  description: string;

  // All blocks namespaced: 'django-pack:safe-migrations'
  traits?: Record<string, CapabilityTraitDef>;
  policy_fragments?: Record<string, PolicyFragmentDef>;
  instruction_fragments?: Record<string, InstructionFragmentDef>;
  environments?: Record<string, EnvironmentDef>;
  skills?: Record<string, SkillDefinition>;
  presets?: Record<string, PresetDef>;
}
```

**Rules:**
- All IDs automatically prefixed: `django-pack:safe-migrations`
- Extension is NOT applied automatically. Only through explicit reference in YAML.
- When `extensions: [django-pack]` — blocks become available for references, nothing is injected.
- ID collision between extensions -> ERROR at registration.

---

## 10. CLI output example

```
$ teamcast validate

  [check] Registry references          9/9 valid
  [fail]  Trait -> Capability resolution
      ERROR  Agent "orchestrator": capability "web" granted by trait "web-research"
             and denied by trait "no-web" — contradiction
             -> Remove one of the conflicting traits

  [check] Capability -> Tool mapping    2/2 valid
  [warn]  Policy coherence
      WARN   Pattern "Bash(curl *)" in both allow (env "node") and deny
             (fragment "deny-network-downloads") — deny wins
      INFO   No deny rules for Write/Edit tools

  [fail]  Capability <-> Policy
      ERROR  Agent "developer": capability "execute" (tools: [Bash]) fully
             denied by policy — capability is unusable
             -> Remove "execute" capability or adjust deny rules

  [warn]  Skills
      WARN   Agent "planner": skill "test-first" requires capability "execute"
             but agent lacks it — skill cannot function
             -> Add trait "command-execution" or remove skill "test-first"

  [check] Instructions                 7/7 valid
  [check] Team graph                   7/7 valid
  [check] Environment                  3/3 valid
  [check] MCP servers                  4/4 valid

  Result: 2 errors, 2 warnings, 3 info
  [fail]  Validation failed — fix errors before generating
```
