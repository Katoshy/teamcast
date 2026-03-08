import {
  normalizeInstructionBlocks,
  type InstructionBlock,
} from '../core/instructions.js';
import { normalizePermissionTokens } from '../core/permissions.js';
import {
  mergeRuntimeWithTraits,
  resolveInstructionFragments,
} from '../components/agent-fragments.js';
import { composePoliciesFromFragments } from '../components/policy-fragments.js';
import { isAgentSkill, type AgentSkill } from '../core/skills.js';
import type {
  AgentRuntime,
  CoreAgent,
  CoreTeam,
  HookEntry,
  TeamPolicies,
} from '../core/types.js';
import { CLAUDE_CODE_TOOLS, type CanonicalTool } from '../renderers/claude/tools.js';
import { expandSkillsToTools } from '../renderers/claude/skill-map.js';
import type {
  AgentDefinition,
  AgentForgeManifest,
  AgentForgeManifestV2,
  AgentConfigV2,
  CanonicalAgentConfigV1,
  GenerationSettings,
  HooksConfig,
  LegacyAgentConfigV1,
  LegacyToolsConfig,
  PoliciesConfig,
  PresetMeta,
  ProjectConfig,
  Tool,
} from './types.js';

function cloneArray<T>(value: T[] | undefined): T[] | undefined {
  return value ? [...value] : undefined;
}

function definedArray<T>(value: T[] | undefined): T[] | undefined {
  return value && value.length > 0 ? [...value] : undefined;
}

function dedupeTools(tools: Tool[] | undefined): AgentRuntime['tools'] {
  if (!tools?.length) return undefined;

  const normalized: AgentRuntime['tools'] = [];
  for (const tool of tools) {
    const canonical = tool === 'Task' ? 'Agent' : tool;
    if (!normalized.includes(canonical)) {
      normalized.push(canonical);
    }
  }

  return normalized;
}

/**
 * Splits a mixed array of AgentSkill | CanonicalTool values into:
 * - skills: the AgentSkill values found
 * - rawTools: the CanonicalTool values found (not from skill expansion)
 *
 * The expanded tools are computed from skills and merged with rawTools.
 */
function separateSkillsAndTools(items: Array<AgentSkill | CanonicalTool> | undefined): {
  skills: AgentSkill[];
  rawTools: CanonicalTool[];
} {
  const skills: AgentSkill[] = [];
  const rawTools: CanonicalTool[] = [];

  for (const item of items ?? []) {
    if (isAgentSkill(item)) {
      skills.push(item);
    } else {
      rawTools.push(item as CanonicalTool);
    }
  }

  return { skills, rawTools };
}

/**
 * Expands AgentSkill values to CanonicalTool[] and merges with explicitly specified raw tools.
 * Returns deduplicated tools.
 */
function resolveToolsFromSkillsAndRaw(
  skills: AgentSkill[],
  rawTools: CanonicalTool[],
): { tools: CanonicalTool[] | undefined } {
  const expandedTools = skills.length > 0 ? expandSkillsToTools(skills) : [];
  const allTools = [...new Set([...expandedTools, ...rawTools])];

  return {
    tools: allTools.length > 0 ? allTools : undefined,
  };
}

function isLegacyToolsConfigWithAllow(
  tools: LegacyToolsConfig,
): tools is Extract<LegacyToolsConfig, { allow: Tool[] }> {
  return 'allow' in tools;
}

function mapHooksConfig(hooks: HooksConfig | undefined): TeamPolicies['hooks'] {
  if (!hooks) return undefined;

  const cloneEntries = (entries: HookEntry[] | undefined) =>
    entries?.map((entry) => ({ ...entry }));

  return {
    preToolUse: cloneEntries(hooks.pre_tool_use),
    postToolUse: cloneEntries(hooks.post_tool_use),
    notification: cloneEntries(hooks.notification),
  };
}

function mapPolicies(policies: PoliciesConfig | undefined): TeamPolicies | undefined {
  if (!policies) return undefined;

  const normalizedAllow = normalizePermissionTokens(policies.permissions?.allow, 'allow');
  const normalizedAsk = normalizePermissionTokens(policies.permissions?.ask, 'ask');
  const normalizedDeny = normalizePermissionTokens(policies.permissions?.deny, 'deny');

  const explicitPolicies: TeamPolicies = {
    permissions: policies.permissions
    ? {
        allow: normalizedAllow.abstract,
        ask: normalizedAsk.abstract,
        deny: normalizedDeny.abstract,
        defaultMode: policies.permissions.default_mode,
        rawRules:
          normalizedAllow.raw?.length ||
          normalizedAsk.raw?.length ||
          normalizedDeny.raw?.length ||
          policies.permissions.rules?.allow?.length ||
          policies.permissions.rules?.ask?.length ||
          policies.permissions.rules?.deny?.length
            ? {
                allow: definedArray([...(normalizedAllow.raw ?? []), ...(policies.permissions.rules?.allow ?? [])]),
                ask: definedArray([...(normalizedAsk.raw ?? []), ...(policies.permissions.rules?.ask ?? [])]),
                deny: definedArray([...(normalizedDeny.raw ?? []), ...(policies.permissions.rules?.deny ?? [])]),
              }
            : undefined,
      }
    : undefined,
    sandbox: policies.sandbox
    ? {
        enabled: policies.sandbox.enabled,
        autoAllowBash: policies.sandbox.auto_allow_bash,
        excludedCommands: cloneArray(policies.sandbox.excluded_commands),
        network: policies.sandbox.network
          ? {
              allowUnixSockets: cloneArray(policies.sandbox.network.allow_unix_sockets),
              allowLocalBinding: policies.sandbox.network.allow_local_binding,
            }
          : undefined,
      }
    : undefined,
    hooks: mapHooksConfig(policies.hooks),
    network: policies.network
    ? {
        allowedDomains: cloneArray(policies.network.allowed_domains),
      }
    : undefined,
    assertions: policies.assertions ? [...policies.assertions] : undefined,
  };

  return composePoliciesFromFragments(policies.fragments, explicitPolicies);
}

function mapProject(project: ProjectConfig): CoreTeam['project'] {
  return {
    name: project.name,
    preset: project.preset,
    description: project.description,
  };
}

function mapPresetMeta(meta: PresetMeta | undefined): CoreTeam['presetMeta'] {
  if (!meta) return undefined;
  return {
    author: meta.author,
    tags: cloneArray(meta.tags),
    minVersion: meta.min_version,
  };
}

function mapSettings(settings: GenerationSettings | undefined): CoreTeam['settings'] {
  return {
    defaultModel: settings?.default_model ?? 'sonnet',
    generateDocs: settings?.generate_docs ?? true,
    generateLocalSettings: settings?.generate_local_settings ?? true,
  };
}

function stringToBlocks(value: string | undefined): InstructionBlock[] {
  if (!value?.trim()) return [];
  return [{ kind: 'behavior', content: value.trim() }];
}

function mapRuntimeFromLegacy(agent: LegacyAgentConfigV1): AgentRuntime {
  const allowTools =
    agent.tools && isLegacyToolsConfigWithAllow(agent.tools)
      ? dedupeTools(agent.tools.allow)
      : undefined;
  const deniedTools = agent.tools
    ? dedupeTools(agent.tools.deny)
    : undefined;

  return {
    model: agent.model,
    tools: allowTools,
    disallowedTools: deniedTools,
    skills: cloneArray(agent.skills),
    maxTurns: agent.max_turns,
    mcpServers: agent.mcp_servers ? agent.mcp_servers.map((server) => ({ ...server })) : undefined,
    permissionMode: agent.permission_mode,
    background: agent.background,
  };
}

function normalizeAgent(agentId: string, agent: AgentDefinition): CoreAgent {
  if ('claude' in agent) {
    const v2Agent = agent as AgentConfigV2;
    const usesStructuredComposition =
      'instruction_blocks' in agent.claude ||
      'instruction_fragments' in agent.claude ||
      'capability_traits' in agent.claude;

    // Separate skills from raw tool names in the tools arrays.
    const { skills: toolsSkills, rawTools } = separateSkillsAndTools(
      agent.claude.tools as Array<AgentSkill | CanonicalTool> | undefined,
    );
    const { skills: disallowedSkills, rawTools: rawDisallowedTools } = separateSkillsAndTools(
      agent.claude.disallowed_tools as Array<AgentSkill | CanonicalTool> | undefined,
    );

    // Expand AgentSkill values found in tools[] into CanonicalTool[].
    // Note: agent.claude.skills contains free-form skill doc strings (e.g. 'test-first'),
    // NOT AgentSkill values. Only toolsSkills (extracted from the tools[] array) are abstract skills.
    const { tools: resolvedTools } = resolveToolsFromSkillsAndRaw(
      toolsSkills,
      rawTools,
    );
    const { tools: resolvedDisallowedTools } = resolveToolsFromSkillsAndRaw(
      disallowedSkills,
      rawDisallowedTools,
    );

    const runtime = usesStructuredComposition
      ? mergeRuntimeWithTraits({
          model: agent.claude.model,
          tools: resolvedTools ? [...resolvedTools] : undefined,
          disallowedTools: resolvedDisallowedTools ? [...resolvedDisallowedTools] : undefined,
          // agent.claude.skills holds free-form skill doc references (e.g. 'test-first').
          // AgentSkill abstract values from tools[] are already expanded into resolvedTools.
          skills: cloneArray(agent.claude.skills),
          maxTurns: agent.claude.max_turns,
          mcpServers: agent.claude.mcp_servers?.map((server) => ({ ...server })),
          permissionMode: agent.claude.permission_mode,
          background: agent.claude.background,
        }, v2Agent.claude.capability_traits)
      : {
          model: agent.claude.model,
          tools: resolvedTools ? [...resolvedTools] : undefined,
          disallowedTools: resolvedDisallowedTools ? [...resolvedDisallowedTools] : undefined,
          skills: cloneArray(agent.claude.skills),
          maxTurns: agent.claude.max_turns,
          mcpServers: agent.claude.mcp_servers?.map((server) => ({ ...server })),
          permissionMode: agent.claude.permission_mode,
          background: agent.claude.background,
        };
    const instructionBlocks = usesStructuredComposition
      ? normalizeInstructionBlocks(
          resolveInstructionFragments(
            v2Agent.claude.instruction_fragments,
            v2Agent.claude.instruction_blocks,
          ),
        )
      : stringToBlocks((agent as CanonicalAgentConfigV1).claude.instructions);

    return {
      id: agentId,
      description: agent.claude.description,
      runtime,
      instructions: instructionBlocks,
      metadata: agent.forge
        ? {
            handoffs: cloneArray(agent.forge.handoffs),
            role: agent.forge.role,
            template: agent.forge.template,
          }
        : undefined,
    };
  }

  return {
    id: agentId,
    description: agent.description,
    runtime: mapRuntimeFromLegacy(agent),
    instructions: stringToBlocks(agent.behavior),
    metadata: agent.handoffs?.length ? { handoffs: cloneArray(agent.handoffs) } : undefined,
  };
}

export function normalizeManifest(manifest: AgentForgeManifest): CoreTeam {
  return {
    version: '2',
    project: mapProject(manifest.project),
    agents: Object.fromEntries(
      Object.entries(manifest.agents).map(([agentId, agent]) => [agentId, normalizeAgent(agentId, agent)]),
    ),
    policies: mapPolicies(manifest.policies),
    settings: mapSettings(manifest.settings),
    presetMeta: mapPresetMeta(manifest.preset_meta),
  };
}

function denormalizePolicies(policies: CoreTeam['policies']): PoliciesConfig | undefined {
  if (!policies) return undefined;

  return {
    permissions: policies.permissions
      ? {
          allow: cloneArray(policies.permissions.allow),
          ask: cloneArray(policies.permissions.ask),
          deny: cloneArray(policies.permissions.deny),
          default_mode: policies.permissions.defaultMode,
          rules: policies.permissions.rawRules
            ? {
                allow: definedArray(policies.permissions.rawRules.allow),
                ask: definedArray(policies.permissions.rawRules.ask),
                deny: definedArray(policies.permissions.rawRules.deny),
              }
            : undefined,
        }
      : undefined,
    sandbox: policies.sandbox
      ? {
          enabled: policies.sandbox.enabled,
          auto_allow_bash: policies.sandbox.autoAllowBash,
          excluded_commands: cloneArray(policies.sandbox.excludedCommands),
          network: policies.sandbox.network
            ? {
                allow_unix_sockets: cloneArray(policies.sandbox.network.allowUnixSockets),
                allow_local_binding: policies.sandbox.network.allowLocalBinding,
              }
            : undefined,
        }
      : undefined,
    hooks: policies.hooks
      ? {
          pre_tool_use: policies.hooks.preToolUse?.map((entry) => ({ ...entry })),
          post_tool_use: policies.hooks.postToolUse?.map((entry) => ({ ...entry })),
          notification: policies.hooks.notification?.map((entry) => ({ ...entry })),
        }
      : undefined,
    network: policies.network
      ? {
          allowed_domains: cloneArray(policies.network.allowedDomains),
        }
      : undefined,
    assertions: policies.assertions ? [...policies.assertions] : undefined,
  };
}

/**
 * Returns the tools from runtime for writing back to YAML.
 * runtime.tools contains the fully-expanded CanonicalTool[] (from both traits and explicit tools).
 * runtime.skills contains free-form skill doc references (not AgentSkill abstract capabilities).
 * Since capability_traits are written back separately via the YAML structure, we write all tools as-is.
 */
function getRawToolsForYaml(runtime: AgentRuntime): CanonicalTool[] | undefined {
  if (!runtime.tools?.length) return undefined;
  return runtime.tools as CanonicalTool[];
}

export function denormalizeManifest(team: CoreTeam): AgentForgeManifestV2 {
  return {
    version: '2',
    project: {
      name: team.project.name,
      preset: team.project.preset,
      description: team.project.description,
    },
    agents: Object.fromEntries(
      Object.entries(team.agents).map(([agentId, agent]) => [
        agentId,
        {
          claude: {
            description: agent.description,
            model: agent.runtime.model,
            // Write only non-skill-expanded tools back. Skills are written in the skills field.
            tools: getRawToolsForYaml(agent.runtime),
            disallowed_tools: cloneArray(agent.runtime.disallowedTools) as CanonicalTool[] | undefined,
            skills: cloneArray(agent.runtime.skills),
            max_turns: agent.runtime.maxTurns,
            mcp_servers: agent.runtime.mcpServers?.map((server) => ({ ...server })),
            permission_mode: agent.runtime.permissionMode,
            instruction_blocks: agent.instructions.map((block) => ({ ...block })),
            background: agent.runtime.background,
          },
          forge: agent.metadata
            ? {
                handoffs: cloneArray(agent.metadata.handoffs),
                role: agent.metadata.role,
                template: agent.metadata.template,
              }
            : undefined,
        },
      ]),
    ),
    policies: denormalizePolicies(team.policies),
    settings: {
      default_model: team.settings?.defaultModel,
      generate_docs: team.settings?.generateDocs,
      generate_local_settings: team.settings?.generateLocalSettings,
    },
    preset_meta: team.presetMeta
      ? {
          author: team.presetMeta.author,
          tags: cloneArray(team.presetMeta.tags),
          min_version: team.presetMeta.minVersion,
        }
      : undefined,
  };
}

export function buildRuntimeFromCapabilities(capabilities: {
  model?: AgentRuntime['model'];
  tools?: AgentRuntime['tools'];
  disallowedTools?: AgentRuntime['disallowedTools'];
  skills?: AgentRuntime['skills'];
  maxTurns?: AgentRuntime['maxTurns'];
  permissionMode?: AgentRuntime['permissionMode'];
}): AgentRuntime {
  return {
    model: capabilities.model,
    tools: cloneArray(capabilities.tools),
    disallowedTools: cloneArray(capabilities.disallowedTools),
    skills: cloneArray(capabilities.skills),
    maxTurns: capabilities.maxTurns,
    permissionMode: capabilities.permissionMode,
  };
}

export function ensureKnownTools(tools: AgentRuntime['tools'] | undefined): AgentRuntime['tools'] {
  return tools?.filter((tool) => CLAUDE_CODE_TOOLS.includes(tool as CanonicalTool));
}
