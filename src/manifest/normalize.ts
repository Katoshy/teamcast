import {
  normalizeInstructionBlocks,
} from '../core/instructions.js';
import { mergeRuntimeWithTraits } from '../registry/traits.js';
import { resolveInstructionFragments } from '../registry/instruction-fragments.js';
import { composePoliciesFromFragments } from '../registry/policy-fragments.js';
import { isCapability, type CapabilityId } from '../registry/capabilities.js';
import type {
  AgentRuntime,
  CoreAgent,
  CoreTeam,
  HookEntry,
  TeamPolicies,
} from '../core/types.js';
import { expandCapabilities } from '../core/capability-resolver.js';
import type { TargetContext } from '../renderers/target-context.js';
import { applyDefaults } from './defaults.js';
import { getManifestTargetConfig, isManifestTargetName } from './targets.js';
import type {
  TeamCastManifest,
  AgentConfig,
  BaseAgentConfig,
  GenerationSettings,
  HooksConfig,
  ManifestSkillBlock,
  PoliciesConfig,
  PresetMeta,
  ProjectConfig,
  TargetConfig,
} from './types.js';
import { defaultRegistry } from '../registry/index.js';
import type { SkillDefinition } from '../registry/types.js';

function cloneArray<T>(value: T[] | undefined): T[] | undefined {
  return value ? [...value] : undefined;
}

function definedArray<T>(value: T[] | undefined): T[] | undefined {
  return value && value.length > 0 ? [...value] : undefined;
}

function separateSkillsAndTools(items: Array<CapabilityId | string> | undefined): {
  skills: CapabilityId[];
  rawTools: string[];
} {
  const skills: CapabilityId[] = [];
  const rawTools: string[] = [];

  for (const item of items ?? []) {
    if (isCapability(item)) {
      skills.push(item);
    } else {
      rawTools.push(item);
    }
  }

  return { skills, rawTools };
}

function resolveToolsFromSkillsAndRaw(
  skills: CapabilityId[],
  rawTools: string[],
  targetContext: TargetContext,
): { tools: string[] | undefined } {
  const expandedTools = skills.length > 0 ? expandCapabilities(skills, targetContext.skillMap) : [];
  const allTools = [...new Set([...expandedTools, ...rawTools])];

  return {
    tools: allTools.length > 0 ? allTools : undefined,
  };
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

  const combinedAllow = [...(policies.permissions?.allow ?? []), ...(policies.permissions?.rules?.allow ?? [])];
  const combinedAsk = [...(policies.permissions?.ask ?? []), ...(policies.permissions?.rules?.ask ?? [])];
  const combinedDeny = [...(policies.permissions?.deny ?? []), ...(policies.permissions?.rules?.deny ?? [])];

  const explicitPolicies: TeamPolicies = {
    permissions: policies.permissions
      ? {
          rules:
            combinedAllow.length || combinedAsk.length || combinedDeny.length
              ? {
                  allow: definedArray(combinedAllow),
                  ask: definedArray(combinedAsk),
                  deny: definedArray(combinedDeny),
                }
              : undefined,
          defaultMode: policies.permissions.default_mode,
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
    environments: cloneArray(project.environments),
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
    generateDocs: settings?.generate_docs,
    generateLocalSettings: settings?.generate_local_settings,
  };
}

function registerInlineSkillBlocks(blocks: ManifestSkillBlock[] | undefined): string[] {
  if (!blocks?.length) return [];

  const names: string[] = [];
  for (const block of blocks) {
    const id = block.name;
    // Only register if not already known (builtin takes precedence)
    if (!defaultRegistry.getSkill(id)) {
      const skill: SkillDefinition = {
        id,
        name: block.name
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        description: block.description,
        instructions: block.instructions,
        source: 'user',
        allowed_tools: block.allowed_tools,
      };
      defaultRegistry.registerSkills({ [id]: skill });
    }
    names.push(id);
  }
  return names;
}

function buildAgentRuntime(
  agent: BaseAgentConfig,
  resolvedTools: string[] | undefined,
  resolvedDisallowedTools: string[] | undefined,
): AgentRuntime {
  return {
    model: agent.model,
    reasoningEffort: agent.reasoning_effort,
    tools: resolvedTools ? [...resolvedTools] : undefined,
    disallowedTools: resolvedDisallowedTools ? [...resolvedDisallowedTools] : undefined,
    skillDocs: cloneArray(agent.skills),
    maxTurns: agent.max_turns,
    mcpServers: agent.mcp_servers?.map((server) => ({ ...server })),
    permissionMode: agent.permission_mode,
    background: agent.background,
  };
}

function normalizeAgent(agentId: string, agent: AgentConfig, targetContext: TargetContext): CoreAgent {
  const usesStructuredComposition =
    'instruction_blocks' in agent ||
    'instruction_fragments' in agent ||
    'capability_traits' in agent;

  const { skills: toolsSkills, rawTools } = separateSkillsAndTools(
    agent.tools as Array<CapabilityId | string> | undefined,
  );
  const { skills: disallowedSkills, rawTools: rawDisallowedTools } = separateSkillsAndTools(
    agent.disallowed_tools as Array<CapabilityId | string> | undefined,
  );

  const { tools: resolvedTools } = resolveToolsFromSkillsAndRaw(
    toolsSkills,
    rawTools,
    targetContext,
  );
  const { tools: resolvedDisallowedTools } = resolveToolsFromSkillsAndRaw(
    disallowedSkills,
    rawDisallowedTools,
    targetContext,
  );

  const inlineSkillNames = registerInlineSkillBlocks(agent.skill_blocks);

  const baseRuntime = buildAgentRuntime(agent, resolvedTools, resolvedDisallowedTools);

  // Merge inline skill_blocks names into skillDocs
  if (inlineSkillNames.length > 0) {
    const existing = baseRuntime.skillDocs ?? [];
    baseRuntime.skillDocs = [...new Set([...existing, ...inlineSkillNames])];
  }

  const runtime = usesStructuredComposition
    ? mergeRuntimeWithTraits(baseRuntime, agent.capability_traits, targetContext.skillMap)
    : baseRuntime;
  const instructionBlocks = usesStructuredComposition
    ? normalizeInstructionBlocks(
        resolveInstructionFragments(agent.instruction_fragments, agent.instruction_blocks),
      )
    : [];

  return {
    id: agentId,
    description: agent.description,
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

export function normalizeManifest(manifest: TeamCastManifest, targetContext: TargetContext): CoreTeam {
  const defaultedManifest = applyDefaults(manifest);
  if (!isManifestTargetName(targetContext.name)) {
    throw new Error(`Unsupported target name: ${targetContext.name}`);
  }
  const targetConfig = getManifestTargetConfig(defaultedManifest, targetContext.name);
  const agents = targetConfig?.agents ?? {};

  return {
    version: '2',
    project: mapProject(defaultedManifest.project),
    agents: Object.fromEntries(
      Object.entries(agents).map(([agentId, agent]) => [
        agentId,
        normalizeAgent(agentId, agent as AgentConfig, targetContext),
      ]),
    ),
    policies: mapPolicies(targetConfig?.policies),
    settings: mapSettings(targetConfig?.settings),
    presetMeta: mapPresetMeta(defaultedManifest.preset_meta),
  };
}

function denormalizePolicies(policies: CoreTeam['policies']): PoliciesConfig | undefined {
  if (!policies) return undefined;

  return {
    permissions: policies.permissions
      ? {
          rules: policies.permissions.rules
            ? {
                allow: cloneArray(policies.permissions.rules.allow),
                ask: cloneArray(policies.permissions.rules.ask),
                deny: cloneArray(policies.permissions.rules.deny),
              }
            : undefined,
          default_mode: policies.permissions.defaultMode,
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

function getRawToolsForYaml(runtime: AgentRuntime): string[] | undefined {
  if (!runtime.tools?.length) return undefined;
  return runtime.tools;
}

export function denormalizeTarget(team: CoreTeam, targetName: string): TargetConfig {
  return {
    agents: Object.fromEntries(
      Object.entries(team.agents).map(([agentId, agent]) => [
        agentId,
        {
          description: agent.description,
          model: agent.runtime.model,
          reasoning_effort: targetName === 'codex' ? agent.runtime.reasoningEffort : undefined,
          tools: getRawToolsForYaml(agent.runtime),
          disallowed_tools: cloneArray(agent.runtime.disallowedTools),
          skills: cloneArray(agent.runtime.skillDocs),
          max_turns: agent.runtime.maxTurns,
          mcp_servers: agent.runtime.mcpServers?.map((server) => ({ ...server })),
          permission_mode: agent.runtime.permissionMode,
          instruction_blocks: agent.instructions.map((block) => ({ ...block })),
          background: agent.runtime.background,
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
    settings: denormalizeSharedSettings(team.settings),
  };
}

function denormalizeSharedSettings(settings: CoreTeam['settings']): GenerationSettings | undefined {
  if (!settings) return undefined;
  return {
    generate_docs: settings.generateDocs,
    generate_local_settings: settings.generateLocalSettings,
  };
}

export function createManifestForTarget(team: CoreTeam, targetName: string): TeamCastManifest {
  return {
    version: '2',
    project: {
      name: team.project.name,
      preset: team.project.preset,
      description: team.project.description,
    },
    [targetName]: denormalizeTarget(team, targetName),
    preset_meta: team.presetMeta
      ? {
          author: team.presetMeta.author,
          tags: cloneArray(team.presetMeta.tags),
          min_version: team.presetMeta.minVersion,
        }
      : undefined,
  } as TeamCastManifest;
}

export function replaceManifestTarget(
  manifest: TeamCastManifest,
  targetName: string,
  team: CoreTeam,
): TeamCastManifest {
  return {
    ...manifest,
    [targetName]: denormalizeTarget(team, targetName),
  } as TeamCastManifest;
}

export function buildRuntimeFromCapabilities(capabilities: {
  model?: AgentRuntime['model'];
  reasoningEffort?: AgentRuntime['reasoningEffort'];
  tools?: AgentRuntime['tools'];
  disallowedTools?: AgentRuntime['disallowedTools'];
  skillDocs?: AgentRuntime['skillDocs'];
  maxTurns?: AgentRuntime['maxTurns'];
  permissionMode?: AgentRuntime['permissionMode'];
}): AgentRuntime {
  return {
    model: capabilities.model,
    reasoningEffort: capabilities.reasoningEffort,
    tools: cloneArray(capabilities.tools),
    disallowedTools: cloneArray(capabilities.disallowedTools),
    skillDocs: cloneArray(capabilities.skillDocs),
    maxTurns: capabilities.maxTurns,
    permissionMode: capabilities.permissionMode,
  };
}

export function ensureKnownTools(
  tools: AgentRuntime['tools'] | undefined,
  knownTools: string[],
): AgentRuntime['tools'] {
  return tools?.filter((tool) => knownTools.includes(tool));
}
