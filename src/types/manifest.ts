// All TypeScript interfaces for the agentforge.yaml manifest format

export type ModelAlias = 'opus' | 'sonnet' | 'haiku' | 'inherit';

export type CanonicalTool =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'MultiEdit'
  | 'Grep'
  | 'Glob'
  | 'Bash'
  | 'WebFetch'
  | 'WebSearch'
  | 'Agent';

export type LegacyToolAlias = 'Task';
export type Tool = CanonicalTool | LegacyToolAlias;

export const CLAUDE_CODE_TOOLS: CanonicalTool[] = [
  'Read', 'Write', 'Edit', 'MultiEdit',
  'Grep', 'Glob',
  'Bash',
  'WebFetch', 'WebSearch',
  'Agent',
];

export const COMPAT_CLAUDE_CODE_TOOLS: Tool[] = [...CLAUDE_CODE_TOOLS, 'Task'];

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'dontAsk';

export interface McpServerConfig {
  name: string;
  url: string;
}

export interface ClaudeAgentConfig {
  description: string;
  model?: ModelAlias;
  tools?: CanonicalTool[];
  disallowed_tools?: CanonicalTool[];
  skills?: string[];
  max_turns?: number;
  mcp_servers?: McpServerConfig[];
  permission_mode?: PermissionMode;
  instructions?: string;
  background?: boolean;
}

export interface ForgeAgentMetadata {
  handoffs?: string[];
  role?: string;
  template?: string;
}

export interface AgentConfig {
  claude: ClaudeAgentConfig;
  forge?: ForgeAgentMetadata;
}

export interface LegacyToolsConfigWithAllow {
  allow: Tool[];
  deny?: Tool[];
}

export interface LegacyToolsConfigDenyOnly {
  deny: Tool[];
}

export type LegacyToolsConfig = LegacyToolsConfigWithAllow | LegacyToolsConfigDenyOnly;

export interface LegacyAgentConfig {
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

export type AgentDefinition = AgentConfig | LegacyAgentConfig;

export function isCanonicalAgentConfig(agent: AgentDefinition): agent is AgentConfig {
  return 'claude' in agent;
}

export function isLegacyToolsConfigWithAllow(
  tools: LegacyToolsConfig,
): tools is LegacyToolsConfigWithAllow {
  return 'allow' in tools;
}

function dedupeTools(tools: Tool[] | undefined): CanonicalTool[] | undefined {
  if (!tools?.length) return undefined;

  const normalized: CanonicalTool[] = [];
  for (const tool of tools) {
    const canonical = tool === 'Task' ? 'Agent' : tool;
    if (!normalized.includes(canonical)) {
      normalized.push(canonical);
    }
  }

  return normalized;
}

export function getClaudeConfig(agent: AgentDefinition): ClaudeAgentConfig {
  if (isCanonicalAgentConfig(agent)) {
    return agent.claude;
  }

  const allowTools =
    agent.tools && isLegacyToolsConfigWithAllow(agent.tools)
      ? dedupeTools(agent.tools.allow)
      : undefined;
  const deniedTools = agent.tools
    ? dedupeTools(agent.tools.deny)
    : undefined;

  return {
    description: agent.description,
    model: agent.model,
    tools: allowTools,
    disallowed_tools: deniedTools,
    skills: agent.skills ? [...agent.skills] : undefined,
    max_turns: agent.max_turns,
    mcp_servers: agent.mcp_servers ? agent.mcp_servers.map((server) => ({ ...server })) : undefined,
    permission_mode: agent.permission_mode,
    instructions: agent.behavior,
    background: agent.background,
  };
}

export function getForgeConfig(agent: AgentDefinition): ForgeAgentMetadata | undefined {
  if (isCanonicalAgentConfig(agent)) {
    return agent.forge
      ? {
          handoffs: agent.forge.handoffs ? [...agent.forge.handoffs] : undefined,
          role: agent.forge.role,
          template: agent.forge.template,
        }
      : undefined;
  }

  if (!agent.handoffs?.length) return undefined;
  return { handoffs: [...agent.handoffs] };
}

export function normalizeLegacyAgentConfig(agent: AgentDefinition): AgentConfig {
  const claude = getClaudeConfig(agent);
  const forge = getForgeConfig(agent);

  return {
    claude: {
      ...claude,
      tools: claude.tools ? [...claude.tools] : undefined,
      disallowed_tools: claude.disallowed_tools ? [...claude.disallowed_tools] : undefined,
      skills: claude.skills ? [...claude.skills] : undefined,
      mcp_servers: claude.mcp_servers ? claude.mcp_servers.map((server) => ({ ...server })) : undefined,
    },
    forge,
  };
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

export interface PresetMeta {
  author?: string;
  tags?: string[];
  min_version?: string;
}

export interface AgentForgeManifest {
  version: '1';
  project: ProjectConfig;
  agents: Record<string, AgentDefinition>;
  policies?: PoliciesConfig;
  settings?: GenerationSettings;
  preset_meta?: PresetMeta;
}

export interface NormalizedAgentForgeManifest
  extends Omit<AgentForgeManifest, 'agents'> {
  agents: Record<string, AgentConfig>;
}

export function normalizeManifest(manifest: AgentForgeManifest): NormalizedAgentForgeManifest {
  return {
    ...manifest,
    agents: Object.fromEntries(
      Object.entries(manifest.agents).map(([agentId, agent]) => [agentId, normalizeLegacyAgentConfig(agent)]),
    ),
  };
}
