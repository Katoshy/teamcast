// All TypeScript interfaces for the agentforge.yaml manifest format

export type ModelAlias = 'opus' | 'sonnet' | 'haiku' | 'inherit';

export type Tool =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'MultiEdit'
  | 'Grep'
  | 'Glob'
  | 'Bash'
  | 'WebFetch'
  | 'WebSearch'
  | 'Task';

export const CLAUDE_CODE_TOOLS: Tool[] = [
  'Read', 'Write', 'Edit', 'MultiEdit',
  'Grep', 'Glob',
  'Bash',
  'WebFetch', 'WebSearch',
  'Task',
];

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

export interface ToolsConfigWithAllow {
  allow: Tool[];
  deny?: Tool[];
}

export interface ToolsConfigDenyOnly {
  deny: Tool[];
}

export type ToolsConfig = ToolsConfigWithAllow | ToolsConfigDenyOnly;

export function hasAllowList(tools: ToolsConfig): tools is ToolsConfigWithAllow {
  return 'allow' in tools;
}

export interface McpServerConfig {
  name: string;
  url: string;
}

export interface AgentConfig {
  description: string;
  model?: ModelAlias;
  tools?: ToolsConfig;
  skills?: string[];
  handoffs?: string[];
  max_turns?: number;
  mcp_servers?: McpServerConfig[];
  permission_mode?: PermissionMode;
  behavior?: string;
}

export interface PermissionsConfig {
  allow?: string[];
  ask?: string[];
  deny?: string[];
  default_mode?: 'default' | 'acceptEdits';
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

export interface HookEntry {
  matcher: string;
  command: string;
  async?: boolean;
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
  permissions?: PermissionsConfig;
  sandbox?: SandboxConfig;
  hooks?: HooksConfig;
  network?: NetworkConfig;
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

export interface AgentForgeManifest {
  version: '1';
  project: ProjectConfig;
  agents: Record<string, AgentConfig>;
  policies?: PoliciesConfig;
  settings?: GenerationSettings;
}

// Model alias → Claude Code model ID mapping
export const MODEL_ID_MAP: Record<Exclude<ModelAlias, 'inherit'>, string> = {
  opus:   'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
};
