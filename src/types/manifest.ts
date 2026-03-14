// Public barrel file for TeamCast types and utilities.
// Consumers should import from this path rather than from internal modules.

// Core types
// Fully-normalized structures produced after defaults and target-specific
// normalization. The core layer has no dependency on manifest/ or renderer/.
export type {
  HookEntry,
  McpServerConfig,
  PermissionMode,
  ReasoningEffort,
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

// Capability types
// Abstract capabilities that map to renderer-specific tool tokens.
export { CAPABILITY_IDS, isCapability } from '../registry/capabilities.js';
export type { CapabilityId } from '../registry/types.js';

// Backward-compat aliases (deprecated)
export { CAPABILITY_IDS as AGENT_SKILLS, isCapability as isAgentSkill } from '../registry/capabilities.js';
export type { CapabilityId as AgentSkill } from '../registry/types.js';

// Renderers and targets
export type { TargetContext } from '../renderers/target-context.js';
export { getTarget, getDefaultTarget } from '../renderers/registry.js';

// Claude renderer types
export type { CanonicalTool } from '../renderers/claude/tools.js';
export { CLAUDE_CODE_TOOLS } from '../renderers/claude/tools.js';

// Codex renderer types
export type { CodexTool } from '../renderers/codex/tools.js';
export { CODEX_TOOLS } from '../renderers/codex/tools.js';

// Manifest types
// Types matching the current teamcast.yaml structure.
export type {
  AgentConfig,
  ForgeAgentMetadata,
  GenerationSettings,
  HooksConfig,
  NetworkConfig,
  PermissionsConfig,
  PoliciesConfig,
  PresetMeta,
  ProjectConfig,
  SandboxConfig,
  TeamCastManifest,
} from '../manifest/types.js';

// Normalization utilities
// Functions to convert a raw TeamCastManifest into a fully-resolved CoreTeam,
// and back again for serialization.
export {
  normalizeManifest,
  denormalizeTarget,
  createManifestForTarget,
  replaceManifestTarget,
} from '../manifest/normalize.js';
