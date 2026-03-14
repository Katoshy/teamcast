# TeamCast v2 Architecture Refactoring Roadmap

> Reference: [ARCHITECTURE.md](ARCHITECTURE.md) — full specification of the target architecture.

## Principles

- **Every step leaves the project working, tests green.** No "break everything and rebuild".
- **One PR = one checker or one subtask.** Do not mix registry refactor with validation.
- **Tests first.** Each checker starts with tests before implementation.
- **Delete old code immediately** after replacement. Do not keep deprecated modules around.
- **Do not touch renderers** until Stage 5. They work — let them work.
- **Backward compatibility** for YAML v2: `plugins: [node-env]` continues to work with deprecation warning.

---

## Stage 1: Foundation — Registry + Renames

**Goal**: Replace `src/plugins/` with `src/registry/`, rename AgentSkill → Capability.

**Dependencies**: none — this is the foundation for everything.

**Estimated effort**: 2–3 days.

### Tasks

- [ ] **1.1** Create `src/registry/types.ts` — define `CapabilityId`, `CapabilityTraitDef`, `PolicyFragmentDef`, `InstructionFragmentDef`, `SkillDefinition`, `EnvironmentDef`, `ModelDefinition`
- [ ] **1.2** Create `src/registry/index.ts` — `Registry` class (flat catalog, no plugin lifecycle) + default instance
- [ ] **1.3** Create `src/registry/capabilities.ts` — move `AGENT_SKILLS` from `src/core/skills.ts`, rename to `CAPABILITIES`
- [ ] **1.4** Create `src/registry/traits.ts` — move `CAPABILITY_TRAITS` from `src/components/agent-fragments.ts`
- [ ] **1.5** Create `src/registry/policy-fragments.ts` — move `POLICY_FRAGMENTS` from `src/components/policy-fragments.ts`
- [ ] **1.6** Create `src/registry/instruction-fragments.ts` — move `INSTRUCTION_FRAGMENTS` from `src/components/agent-fragments.ts`
- [ ] **1.7** Create `src/registry/models.ts` — move model catalog from `src/plugins/core/models-plugin.ts`
- [ ] **1.8** Rename `AgentSkill` → `CapabilityId` across entire codebase (types, imports, tests)
- [ ] **1.9** Update `src/core/types.ts` — `AgentRuntime.tools` comment references Capability not AgentSkill
- [ ] **1.10** Update `src/core/skill-resolver.ts` → `src/core/capability-resolver.ts` (rename file + types)
- [ ] **1.11** Update renderer skill-maps: `src/renderers/claude/skill-map.ts`, `src/renderers/codex/skill-map.ts` — use CapabilityId
- [ ] **1.12** Add deprecated re-exports in old locations (`src/plugins/index.ts`, `src/components/`) pointing to new registry
- [ ] **1.13** Update all test files to use new imports
- [ ] **1.14** Run full test suite — all 175+ tests must pass
- [ ] **1.15** Remove `src/plugins/core/tools-plugin.ts`, `src/plugins/core/models-plugin.ts`, `src/plugins/core/presets-plugin.ts`
- [ ] **1.16** Remove `src/plugins/registry.ts`, `src/plugins/types.ts`
- [ ] **1.17** Remove `src/components/agent-fragments.ts`, `src/components/policy-fragments.ts`

### Acceptance criteria

- `src/registry/` contains all catalogs (capabilities, traits, policy-fragments, instruction-fragments, models)
- No file imports from `src/plugins/core/` or `src/components/`
- `AgentSkill` type no longer exists; `CapabilityId` is used everywhere
- All tests pass

---

## Stage 2: Single compose-policies

**Goal**: One merge function instead of two, with deterministic priority `deny > ask > allow`.

**Dependencies**: Stage 1.

**Estimated effort**: 1 day.

### Tasks

- [ ] **2.1** Create `src/core/compose-policies.ts` with new `composePolicies(layers: PolicyLayer[]): ResolvedPolicies`
- [ ] **2.2** Implement priority logic: `deny > ask > allow` — if pattern in deny, remove from allow and ask
- [ ] **2.3** Write tests: same pattern in allow+deny → deny wins; same pattern in allow+ask → ask wins
- [ ] **2.4** Write tests: multiple layers merge correctly (environment → fragments → inline)
- [ ] **2.5** Migrate all callers from old `mergePolicies` to new `composePolicies`
- [ ] **2.6** Remove `src/plugins/merge-policies.ts`
- [ ] **2.7** Remove `mergePolicies` function from `src/components/policy-fragments.ts` (file already moved in Stage 1)
- [ ] **2.8** Run full test suite

### Acceptance criteria

- Single `composePolicies` function in `src/core/compose-policies.ts`
- No other merge functions exist
- Priority `deny > ask > allow` is deterministic and tested
- All tests pass

---

## Stage 3: Environments as first-class concept

**Goal**: `project.environments: [node]` instead of `plugins: [node-env]`.

**Dependencies**: Stages 1–2.

**Estimated effort**: 1–2 days.

### Tasks

- [ ] **3.1** Define `EnvironmentDef` interface in `src/registry/types.ts` (id, detect, policy_fragments, instruction_fragments, permission_rules)
- [ ] **3.2** Create `src/registry/environments.ts` — define `node` and `python` environments
- [ ] **3.3** Add `environments?: string[]` field to `ProjectConfig` in `src/manifest/types.ts`
- [ ] **3.4** Update JSON Schema in `schema/` to accept `project.environments`
- [ ] **3.5** Update `src/manifest/normalize.ts` — apply environment policies and instruction fragments during normalization
- [ ] **3.6** Add compat layer: if `plugins: [node-env]` is present, convert to `environments: [node]` with deprecation warning
- [ ] **3.7** Write tests: environment auto-detection, environment policy injection, compat layer
- [ ] **3.8** Remove `src/plugins/environments/node-env-plugin.ts`
- [ ] **3.9** Remove `src/plugins/environments/python-env-plugin.ts`
- [ ] **3.10** Remove `src/plugins/inject.ts` (logic moved to normalize.ts)
- [ ] **3.11** Update wizard to show environments instead of plugins
- [ ] **3.12** Run full test suite

### Acceptance criteria

- `project.environments: [node]` works in YAML
- `plugins: [node-env]` still works but prints deprecation warning
- `src/plugins/` directory is empty or removed
- Environment detection works via registry
- All tests pass

---

## Stage 4: Validation — Phases 1–5, 8–9

**Goal**: Full validation for registry references, traits, capabilities, policies, team graph, and environments. Skills (phase 6) and instructions (phase 7) come later.

**Dependencies**: Stages 1–3.

**Estimated effort**: 4–5 days. Checkers can be parallelized.

### Tasks

#### 4.0 — Validation framework

- [ ] **4.0.1** Create `src/validator/types.ts` — `ValidationEntry`, `ValidationResult`, `ValidationCode`, `ValidationPhase`, `Severity`
- [ ] **4.0.2** Create `src/validator/index.ts` — `validate(team, context): ValidationResult` that runs all checkers sequentially, collects all entries (no fail-fast)

#### 4.1 — Phase 1: Registry (9 checks)

- [ ] **4.1.1** Create `src/validator/checks/registry.ts`
- [ ] **4.1.2** Implement: `UNKNOWN_CAPABILITY_TRAIT` (ERROR)
- [ ] **4.1.3** Implement: `UNKNOWN_POLICY_FRAGMENT` (ERROR)
- [ ] **4.1.4** Implement: `UNKNOWN_INSTRUCTION_FRAGMENT` (ERROR)
- [ ] **4.1.5** Implement: `UNKNOWN_SKILL` (ERROR)
- [ ] **4.1.6** Implement: `UNKNOWN_ENVIRONMENT` (ERROR)
- [ ] **4.1.7** Implement: `UNKNOWN_EXTENSION` (ERROR)
- [ ] **4.1.8** Implement: `UNKNOWN_MODEL` (WARNING)
- [ ] **4.1.9** Implement: `UNKNOWN_CAPABILITY_IN_TOOLS` (WARNING)
- [ ] **4.1.10** Implement: `NAMESPACED_BLOCK_MISSING` (ERROR)
- [ ] **4.1.11** Write tests for all 9 checks

#### 4.2 — Phase 2: Traits → Capabilities (5 checks)

- [ ] **4.2.1** Create `src/validator/checks/trait-capability.ts`
- [ ] **4.2.2** Implement: `TRAIT_CAPABILITY_CONFLICT` (ERROR) — same capability granted and denied
- [ ] **4.2.3** Implement: `EXPLICIT_TOOL_DENIED_BY_TRAIT` (ERROR) — explicit tool contradicts trait
- [ ] **4.2.4** Implement: `ORPHAN_DENY_TRAIT` (INFO) — deny for ungranted capability
- [ ] **4.2.5** Implement: `EMPTY_CAPABILITIES` (WARNING) — agent with no capabilities
- [ ] **4.2.6** Implement: `DUPLICATE_TRAIT` (INFO)
- [ ] **4.2.7** Write tests for all 5 checks

#### 4.3 — Phase 3: Capabilities → Tools (2 checks)

- [ ] **4.3.1** Create `src/validator/checks/capability-tools.ts`
- [ ] **4.3.2** Implement: `CAPABILITY_NO_TOOLS_FOR_TARGET` (WARNING)
- [ ] **4.3.3** Implement: `DISALLOWED_TOOL_NOT_IN_GRANTED` (INFO)
- [ ] **4.3.4** Write tests for both checks

#### 4.4 — Phase 4: Policy coherence (9 checks)

- [ ] **4.4.1** Create `src/validator/checks/policy-coherence.ts`
- [ ] **4.4.2** Create `src/validator/conflict-detector.ts` — pattern matching utilities for glob overlap detection
- [ ] **4.4.3** Implement: `POLICY_ALLOW_DENY_CONFLICT` (WARNING)
- [ ] **4.4.4** Implement: `POLICY_ALLOW_ASK_OVERLAP` (INFO)
- [ ] **4.4.5** Implement: `POLICY_ASK_DENY_OVERLAP` (INFO)
- [ ] **4.4.6** Implement: `DUPLICATE_POLICY_FRAGMENT` (INFO)
- [ ] **4.4.7** Implement: `DUPLICATE_POLICY_PATTERN` (INFO)
- [ ] **4.4.8** Implement: `SANDBOX_CONTRADICTION` (WARNING)
- [ ] **4.4.9** Implement: `EMPTY_DENY_RULES` (INFO)
- [ ] **4.4.10** Implement: `POLICY_DENY_SHADOWS_ALLOW` (WARNING)
- [ ] **4.4.11** Implement: `POLICY_ALLOW_NARROWS_DENY` (INFO)
- [ ] **4.4.12** Write tests for all 9 checks + conflict-detector

#### 4.5 — Phase 5: Capabilities ↔ Policies (4 checks)

- [ ] **4.5.1** Create `src/validator/checks/capability-policy.ts`
- [ ] **4.5.2** Implement: `CAPABILITY_FULLY_DENIED` (ERROR)
- [ ] **4.5.3** Implement: `CAPABILITY_PARTIALLY_DENIED` (WARNING)
- [ ] **4.5.4** Implement: `POLICY_ALLOWS_UNGRANTED_TOOL` (INFO)
- [ ] **4.5.5** Implement: `AGENT_LACKS_CAPABILITY_FOR_ALLOWED_PATTERN` (INFO)
- [ ] **4.5.6** Write tests for all 4 checks

#### 4.6 — Phase 8: Team graph (7 checks)

- [ ] **4.6.1** Create `src/validator/checks/team-graph.ts`
- [ ] **4.6.2** Implement: `HANDOFF_TARGET_MISSING` (ERROR)
- [ ] **4.6.3** Implement: `DELEGATION_WITHOUT_CAPABILITY` (ERROR)
- [ ] **4.6.4** Implement: `CIRCULAR_HANDOFF` (ERROR) — DFS cycle detection
- [ ] **4.6.5** Implement: `ORPHAN_AGENT` (WARNING)
- [ ] **4.6.6** Implement: `MULTIPLE_ROOTS` (INFO)
- [ ] **4.6.7** Implement: `HANDOFF_TO_SELF` (ERROR)
- [ ] **4.6.8** Implement: `HANDOFF_CAPABILITY_MISMATCH` (WARNING)
- [ ] **4.6.9** Write tests for all 7 checks

#### 4.7 — Phase 9: Environment (3 checks)

- [ ] **4.7.1** Create `src/validator/checks/environment.ts`
- [ ] **4.7.2** Implement: `ENVIRONMENT_NOT_DETECTED` (WARNING)
- [ ] **4.7.3** Implement: `ENVIRONMENT_DUPLICATE` (INFO)
- [ ] **4.7.4** Implement: `ENVIRONMENT_POLICY_CONFLICT` (WARNING)
- [ ] **4.7.5** Write tests for all 3 checks

#### 4.8 — CLI integration

- [ ] **4.8.1** Update `teamcast validate` CLI command to use new validator
- [ ] **4.8.2** Implement phased CLI output format (see ARCHITECTURE.md §10)
- [ ] **4.8.3** Add `--severity` flag to filter output (e.g., `--severity error` shows only errors)

### Acceptance criteria

- `teamcast validate` runs all implemented phases and reports results
- 39 validation checks implemented and tested (phases 1–5, 8–9)
- CLI output shows phase-by-phase results with icons and suggestions
- All tests pass

---

## Stage 5: Skills as full primitive

**Goal**: `SkillDefinition` with requirements, MCP dependencies, reference files, SKILL.md rendering.

**Dependencies**: Stages 1–4.

**Estimated effort**: 3–4 days.

### Tasks

#### 5.1 — Skill type + registry

- [ ] **5.1.1** Finalize `SkillDefinition` in `src/registry/types.ts` (instructions, reference_files, scripts, required_capabilities, required_mcp_servers, allowed_tools, compatibility, conflicts_with)
- [ ] **5.1.2** Create `src/registry/skills.ts` — convert existing skill-docs to full `SkillDefinition` objects (test-first, clean-code, code-review, security-check, triage, routing, etc.)
- [ ] **5.1.3** Add `required_capabilities` to each builtin skill
- [ ] **5.1.4** Register skills in the default Registry instance

#### 5.2 — Claude skill rendering

- [ ] **5.2.1** Create `src/renderers/claude/skill-renderer.ts` — generates `.claude/skills/{id}/SKILL.md` with proper frontmatter (name, description, allowed-tools)
- [ ] **5.2.2** Handle `reference_files` — write to `.claude/skills/{id}/reference/`
- [ ] **5.2.3** Handle `scripts` — write to `.claude/skills/{id}/scripts/`
- [ ] **5.2.4** Update `src/renderers/claude/index.ts` to use skill-renderer instead of old `skill-md.ts`
- [ ] **5.2.5** Remove old `src/renderers/claude/skill-md.ts`
- [ ] **5.2.6** Write tests for Claude skill rendering

#### 5.2b — Codex skill rendering

- [ ] **5.2b.1** Create `src/renderers/codex/skill-renderer.ts` — generates `{id}/SKILL.md` with frontmatter (name, description)
- [ ] **5.2b.2** Handle `reference_files` — write to `{id}/references/`
- [ ] **5.2b.3** Handle `scripts` — write to `{id}/scripts/`
- [ ] **5.2b.4** Generate `{id}/agents/openai.yaml` — interface metadata, invocation policy, MCP tool dependencies
- [ ] **5.2b.5** Create `src/renderers/codex/config-toml.ts` — generates `.codex/config.toml` with `[agents.*]` definitions, MCP servers, sandbox modes
- [ ] **5.2b.6** Create `src/renderers/codex/agents-md.ts` — generates `AGENTS.md` from instruction fragments and environment rules
- [ ] **5.2b.7** Update `src/renderers/codex/index.ts` to use new skill-renderer, config-toml, agents-md
- [ ] **5.2b.8** Write tests for Codex skill rendering + config.toml + AGENTS.md

#### 5.3 — Inline skill_blocks

- [ ] **5.3.1** Add `skill_blocks` field to `AgentConfig` in `src/manifest/types.ts`
- [ ] **5.3.2** Update JSON Schema to accept `skill_blocks`
- [ ] **5.3.3** Update `normalize.ts` — convert `skill_blocks` to `SkillDefinition` objects with `source: 'user'`
- [ ] **5.3.4** Write tests for inline skill definitions

#### 5.4 — Skill validation (Phase 6: 9 checks)

- [ ] **5.4.1** Create `src/validator/checks/skill-requirements.ts`
- [ ] **5.4.2** Implement: `SKILL_MISSING_CAPABILITY` (ERROR)
- [ ] **5.4.3** Implement: `SKILL_CAPABILITY_DENIED_BY_TRAIT` (ERROR)
- [ ] **5.4.4** Implement: `SKILL_TOOL_FULLY_DENIED` (ERROR)
- [ ] **5.4.5** Implement: `SKILL_TOOL_PARTIALLY_DENIED` (WARNING)
- [ ] **5.4.6** Implement: `SKILL_MISSING_MCP` (ERROR)
- [ ] **5.4.7** Implement: `SKILL_TARGET_INCOMPATIBLE` (WARNING)
- [ ] **5.4.8** Implement: `SKILL_MCP_TARGET_INCOMPATIBLE` (WARNING)
- [ ] **5.4.9** Implement: `SKILL_DUPLICATE` (INFO)
- [ ] **5.4.10** Implement: `SKILL_INSTRUCTION_CONFLICT` (WARNING)
- [ ] **5.4.11** Write tests for all 9 checks

#### 5.5 — MCP validation (Phase 10: 4 checks)

- [ ] **5.5.1** Create `src/validator/checks/mcp.ts`
- [ ] **5.5.2** Implement: `MCP_UNUSED` (INFO)
- [ ] **5.5.3** Implement: `MCP_MISSING_CONFIG` (ERROR)
- [ ] **5.5.4** Implement: `MCP_TARGET_UNSUPPORTED` (WARNING) — note: both Claude and Codex support MCP as of 2026; this check is for future targets that may not
- [ ] **5.5.5** Implement: `MCP_DUPLICATE` (WARNING)
- [ ] **5.5.6** Write tests for all 4 checks

### Acceptance criteria

- Skills are full `SkillDefinition` objects with requirements metadata
- Claude: `.claude/skills/{id}/SKILL.md` generated with proper frontmatter
- Codex: `{id}/SKILL.md` + `agents/openai.yaml` generated
- Codex: `.codex/config.toml` generated with `[agents.*]`, MCP servers, sandbox modes
- Codex: `AGENTS.md` generated from instruction fragments
- Inline `skill_blocks` in YAML supported
- 13 new validation checks implemented and tested (phases 6 + 10)
- All tests pass

---

## Stage 6: Instructions validation + heuristics

**Goal**: Phase 7 — prompt block validation with pattern-based heuristics.

**Dependencies**: Stages 1–5.

**Estimated effort**: 2 days.

### Tasks

#### 6.1 — Instruction fragment metadata

- [ ] **6.1.1** Add `requires_capabilities` field to instruction fragments in `src/registry/instruction-fragments.ts`
- [ ] **6.1.2** Add `conflicts_with` field to instruction fragments
- [ ] **6.1.3** Populate metadata for all existing builtin fragments

#### 6.2 — Phase 7 validation (7 checks)

- [ ] **6.2.1** Create `src/validator/checks/instructions.ts`
- [ ] **6.2.2** Implement: `INSTRUCTION_REQUIRES_MISSING_CAPABILITY` (WARNING)
- [ ] **6.2.3** Implement: `INSTRUCTION_MUTUAL_CONFLICT` (ERROR)
- [ ] **6.2.4** Implement: `INSTRUCTION_DUPLICATE` (INFO)
- [ ] **6.2.5** Implement: `INSTRUCTION_KIND_OVERLOAD` (INFO)
- [ ] **6.2.6** Implement: `INSTRUCTION_EMPTY_CONTENT` (WARNING)
- [ ] **6.2.7** Implement: `INSTRUCTION_CONTRADICTS_CAPABILITY` (WARNING) — heuristic, pattern-based
- [ ] **6.2.8** Implement: `INSTRUCTION_REFERENCES_MISSING_AGENT` (WARNING) — heuristic, pattern-based
- [ ] **6.2.9** Write tests for all 7 checks

#### 6.3 — Heuristic engine

- [ ] **6.3.1** Create `src/validator/heuristics.ts` — contradiction pattern definitions
- [ ] **6.3.2** Add patterns: "do not modify files" + has write_files, "run tests" + no execute, "search the web" + no web, "delegate to X" + X not in handoffs
- [ ] **6.3.3** Write tests for heuristic detection

#### 6.4 — Final CLI polish

- [ ] **6.4.1** All 10 phases now active in `teamcast validate`
- [ ] **6.4.2** Add `--format json` flag for CI integration
- [ ] **6.4.3** Add summary line: `Result: X errors, Y warnings, Z info`
- [ ] **6.4.4** Update `teamcast generate` to run validation before generating (fail on errors, warn on warnings)

### Acceptance criteria

- All 59 validation checks implemented and tested
- `teamcast validate` shows full phased output
- `teamcast generate` runs validation and stops on errors
- Heuristic patterns catch common contradictions
- All tests pass

---

## Stage 7 (future): Extension Packs

**Not part of this refactoring.** Planned for after v2 stabilizes.

- Extension pack format definition
- Namespaced block IDs (`pack-name:block-id`)
- Extension loader (from node_modules or local path)
- Extension validation (Phase 1 `UNKNOWN_EXTENSION`, `NAMESPACED_BLOCK_MISSING`)
- Community registry / discovery

---

## Summary

| Stage | Goal | Effort | Checks |
|-------|------|--------|--------|
| 1 | Registry + renames | 2–3d | — |
| 2 | Single compose-policies | 1d | — |
| 3 | Environments | 1–2d | — |
| 4 | Validation phases 1–5, 8–9 | 4–5d | 39 |
| 5 | Skills as full primitive + Codex renderer | 4–5d | 13 |
| 6 | Instructions + heuristics | 2d | 7 |
| **Total** | | **~15–18d** | **59** |

### Branch strategy

Each stage = its own branch off `main`:
- `refactor/registry-foundation` (Stage 1)
- `refactor/compose-policies` (Stage 2)
- `refactor/environments` (Stage 3)
- `feature/validation-base` (Stage 4)
- `feature/skills-v2` (Stage 5)
- `feature/instruction-validation` (Stage 6)

Merge to `main` after each stage passes CI. Do not accumulate stages in one branch.

### Cleanup checklist (after all stages)

- [ ] Remove `src/plugins/` directory entirely
- [ ] Remove `src/components/` directory entirely
- [ ] Remove all deprecated re-exports
- [ ] Update CLAUDE.md to reflect new architecture
- [ ] Update README.md
- [ ] Bump version to 1.0.0
