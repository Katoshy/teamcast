import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parse } from 'yaml';
import type {
  CoreAgent,
  HookEntry,
  McpServerConfig,
  PermissionMode,
  TeamPolicies,
  TeamSettings,
} from '../core/types.js';
import type { TeamCastManifest } from '../manifest/types.js';
import type { TargetContext } from '../renderers/target-context.js';
import { createClaudeTarget } from '../renderers/claude/index.js';
import { createCodexTarget } from '../renderers/codex/index.js';
import type { ReasoningEffort } from '../core/types.js';

const LEGACY_MODEL_ID_MAP: Record<string, string> = {
  'claude-opus-4-6': 'opus',
  'claude-sonnet-4-6': 'sonnet',
  'claude-haiku-4-5-20251001': 'haiku',
};

interface ImportWarning {
  file: string;
  message: string;
}

interface ImportResult {
  team: TeamCastManifest;
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

function resolveClaudeModel(modelValue: unknown): string | undefined {
  if (typeof modelValue !== 'string' || modelValue.length === 0) return undefined;
  if (modelValue === 'opus' || modelValue === 'sonnet' || modelValue === 'haiku') {
    return modelValue;
  }

  return LEGACY_MODEL_ID_MAP[modelValue];
}

function isKnownTool(value: string, knownTools: string[]): boolean {
  return knownTools.includes(value);
}

function parseToolList(value: unknown, knownTools: string[]): string[] | undefined {
  const rawTools = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

  if (rawTools.length === 0) return undefined;

  const tools: string[] = [];
  for (const raw of rawTools) {
    const canonical = raw === 'Task' ? 'Agent' : raw;
    if (isKnownTool(canonical, knownTools) && !tools.includes(canonical)) {
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

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTomlString(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`^${escapeRegExp(key)}\\s*=\\s*"((?:\\\\.|[^"])*)"`, 'm'));
  if (!match) return undefined;

  return match[1]
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function extractTomlMultiline(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`${escapeRegExp(key)}\\s*=\\s*"""\\n([\\s\\S]*?)\\n"""`));
  return match ? normalizeLineEndings(match[1]).trim() : undefined;
}

function extractMarkdownSection(content: string, heading: string): string | undefined {
  const normalized = normalizeLineEndings(content);
  const match = normalized.match(
    new RegExp(`## ${escapeRegExp(heading)}\\n\\n([\\s\\S]*?)(?=\\n## |$)`),
  );
  return match?.[1]?.trim() || undefined;
}

function parseCommaList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((entry) => entry.trim().replace(/\.$/, ''))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function stripCodexGeneratedSections(body: string | undefined): string | undefined {
  if (!body) return undefined;

  let nextBody = normalizeLineEndings(body);
  if (nextBody.startsWith('You are ')) {
    const firstBreak = nextBody.indexOf('\n\n');
    nextBody = firstBreak === -1 ? '' : nextBody.slice(firstBreak + 2);
  }

  for (const section of ['## Delegation', '## Allowed Tool Intents', '## Restricted Tool Intents', '## Skill Docs']) {
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

function parseCodexReasoningEffort(value: string | undefined): ReasoningEffort | undefined {
  if (!value) return undefined;
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return undefined;
}

function parseAgentFile(filePath: string, targetContext: TargetContext): { name: string; agent: CoreAgent; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const fields = parseFrontmatter(content);
  const fileName = basename(filePath, '.md');
  const name = typeof fields.name === 'string' && fields.name.length > 0 ? fields.name : fileName;

  const model = resolveClaudeModel(fields.model);
  const rawTools = parseToolList(fields.tools, targetContext.knownTools);
  const tools: string[] | undefined = rawTools
    ? (() => {
        const reverseMap = targetContext.reverseMapTools;
        if (reverseMap) {
          const { skills, remainingTools } = reverseMap(rawTools);
          return [...skills, ...remainingTools];
        }
        return rawTools;
      })()
    : undefined;
  const disallowedTools = parseToolList(fields.disallowedTools, targetContext.knownTools);
  const permissionMode = parsePermissionMode(fields.permissionMode);
  const maxTurns = typeof fields.maxTurns === 'number' ? fields.maxTurns : undefined;
  const background = typeof fields.background === 'boolean' ? fields.background : undefined;
  const skillDocs = parseSkillList(fields.skills);
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
        skillDocs,
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
    const allow = Array.isArray(perms.allow) ? perms.allow as string[] : undefined;
    const ask = Array.isArray(perms.ask) ? perms.ask as string[] : undefined;
    const deny = Array.isArray(perms.deny) ? perms.deny as string[] : undefined;

    policies.permissions = {};
    if (allow || ask || deny) {
      policies.permissions.rules = {};
      if (allow) policies.permissions.rules.allow = allow;
      if (ask) policies.permissions.rules.ask = ask;
      if (deny) policies.permissions.rules.deny = deny;
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

  const claudeTarget = createClaudeTarget();

  const agentsDir = join(cwd, '.claude', 'agents');
  if (existsSync(agentsDir)) {
    const files = readdirSync(agentsDir).filter((file) => file.endsWith('.md'));
    for (const file of files) {
      const filePath = join(agentsDir, file);
      const result = parseAgentFile(filePath, claudeTarget);
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

  const agentConfigs: Record<string, any> = {};
  for (const [id, coreAgent] of Object.entries(agents)) {
    agentConfigs[id] = {
      description: coreAgent.description,
      model: coreAgent.runtime.model,
      reasoning_effort: coreAgent.runtime.reasoningEffort,
      tools: coreAgent.runtime.tools,
      disallowed_tools: coreAgent.runtime.disallowedTools,
      permission_mode: coreAgent.runtime.permissionMode,
      skills: coreAgent.runtime.skillDocs,
      max_turns: coreAgent.runtime.maxTurns,
      mcp_servers: coreAgent.runtime.mcpServers,
      background: coreAgent.runtime.background,
      instruction_blocks: coreAgent.instructions,
      forge: coreAgent.metadata,
    };
  }

  return {
    team: {
      version: '2',
      project: { name: projectName },
      claude: {
        agents: agentConfigs,
        policies: policies ? {
          permissions: policies.permissions ? {
            rules: policies.permissions.rules ? {
              allow: policies.permissions.rules.allow,
              ask: policies.permissions.rules.ask,
              deny: policies.permissions.rules.deny,
            } : undefined,
            default_mode: policies.permissions.defaultMode,
          } : undefined,
          sandbox: policies.sandbox ? {
            enabled: policies.sandbox.enabled,
            auto_allow_bash: policies.sandbox.autoAllowBash,
            excluded_commands: policies.sandbox.excludedCommands,
            network: policies.sandbox.network ? {
              allow_unix_sockets: policies.sandbox.network.allowUnixSockets,
              allow_local_binding: policies.sandbox.network.allowLocalBinding,
            } : undefined,
          } : undefined,
          hooks: policies.hooks ? {
            pre_tool_use: policies.hooks.preToolUse,
            post_tool_use: policies.hooks.postToolUse,
            notification: policies.hooks.notification,
          } : undefined,
        } : undefined,
        settings: {
          generate_docs: true,
          generate_local_settings: true,
        },
      },
    },
    warnings,
  };
}

interface CodexAgentEntry {
  name: string;
  description: string;
  configPath: string;
}

function parseCodexConfigEntries(filePath: string): CodexAgentEntry[] {
  const content = normalizeLineEndings(readFileSync(filePath, 'utf-8'));
  const sectionRegex = /\[agents\.([^\]]+)\]\n([\s\S]*?)(?=\n\[agents\.|\s*$)/g;
  const entries: CodexAgentEntry[] = [];

  for (const match of content.matchAll(sectionRegex)) {
    const name = match[1];
    const block = match[2];
    const description = extractTomlString(block, 'description');
    const configPath = extractTomlString(block, 'config_file');
    if (description && configPath) {
      entries.push({ name, description, configPath });
    }
  }

  return entries;
}

function parseCodexToolList(value: string | undefined, knownTools: string[]): string[] | undefined {
  const items = parseCommaList(value);
  if (!items) return undefined;

  const tools = items.filter((item) => knownTools.includes(item));
  return tools.length > 0 ? tools : undefined;
}

function parseCodexAgentFile(
  cwd: string,
  entry: CodexAgentEntry,
  targetContext: TargetContext,
): { name: string; agent: CoreAgent; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const filePath = join(cwd, '.codex', entry.configPath);
  const content = normalizeLineEndings(readFileSync(filePath, 'utf-8'));
  const developerInstructions = extractTomlMultiline(content, 'developer_instructions');
  const delegation = extractMarkdownSection(developerInstructions ?? '', 'Delegation');
  const allowedToolIntents = extractMarkdownSection(developerInstructions ?? '', 'Allowed Tool Intents');
  const restrictedToolIntents = extractMarkdownSection(developerInstructions ?? '', 'Restricted Tool Intents');
  const skillDocsSection = extractMarkdownSection(developerInstructions ?? '', 'Skill Docs');
  const reasoningEffort = parseCodexReasoningEffort(extractTomlString(content, 'model_reasoning_effort'));

  if (extractTomlString(content, 'model_reasoning_effort') && !reasoningEffort) {
    warnings.push({
      file: filePath,
      message: `Unknown reasoning effort "${String(extractTomlString(content, 'model_reasoning_effort'))}", skipping`,
    });
  }

  const handoffs = parseCommaList(delegation?.replace(/^You may delegate to:\s*/i, ''));
  const tools = parseCodexToolList(allowedToolIntents, targetContext.knownTools);
  const disallowedTools = parseCodexToolList(
    restrictedToolIntents?.replace(/^Avoid using:\s*/i, ''),
    targetContext.knownTools,
  );
  const skillDocs = parseCommaList(
    skillDocsSection?.replace(/^Follow these local skills when relevant:\s*/i, ''),
  );

  return {
    name: entry.name,
    agent: {
      id: entry.name,
      description: entry.description,
      runtime: {
        model: extractTomlString(content, 'model'),
        reasoningEffort,
        tools,
        disallowedTools,
        skillDocs,
      },
      instructions: stripCodexGeneratedSections(developerInstructions)
        ? [{ kind: 'behavior', content: stripCodexGeneratedSections(developerInstructions)! }]
        : [],
      metadata: handoffs?.length ? { handoffs } : undefined,
    },
    warnings,
  };
}

export function importFromCodexDir(cwd: string, projectName: string): ImportResult {
  const warnings: ImportWarning[] = [];
  const agents: Record<string, CoreAgent> = {};
  const codexTarget = createCodexTarget();
  const configPath = join(cwd, '.codex', 'config.toml');

  if (!existsSync(configPath)) {
    warnings.push({ file: configPath, message: 'No .codex/config.toml file found' });
  } else {
    const entries = parseCodexConfigEntries(configPath);
    for (const entry of entries) {
      const agentPath = join(cwd, '.codex', entry.configPath);
      if (!existsSync(agentPath)) {
        warnings.push({ file: agentPath, message: `Missing config for agent "${entry.name}"` });
        continue;
      }

      const result = parseCodexAgentFile(cwd, entry, codexTarget);
      agents[result.name] = result.agent;
      warnings.push(...result.warnings);
    }
  }

  if (Object.keys(agents).length === 0) {
    warnings.push({ file: join(cwd, '.codex', 'agents'), message: 'No agent .toml files found in .codex/agents/' });
  }

  const agentConfigs: Record<string, any> = {};
  for (const [id, coreAgent] of Object.entries(agents)) {
    agentConfigs[id] = {
      description: coreAgent.description,
      model: coreAgent.runtime.model,
      reasoning_effort: coreAgent.runtime.reasoningEffort,
      tools: coreAgent.runtime.tools,
      disallowed_tools: coreAgent.runtime.disallowedTools,
      permission_mode: coreAgent.runtime.permissionMode,
      skills: coreAgent.runtime.skillDocs,
      max_turns: coreAgent.runtime.maxTurns,
      mcp_servers: coreAgent.runtime.mcpServers,
      background: coreAgent.runtime.background,
      instruction_blocks: coreAgent.instructions,
      forge: coreAgent.metadata,
    };
  }

  return {
    team: {
      version: '2',
      project: { name: projectName },
      codex: {
        agents: agentConfigs,
        settings: {
          generate_docs: true,
          generate_local_settings: true,
        },
      },
    },
    warnings,
  };
}
