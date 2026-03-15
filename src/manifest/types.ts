import type { InstructionBlock, InstructionBlockKind } from '../core/instructions.js';
import type {
  ReasoningEffort,
  PermissionMode,
  McpServerConfig,
  HookEntry,
} from '../core/types.js';
import type { CapabilityId, CapabilityTraitId, InstructionFragmentId, PolicyFragmentId } from '../registry/types.js';
import type { PolicyAssertion } from '../core/assertions.js';

export interface ManifestInstructionBlock {
  kind: InstructionBlockKind;
  title?: string;
  content: string;
}

export interface ManifestSkillBlock {
  name: string;
  description: string;
  instructions: string;
  allowed_tools?: string[];
}

export interface BaseAgentConfig {
  description: string;
  /** Target-native model identifier (e.g. Claude alias or Codex model name). */
  model?: string;
  /** Target-native reasoning level for renderers that support it. */
  reasoning_effort?: ReasoningEffort;
  capability_traits?: CapabilityTraitId[];
  /** Accepts CapabilityId values (e.g. 'read_files') or specific tool names for the target renderer. */
  tools?: Array<CapabilityId | string>;
  disallowed_tools?: Array<CapabilityId | string>;
  /** Free-form skill documentation references (e.g. 'test-first', 'clean-code'). */
  skills?: string[];
  max_turns?: number;
  mcp_servers?: McpServerConfig[];
  permission_mode?: PermissionMode;
  instruction_fragments?: InstructionFragmentId[];
  instruction_blocks?: ManifestInstructionBlock[];
  skill_blocks?: ManifestSkillBlock[];
  background?: boolean;
}

export interface ForgeAgentMetadata {
  handoffs?: string[];
  role?: string;
  template?: string;
}

export interface AgentConfig extends BaseAgentConfig {
  forge?: ForgeAgentMetadata;
}

export interface TargetConfig {
  agents: Record<string, AgentConfig>;
  policies?: PoliciesConfig;
  settings?: GenerationSettings;
}

export interface PermissionsConfig {
  allow?: string[];
  ask?: string[];
  deny?: string[];
  default_mode?: 'default' | 'acceptEdits';
  rules?: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
  };
}

export interface SandboxConfig {
  enabled?: boolean;
  auto_allow_bash?: boolean;
  excluded_commands?: string[];
  network?: {
    allow_unix_sockets?: string[];
    allow_local_binding?: boolean;
  };
}

export interface HooksConfig {
  pre_tool_use?: HookEntry[];
  post_tool_use?: HookEntry[];
  notification?: HookEntry[];
}

export interface NetworkConfig {
  allowed_domains?: string[];
}

export interface PoliciesConfig {
  fragments?: PolicyFragmentId[];
  permissions?: PermissionsConfig;
  sandbox?: SandboxConfig;
  hooks?: HooksConfig;
  network?: NetworkConfig;
  assertions?: PolicyAssertion[];
}

export interface GenerationSettings {
  generate_docs?: boolean;
  generate_local_settings?: boolean;
}

export interface ProjectConfig {
  name: string;
  preset?: string;
  description?: string;
  environments?: string[];
}

export interface PresetMeta {
  author?: string;
  tags?: string[];
  min_version?: string;
}

export interface TeamCastManifest {
  version: '2';
  project: ProjectConfig;
  preset_meta?: PresetMeta;

  // Platform Targets
  claude?: TargetConfig;
  codex?: TargetConfig;
}

export function isInstructionBlock(value: InstructionBlock | ManifestInstructionBlock): value is ManifestInstructionBlock {
  return typeof value.kind === 'string' && typeof value.content === 'string';
}
