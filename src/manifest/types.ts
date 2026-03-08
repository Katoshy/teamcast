import type { InstructionBlock, InstructionBlockKind } from '../core/instructions.js';
import type {
  AbstractPermission,
  HookEntry,
  McpServerConfig,
  ModelAlias,
  PermissionMode,
} from '../core/types.js';
import type { CanonicalTool } from '../renderers/claude/tools.js';
import type { AgentSkill } from '../core/skills.js';
import type {
  CapabilityTraitName,
  InstructionFragmentName,
} from '../components/agent-fragments.js';
import type { PolicyFragmentName } from '../components/policy-fragments.js';
import type { PolicyAssertion } from '../core/assertions.js';

export type LegacyToolAlias = 'Task';
export type Tool = CanonicalTool | LegacyToolAlias;

export interface ManifestInstructionBlock {
  kind: InstructionBlockKind;
  title?: string;
  content: string;
}

export interface ClaudeAgentConfigV2 {
  description: string;
  model?: ModelAlias;
  capability_traits?: CapabilityTraitName[];
  /** Accepts AgentSkill values (e.g. 'read_files') or CanonicalTool values for backward compat. */
  tools?: Array<AgentSkill | CanonicalTool>;
  disallowed_tools?: Array<AgentSkill | CanonicalTool>;
  /** Free-form skill documentation references (e.g. 'test-first', 'clean-code'). */
  skills?: string[];
  max_turns?: number;
  mcp_servers?: McpServerConfig[];
  permission_mode?: PermissionMode;
  instruction_fragments?: InstructionFragmentName[];
  instruction_blocks?: ManifestInstructionBlock[];
  background?: boolean;
}

export interface ForgeAgentMetadataV2 {
  handoffs?: string[];
  role?: string;
  template?: string;
}

export interface AgentConfigV2 {
  claude: ClaudeAgentConfigV2;
  forge?: ForgeAgentMetadataV2;
}

export interface LegacyToolsConfigWithAllow {
  allow: Tool[];
  deny?: Tool[];
}

export interface LegacyToolsConfigDenyOnly {
  deny: Tool[];
}

export type LegacyToolsConfig = LegacyToolsConfigWithAllow | LegacyToolsConfigDenyOnly;

export interface LegacyAgentConfigV1 {
  description: string;
  model?: ModelAlias;
  tools?: LegacyToolsConfig;
  skills?: string[];
  handoffs?: string[];
  max_turns?: number;
  mcp_servers?: McpServerConfig[];
  permission_mode?: PermissionMode;
  behavior?: string;
  background?: boolean;
}

export interface CanonicalAgentConfigV1 {
  claude: {
    description: string;
    model?: ModelAlias;
    tools?: Array<AgentSkill | CanonicalTool>;
    disallowed_tools?: Array<AgentSkill | CanonicalTool>;
    skills?: string[];
    max_turns?: number;
    mcp_servers?: McpServerConfig[];
    permission_mode?: PermissionMode;
    instructions?: string;
    background?: boolean;
  };
  forge?: {
    handoffs?: string[];
    role?: string;
    template?: string;
  };
}

export type AgentDefinitionV1 = LegacyAgentConfigV1 | CanonicalAgentConfigV1;
export type AgentDefinition = AgentConfigV2 | AgentDefinitionV1;

export interface PermissionsConfig {
  allow?: Array<AbstractPermission | string>;
  ask?: Array<AbstractPermission | string>;
  deny?: Array<AbstractPermission | string>;
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
  fragments?: PolicyFragmentName[];
  permissions?: PermissionsConfig;
  sandbox?: SandboxConfig;
  hooks?: HooksConfig;
  network?: NetworkConfig;
  assertions?: PolicyAssertion[];
}

export interface GenerationSettings {
  default_model?: ModelAlias;
  generate_docs?: boolean;
  generate_local_settings?: boolean;
}

export interface ProjectConfig {
  name: string;
  preset?: string;
  description?: string;
}

export interface PresetMeta {
  author?: string;
  tags?: string[];
  min_version?: string;
}

export interface AgentForgeManifestV2 {
  version: '2';
  project: ProjectConfig;
  agents: Record<string, AgentConfigV2>;
  policies?: PoliciesConfig;
  settings?: GenerationSettings;
  preset_meta?: PresetMeta;
}

export interface AgentForgeManifestV1 {
  version: '1';
  project: ProjectConfig;
  agents: Record<string, AgentDefinitionV1>;
  policies?: PoliciesConfig;
  settings?: GenerationSettings;
  preset_meta?: PresetMeta;
}

export type AgentForgeManifest = AgentForgeManifestV1 | AgentForgeManifestV2;

export function isInstructionBlock(value: InstructionBlock | ManifestInstructionBlock): value is ManifestInstructionBlock {
  return typeof value.kind === 'string' && typeof value.content === 'string';
}
