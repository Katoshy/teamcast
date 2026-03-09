# TeamCast — Sprints

## Status
v0.1 ✅ Generator · v0.2 ✅ Validator · v0.3 ✅ Core UX · v0.4 ✅ Import + Hooks · v0.5 ✅ Custom presets · v0.6 ✅ Modular core

---

## v0.3 — Complete core UX ✅
> Goal: wizard and CLI match the concept doc

- [x] Auto-validate after `generate`
- [x] `reset` / `clean` commands
- [x] `edit agent <name>`
- [x] Wizard: customize agents after preset selection
- [x] Wizard: "Build custom team" path (role checkbox)

---

## v0.4 — Import + Hooks ✅
> Goal: round-trip support and hooks in settings.json

- [x] `import` — scan `.claude/` → write `teamcast.yaml`
- [x] Hooks renderer — complete `settings.json` hooks section

---

## v0.5 — Custom presets ✅
> Goal: users can create and share presets

- [x] `init --from <path>` — use any local YAML as preset
- [x] `add skill <name>` wizard
- [x] `preset_meta` schema groundwork for future registry

---

## v0.6 — Modular core + abstract skills ✅
> Goal: decouple from Claude-specific internals, introduce modular layered architecture with abstract skill system

- [x] Introduce internal IR layer (CoreTeam/CoreAgent) decoupled from `.claude/` file structure
- [x] Split "semantic manifest model" from "Claude renderer" in code architecture
  - `src/core/` — platform-agnostic types, skills, instructions, permissions, guards
  - `src/components/` — reusable agent/policy fragments
  - `src/renderers/claude/` — Claude Code-specific renderer
  - `src/application/` — team operations and validation orchestration
- [x] Define abstract AgentSkill vocabulary (read_files, write_files, execute, search, web, delegate, interact, notebook)
- [x] Implement skill-to-tool expansion via renderer skill maps
- [x] Normalize policy model: validation runs on CoreTeam IR before render
- [x] Centralize isCoreTeam type guard, unify validation path
- [x] Make validator extensible with `extraCheckers` parameter
- [x] Update importer: reverse-map tools → abstract skills
- [x] Update explainer: show skills, instruction blocks, permissions
- [x] Update wizard: skill-based tool selection with human-readable labels
- [x] Clean up: delete generator shim wrappers, reorganize types barrel
- [ ] ~~`generate --target <name>` abstraction~~ — deferred (single-target focus for now)
- [ ] ~~Target-aware diagnostics~~ — deferred

---

## v0.7 — Codex backend
> Goal: support a second real ecosystem and prove the compiler model

- [ ] Add `codex` renderer backend
- [ ] Map core manifest concepts into Codex-compatible project outputs
- [ ] Add downgrade/warning system when Claude-specific concepts cannot be preserved exactly in Codex
- [ ] Add `import --from codex` groundwork for existing Codex-configured repos
- [ ] Add integration fixtures that compare manifest intent vs rendered Codex output
- [ ] Document capability gaps between `claude` and `codex`

---

## v0.8 — Portability + round-trip intelligence
> Goal: make cross-target migration and drift visible instead of implicit

- [ ] `explain portability` command: show what transfers cleanly across targets and what does not
- [ ] `diff --target <name>` command: compare manifest intent with rendered target output
- [ ] Semantic drift detection between imported project files and canonical manifest
- [ ] Round-trip tests for `manifest -> target -> import -> manifest`
- [ ] Loss report in generate output: preserved / approximated / dropped fields
- [ ] Import support for existing Claude projects and first-pass Codex projects into one canonical manifest

---

## v0.9 — Policy engine + conformance
> Goal: make TeamCast useful as a safety and governance layer, not only as a renderer

- [ ] Cross-target policy engine for filesystem, shell, network, approval, and delegation constraints
- [ ] Conformance checks for role separation, unsafe tool combinations, and policy conflicts
- [ ] Capability-aware validation rules per target with shared semantic checks
- [ ] Config linting for risky patterns: overpowered agents, missing denylists, ambiguous handoffs
- [ ] Team-level assertions: "developer cannot access network", "reviewer cannot write", etc.
- [ ] Machine-readable validation output for CI usage

---

## v1.0 — Portable agent architecture platform
> Goal: one canonical manifest that can reliably describe and validate coding-agent teams across ecosystems

- [ ] Stable manifest spec versioning and migration story
- [ ] Official target support matrix with compatibility guarantees
- [ ] Portable preset format built on the canonical manifest, not on Claude-only defaults
- [ ] Reference examples for common team topologies across multiple targets
- [ ] Import/generate/validate workflow documented as the primary product story
- [ ] Position TeamCast as compiler + validator for coding-agent architectures

---

## Later / optional
- Community registry: `search`, `install`, `publish`
- VS Code extension
- Agent Teams (Swarms) support
