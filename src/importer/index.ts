import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parse } from 'yaml';
import type {
  AgentConfig,
  AgentForgeManifest,
  CanonicalTool,
  HooksConfig,
  McpServerConfig,
  ModelAlias,
  PermissionMode,
  PoliciesConfig,
} from '../types/manifest.js';
import { CLAUDE_CODE_TOOLS, COMPAT_CLAUDE_CODE_TOOLS } from '../types/manifest.js';

const LEGACY_MODEL_ID_MAP: Record<string, Exclude<ModelAlias, 'inherit'>> = {
  'claude-opus-4-6': 'opus',
  'claude-sonnet-4-6': 'sonnet',
  'claude-haiku-4-5-20251001': 'haiku',
};

interface ImportWarning {
  file: string;
  message: string;
}

interface ImportResult {
  manifest: AgentForgeManifest;
  warnings: ImportWarning[];
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const parsed = parse(match[1]);
  if (parsed && typeof parsed === 'object') {
    return parsed as Record<string, unknown>;
  }

  return {};
}

function extractBody(content: string): string | undefined {
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n\n?([\s\S]*)/);
  if (!bodyMatch) return undefined;

  const body = bodyMatch[1].trim();
  return body || undefined;
}

function stripLegacyGeneratedSections(body: string | undefined): string | undefined {
  if (!body) return undefined;

  let nextBody = body;
  const generatedSections = ['## Skills', '## Delegation', '## Constraints'];
  let changed = false;

  for (const section of generatedSections) {
    const sectionIndex = nextBody.indexOf(section);
    if (sectionIndex !== -1) {
      changed = true;
      const nextSection = nextBody.indexOf('\n## ', sectionIndex + section.length);
      if (nextSection !== -1) {
        nextBody = nextBody.slice(0, sectionIndex) + nextBody.slice(nextSection);
      } else {
        nextBody = nextBody.slice(0, sectionIndex);
      }
    }
  }

  nextBody = nextBody.trim();
  return changed ? nextBody || undefined : body;
}

function inferLegacyHandoffs(body: string | undefined): string[] | undefined {
  if (!body?.includes('## Delegation')) return undefined;

  const match = body.match(
    /## Delegation\s+You can delegate tasks to the following agents:\s+([a-z0-9,\- ]+)\./i,
  );
  if (!match) return undefined;

  const values = match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

function resolveModelAlias(modelValue: unknown): ModelAlias | undefined {
  if (typeof modelValue !== 'string' || modelValue.length === 0) return undefined;
  if (modelValue === 'inherit' || modelValue === 'opus' || modelValue === 'sonnet' || modelValue === 'haiku') {
    return modelValue;
  }

  return LEGACY_MODEL_ID_MAP[modelValue];
}

function parseToolList(value: unknown): CanonicalTool[] | undefined {
  const rawTools = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

  if (rawTools.length === 0) return undefined;

  const tools: CanonicalTool[] = [];
  for (const tool of rawTools) {
    if (!COMPAT_CLAUDE_CODE_TOOLS.includes(tool as CanonicalTool | 'Task')) continue;
    const canonical = tool === 'Task' ? 'Agent' : tool;
    if (!CLAUDE_CODE_TOOLS.includes(canonical as CanonicalTool)) continue;
    if (!tools.includes(canonical as CanonicalTool)) {
      tools.push(canonical as CanonicalTool);
    }
  }

  return tools.length > 0 ? tools : undefined;
}

function parseSkillList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const skills = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return skills.length > 0 ? skills : undefined;
}

function parsePermissionMode(value: unknown): PermissionMode | undefined {
  if (typeof value !== 'string') return undefined;
  const modes: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk'];
  return modes.includes(value as PermissionMode) ? (value as PermissionMode) : undefined;
}

function parseMcpServers(value: unknown): McpServerConfig[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const servers = value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : '',
      url: typeof item.url === 'string' ? item.url : '',
    }))
    .filter((item) => item.name.length > 0 && item.url.length > 0);

  return servers.length > 0 ? servers : undefined;
}

function parseAgentFile(filePath: string): { name: string; config: AgentConfig; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const fields = parseFrontmatter(content);
  const fileName = basename(filePath, '.md');
  const name = typeof fields.name === 'string' && fields.name.length > 0 ? fields.name : fileName;

  const model = resolveModelAlias(fields.model);
  const tools = parseToolList(fields.tools);
  const disallowedTools = parseToolList(fields.disallowedTools);
  const permissionMode = parsePermissionMode(fields.permissionMode);
  const maxTurns = typeof fields.maxTurns === 'number' ? fields.maxTurns : undefined;
  const background = typeof fields.background === 'boolean' ? fields.background : undefined;
  const skills = parseSkillList(fields.skills);
  const mcpServers = parseMcpServers(fields.mcpServers);

  if (fields.model && !model) {
    warnings.push({ file: filePath, message: `Unknown model "${String(fields.model)}", skipping model field` });
  }
  if (fields.permissionMode && !permissionMode) {
    warnings.push({
      file: filePath,
      message: `Unknown permissionMode "${String(fields.permissionMode)}", skipping`,
    });
  }

  const originalBody = extractBody(content);
  const instructions = stripLegacyGeneratedSections(originalBody);
  const legacyHandoffs = inferLegacyHandoffs(originalBody);

  return {
    name,
    config: {
      claude: {
        description:
          typeof fields.description === 'string' && fields.description.length > 0
            ? fields.description
            : `Imported from ${fileName}.md`,
        model,
        tools,
        disallowed_tools: disallowedTools,
        permission_mode: permissionMode,
        max_turns: maxTurns,
        skills,
        mcp_servers: mcpServers,
        instructions,
        background,
      },
      forge: legacyHandoffs?.length ? { handoffs: legacyHandoffs } : undefined,
    },
    warnings,
  };
}

function parseSettingsJson(filePath: string): { policies: PoliciesConfig; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const content = readFileSync(filePath, 'utf-8');
  let settings: Record<string, unknown>;

  try {
    settings = JSON.parse(content);
  } catch {
    warnings.push({ file: filePath, message: 'Failed to parse settings.json' });
    return { policies: {}, warnings };
  }

  const policies: PoliciesConfig = {};

  const perms = settings.permissions as Record<string, unknown> | undefined;
  if (perms) {
    policies.permissions = {};
    if (Array.isArray(perms.allow)) policies.permissions.allow = perms.allow;
    if (Array.isArray(perms.ask)) policies.permissions.ask = perms.ask;
    if (Array.isArray(perms.deny)) policies.permissions.deny = perms.deny;
    if (perms.defaultMode && typeof perms.defaultMode === 'string') {
      policies.permissions.default_mode = perms.defaultMode as 'default' | 'acceptEdits';
    }
  }

  const sandbox = settings.sandbox as Record<string, unknown> | undefined;
  if (sandbox) {
    policies.sandbox = {};
    if (typeof sandbox.enabled === 'boolean') policies.sandbox.enabled = sandbox.enabled;
    if (typeof sandbox.autoAllowBashIfSandboxed === 'boolean') {
      policies.sandbox.auto_allow_bash = sandbox.autoAllowBashIfSandboxed;
    }
    if (Array.isArray(sandbox.excludedCommands)) {
      policies.sandbox.excluded_commands = sandbox.excludedCommands;
    }
    const network = sandbox.network as Record<string, unknown> | undefined;
    if (network) {
      policies.sandbox.network = {};
      if (Array.isArray(network.allowUnixSockets)) {
        policies.sandbox.network.allow_unix_sockets = network.allowUnixSockets;
      }
      if (typeof network.allowLocalBinding === 'boolean') {
        policies.sandbox.network.allow_local_binding = network.allowLocalBinding;
      }
    }
  }

  const hooks = settings.hooks as Record<string, unknown> | undefined;
  if (hooks) {
    const hooksConfig: HooksConfig = {};

    const parseHookEntries = (entries: unknown[]) =>
      entries
        .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
        .map((entry) => ({
          matcher: String(entry.matcher ?? ''),
          command: Array.isArray(entry.hooks)
            ? String((entry.hooks[0] as Record<string, unknown>)?.command ?? '')
            : '',
        }))
        .filter((entry) => entry.matcher && entry.command);

    if (Array.isArray(hooks.PreToolUse)) {
      hooksConfig.pre_tool_use = parseHookEntries(hooks.PreToolUse);
    }
    if (Array.isArray(hooks.PostToolUse)) {
      hooksConfig.post_tool_use = parseHookEntries(hooks.PostToolUse);
    }
    if (Array.isArray(hooks.Notification)) {
      hooksConfig.notification = parseHookEntries(hooks.Notification);
    }

    if (hooksConfig.pre_tool_use?.length || hooksConfig.post_tool_use?.length || hooksConfig.notification?.length) {
      policies.hooks = hooksConfig;
    }
  }

  return { policies, warnings };
}

export function importFromClaudeDir(cwd: string, projectName: string): ImportResult {
  const warnings: ImportWarning[] = [];
  const agents: Record<string, AgentConfig> = {};

  const agentsDir = join(cwd, '.claude', 'agents');
  if (existsSync(agentsDir)) {
    const files = readdirSync(agentsDir).filter((file) => file.endsWith('.md'));
    for (const file of files) {
      const filePath = join(agentsDir, file);
      const result = parseAgentFile(filePath);
      agents[result.name] = result.config;
      warnings.push(...result.warnings);
    }
  }

  if (Object.keys(agents).length === 0) {
    warnings.push({ file: agentsDir, message: 'No agent .md files found in .claude/agents/' });
  }

  let policies: PoliciesConfig | undefined;
  const settingsPath = join(cwd, '.claude', 'settings.json');
  if (existsSync(settingsPath)) {
    const result = parseSettingsJson(settingsPath);
    policies = result.policies;
    warnings.push(...result.warnings);
    if (!policies.permissions && !policies.sandbox && !policies.hooks) {
      policies = undefined;
    }
  }

  const manifest: AgentForgeManifest = {
    version: '1',
    project: { name: projectName },
    agents,
  };

  if (policies) {
    manifest.policies = policies;
  }

  return { manifest, warnings };
}
