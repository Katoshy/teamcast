// Public barrel file for TeamCast types and utilities.
// Consumers should import from this path rather than from internal modules.

// ── Core types (platform-agnostic) ──────────────────────────────────────────
// Fully-normalized structures produced after all legacy coercion and default
// application. The core layer has no dependency on the manifest/ or renderer/
// layers.
export type {
  HookEntry,
  McpServerConfig,
  ModelAlias,
  PermissionMode,
  CoreAgent,
  CoreTeam as NormalizedTeamCastManifest,
  TeamPolicies,
  TeamSettings,
  ProjectConfig as CoreProjectConfig,
  PresetMetadata as CorePresetMetadata,
} from '../core/types.js';

export type {
  InstructionBlock,
  InstructionBlockKind,
} from '../core/instructions.js';

export {
  normalizeInstructionBlocks,
  renderInstructionBlocks,
} from '../core/instructions.js';

// ── Skill types ──────────────────────────────────────────────────────────────
// Abstract capability skills that map to one or more CanonicalTools.
export { AGENT_SKILLS, isAgentSkill } from '../core/skills.js';
export type { AgentSkill } from '../core/skills.js';

// ── Claude renderer types ────────────────────────────────────────────────────
// Tool types and constants used by the Claude-specific file renderers.
export type { CanonicalTool } from '../renderers/claude/tools.js';
export { CLAUDE_CODE_TOOLS, COMPAT_CLAUDE_CODE_TOOLS } from '../renderers/claude/tools.js';

// ── Manifest types (YAML schema) ─────────────────────────────────────────────
// Raw types matching the teamcast.yaml structure, including both current (V2)
// and legacy (V1) agent config shapes.
export type {
  AgentConfigV2 as AgentConfig,
  AgentDefinition,
  TeamCastManifest,
  TeamCastManifestV1,
  TeamCastManifestV2,
  ClaudeAgentConfigV2 as ClaudeAgentConfig,
  ForgeAgentMetadataV2 as ForgeAgentMetadata,
  GenerationSettings,
  HooksConfig,
  LegacyAgentConfigV1 as LegacyAgentConfig,
  LegacyToolAlias,
  LegacyToolsConfig,
  LegacyToolsConfigDenyOnly,
  LegacyToolsConfigWithAllow,
  NetworkConfig,
  PermissionsConfig,
  PoliciesConfig,
  PresetMeta,
  ProjectConfig,
  SandboxConfig,
  Tool,
} from '../manifest/types.js';

// ── Normalization utilities ──────────────────────────────────────────────────
// Functions to convert a raw TeamCastManifest into a fully-resolved CoreTeam,
// and back again for serialization.
export { normalizeManifest, denormalizeManifest } from '../manifest/normalize.js';

// ── Backward compatibility ───────────────────────────────────────────────────
// Helpers for consuming AgentDefinition values that may still be in legacy
// (V1) format. Use these when you cannot guarantee the manifest version.
export {
  isCanonicalAgentConfig,
  normalizeLegacyAgentConfig,
  getClaudeConfig,
  getForgeConfig,
} from '../manifest/compat.js';
