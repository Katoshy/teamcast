import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parse } from 'yaml';
import type {
  CoreAgent,
  CoreTeam,
  HookEntry,
  McpServerConfig,
  ModelAlias,
  PermissionMode,
  TeamPolicies,
} from '../core/types.js';
import { CLAUDE_CODE_TOOLS } from '../renderers/claude/tools.js';
import type { CanonicalTool } from '../renderers/claude/tools.js';
import { reverseMapToolsToSkills } from '../renderers/claude/skill-map.js';
import { normalizePermissionTokens } from '../core/permissions.js';

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
  team: CoreTeam;
  warnings: ImportWarning[];
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const parsed = parse(match[1]);
  if (parsed && typeof parsed === 'object') {
    return parsed as Record<string, unknown>;
  }

  return {};
}

function extractBody(content: string): string | undefined {
  const bodyMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n\r?\n?([\s\S]*)/);
  if (!bodyMatch) return undefined;

  const body = bodyMatch[1].trim();
  return body || undefined;
}

function stripLegacyGeneratedSections(body: string | undefined): string | undefined {
  if (!body) return undefined;

  let nextBody = body;
  const generatedSections = ['## Skills', '## Delegation', '## Constraints'];

  for (const section of generatedSections) {
    const sectionIndex = nextBody.indexOf(section);
    if (sectionIndex !== -1) {
      const nextSection = nextBody.indexOf('\n## ', sectionIndex + section.length);
      nextBody = nextSection !== -1
        ? nextBody.slice(0, sectionIndex) + nextBody.slice(nextSection)
        : nextBody.slice(0, sectionIndex);
    }
  }

  return nextBody.trim() || undefined;
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

function isCanonicalTool(value: string): value is CanonicalTool {
  return CLAUDE_CODE_TOOLS.includes(value as CanonicalTool);
}

function parseToolList(value: unknown): CanonicalTool[] | undefined {
  const rawTools = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

  if (rawTools.length === 0) return undefined;

  const tools: CanonicalTool[] = [];
  for (const raw of rawTools) {
    const canonical = raw === 'Task' ? 'Agent' : raw;
    if (isCanonicalTool(canonical) && !tools.includes(canonical)) {
      tools.push(canonical);
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

function parseAgentFile(filePath: string): { name: string; agent: CoreAgent; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const fields = parseFrontmatter(content);
  const fileName = basename(filePath, '.md');
  const name = typeof fields.name === 'string' && fields.name.length > 0 ? fields.name : fileName;

  const model = resolveModelAlias(fields.model);
  const rawTools = parseToolList(fields.tools);
  const tools: string[] | undefined = rawTools
    ? (() => {
        const { skills, remainingTools } = reverseMapToolsToSkills(rawTools);
        return [...skills, ...remainingTools];
      })()
    : undefined;
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
    agent: {
      id: name,
      description:
        typeof fields.description === 'string' && fields.description.length > 0
          ? fields.description
          : `Imported from ${fileName}.md`,
      runtime: {
        model,
        tools,
        disallowedTools,
        permissionMode,
        maxTurns,
        skills,
        mcpServers,
        background,
      },
      instructions: instructions
        ? [{ kind: 'behavior', content: instructions }]
        : [],
      metadata: legacyHandoffs?.length ? { handoffs: legacyHandoffs } : undefined,
    },
    warnings,
  };
}

function parseSettingsJson(filePath: string): { policies: TeamPolicies; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const content = readFileSync(filePath, 'utf-8');
  let settings: Record<string, unknown>;

  try {
    settings = JSON.parse(content);
  } catch {
    warnings.push({ file: filePath, message: 'Failed to parse settings.json' });
    return { policies: {}, warnings };
  }

  const policies: TeamPolicies = {};

  const perms = typeof settings.permissions === 'object' && settings.permissions !== null
    ? settings.permissions as Record<string, unknown>
    : undefined;
  if (perms) {
    const allow = normalizePermissionTokens(
      Array.isArray(perms.allow) ? perms.allow as string[] : undefined,
      'allow',
    );
    const ask = normalizePermissionTokens(
      Array.isArray(perms.ask) ? perms.ask as string[] : undefined,
      'ask',
    );
    const deny = normalizePermissionTokens(
      Array.isArray(perms.deny) ? perms.deny as string[] : undefined,
      'deny',
    );

    policies.permissions = {};
    if (allow.abstract) policies.permissions.allow = allow.abstract;
    if (ask.abstract) policies.permissions.ask = ask.abstract;
    if (deny.abstract) policies.permissions.deny = deny.abstract;
    if (allow.raw || ask.raw || deny.raw) {
      policies.permissions.rawRules = {};
      if (allow.raw) policies.permissions.rawRules.allow = allow.raw;
      if (ask.raw) policies.permissions.rawRules.ask = ask.raw;
      if (deny.raw) policies.permissions.rawRules.deny = deny.raw;
    }
    if (perms.defaultMode && typeof perms.defaultMode === 'string') {
      policies.permissions.defaultMode = perms.defaultMode as 'default' | 'acceptEdits';
    }
  }

  const sandbox = typeof settings.sandbox === 'object' && settings.sandbox !== null
    ? settings.sandbox as Record<string, unknown>
    : undefined;
  if (sandbox) {
    policies.sandbox = {};
    if (typeof sandbox.enabled === 'boolean') policies.sandbox.enabled = sandbox.enabled;
    if (typeof sandbox.autoAllowBashIfSandboxed === 'boolean') {
      policies.sandbox.autoAllowBash = sandbox.autoAllowBashIfSandboxed;
    }
    if (Array.isArray(sandbox.excludedCommands)) {
      policies.sandbox.excludedCommands = sandbox.excludedCommands as string[];
    }
    const network = typeof sandbox.network === 'object' && sandbox.network !== null
      ? sandbox.network as Record<string, unknown>
      : undefined;
    if (network) {
      policies.sandbox.network = {};
      if (Array.isArray(network.allowUnixSockets)) {
        policies.sandbox.network.allowUnixSockets = network.allowUnixSockets as string[];
      }
      if (typeof network.allowLocalBinding === 'boolean') {
        policies.sandbox.network.allowLocalBinding = network.allowLocalBinding;
      }
    }
  }

  const hooks = typeof settings.hooks === 'object' && settings.hooks !== null
    ? settings.hooks as Record<string, unknown>
    : undefined;
  if (hooks) {
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

    policies.hooks = {};
    if (Array.isArray(hooks.PreToolUse)) {
      policies.hooks.preToolUse = parseHookEntries(hooks.PreToolUse);
    }
    if (Array.isArray(hooks.PostToolUse)) {
      policies.hooks.postToolUse = parseHookEntries(hooks.PostToolUse);
    }
    if (Array.isArray(hooks.Notification)) {
      policies.hooks.notification = parseHookEntries(hooks.Notification);
    }
  }

  return { policies, warnings };
}

export function importFromClaudeDir(cwd: string, projectName: string): ImportResult {
  const warnings: ImportWarning[] = [];
  const agents: Record<string, CoreAgent> = {};

  const agentsDir = join(cwd, '.claude', 'agents');
  if (existsSync(agentsDir)) {
    const files = readdirSync(agentsDir).filter((file) => file.endsWith('.md'));
    for (const file of files) {
      const filePath = join(agentsDir, file);
      const result = parseAgentFile(filePath);
      agents[result.name] = result.agent;
      warnings.push(...result.warnings);
    }
  }

  if (Object.keys(agents).length === 0) {
    warnings.push({ file: agentsDir, message: 'No agent .md files found in .claude/agents/' });
  }

  let policies: TeamPolicies | undefined;
  const settingsPath = join(cwd, '.claude', 'settings.json');
  if (existsSync(settingsPath)) {
    const result = parseSettingsJson(settingsPath);
    policies = result.policies;
    warnings.push(...result.warnings);
  }

  return {
    team: {
      version: '2',
      project: { name: projectName },
      agents,
      policies,
      settings: {
        defaultModel: 'sonnet',
        generateDocs: true,
        generateLocalSettings: true,
      },
    },
    warnings,
  };
}
