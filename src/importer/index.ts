import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type {
  AgentConfig,
  AgentForgeManifest,
  ModelAlias,
  Tool,
  PoliciesConfig,
  HooksConfig,
} from '../types/manifest.js';
import { MODEL_ID_MAP, CLAUDE_CODE_TOOLS } from '../types/manifest.js';

// Reverse map: Claude Code model ID → agentforge model alias
const REVERSE_MODEL_MAP: Record<string, Exclude<ModelAlias, 'inherit'>> = Object.fromEntries(
  Object.entries(MODEL_ID_MAP).map(([alias, id]) => [id, alias as Exclude<ModelAlias, 'inherit'>]),
);

interface ImportWarning {
  file: string;
  message: string;
}

interface ImportResult {
  manifest: AgentForgeManifest;
  warnings: ImportWarning[];
}

// Parse YAML frontmatter from agent .md file
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key && value) {
      fields[key] = value;
    }
  }
  return fields;
}

// Extract behavior text from agent .md (everything after frontmatter, excluding generated sections)
function extractBehavior(content: string): string | undefined {
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n\n?([\s\S]*)/);
  if (!bodyMatch) return undefined;

  let body = bodyMatch[1].trim();
  if (!body) return undefined;

  // Remove generated sections (Skills, Delegation, Constraints)
  const generatedSections = ['## Skills', '## Delegation', '## Constraints'];
  for (const section of generatedSections) {
    const sectionIndex = body.indexOf(section);
    if (sectionIndex !== -1) {
      // Find end of this section (next ## or end of text)
      const nextSection = body.indexOf('\n## ', sectionIndex + section.length);
      if (nextSection !== -1) {
        body = body.slice(0, sectionIndex) + body.slice(nextSection);
      } else {
        body = body.slice(0, sectionIndex);
      }
    }
  }

  body = body.trim();
  return body || undefined;
}

// Resolve model ID to alias
function resolveModelAlias(modelId: string | undefined): ModelAlias | undefined {
  if (!modelId) return undefined;
  return REVERSE_MODEL_MAP[modelId] ?? undefined;
}

// Parse comma-separated tools string
function parseTools(toolsString: string | undefined): Tool[] | undefined {
  if (!toolsString) return undefined;
  const tools = toolsString.split(',').map((t) => t.trim()).filter(Boolean);
  return tools.filter((t): t is Tool => CLAUDE_CODE_TOOLS.includes(t as Tool)) as Tool[];
}

// Parse a single agent .md file into AgentConfig
function parseAgentFile(filePath: string): { name: string; config: AgentConfig; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const fields = parseFrontmatter(content);
  const fileName = basename(filePath, '.md');
  const name = fields.name || fileName;

  const model = resolveModelAlias(fields.model);
  const allowTools = parseTools(fields.tools);
  const behavior = extractBehavior(content);

  if (fields.model && !model) {
    warnings.push({ file: filePath, message: `Unknown model ID "${fields.model}", skipping model field` });
  }

  const config: AgentConfig = {
    description: fields.description || `Imported from ${fileName}.md`,
  };

  if (model) config.model = model;
  if (allowTools && allowTools.length > 0) {
    config.tools = { allow: allowTools };
  }
  if (behavior) config.behavior = behavior;

  // Parse permissionMode
  if (fields.permissionMode && fields.permissionMode !== 'default') {
    const validModes = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    if (validModes.includes(fields.permissionMode)) {
      config.permission_mode = fields.permissionMode as AgentConfig['permission_mode'];
    } else {
      warnings.push({ file: filePath, message: `Unknown permissionMode "${fields.permissionMode}", skipping` });
    }
  }

  return { name, config, warnings };
}

// Parse settings.json into PoliciesConfig
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

  // Parse permissions
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

  // Parse sandbox
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

  // Parse hooks (camelCase → snake_case)
  const hooks = settings.hooks as Record<string, unknown> | undefined;
  if (hooks) {
    const hooksConfig: HooksConfig = {};

    const parseHookEntries = (entries: unknown[]) =>
      entries
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .map((entry) => ({
          matcher: String(entry.matcher ?? ''),
          command: Array.isArray(entry.hooks)
            ? String((entry.hooks[0] as Record<string, unknown>)?.command ?? '')
            : '',
        }))
        .filter((e) => e.matcher && e.command);

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

// Scan .claude/ directory and build a manifest
export function importFromClaudeDir(cwd: string, projectName: string): ImportResult {
  const warnings: ImportWarning[] = [];
  const agents: Record<string, AgentConfig> = {};

  // Scan .claude/agents/*.md
  const agentsDir = join(cwd, '.claude', 'agents');
  if (existsSync(agentsDir)) {
    const files = readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
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

  // Parse .claude/settings.json for policies
  let policies: PoliciesConfig | undefined;
  const settingsPath = join(cwd, '.claude', 'settings.json');
  if (existsSync(settingsPath)) {
    const result = parseSettingsJson(settingsPath);
    policies = result.policies;
    warnings.push(...result.warnings);
    // Only include if there's actual content
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
