import type { CoreAgent, CoreTeam, ReasoningEffort } from '../core/types.js';
import type { AgentConfig, TeamCastManifest, TargetConfig } from '../manifest/types.js';
import type { TeamRoleName } from '../team-templates/roles.js';
import { createPolicies } from '../team-templates/policies.js';
import { buildPresetManifest } from '../team-templates/presets.js';
import { createRoleAgent, getRoleRuntimeDefaults, isTeamRoleName } from '../team-templates/roles.js';
import { createManifestForTarget, normalizeManifest } from '../manifest/normalize.js';
import { getTarget } from '../renderers/registry.js';

export type InitTargetName = 'claude' | 'codex';
export type InitTargetSelection = InitTargetName | 'both';

export function resolveInitTargets(selection: InitTargetSelection = 'claude'): InitTargetName[] {
  return selection === 'both' ? ['claude', 'codex'] : [selection];
}

function cloneAgent(agent: CoreAgent): CoreAgent {
  return {
    ...agent,
    runtime: {
      ...agent.runtime,
      tools: agent.runtime.tools ? [...agent.runtime.tools] : undefined,
      disallowedTools: agent.runtime.disallowedTools ? [...agent.runtime.disallowedTools] : undefined,
      skillDocs: agent.runtime.skillDocs ? [...agent.runtime.skillDocs] : undefined,
      mcpServers: agent.runtime.mcpServers ? agent.runtime.mcpServers.map((server) => ({ ...server })) : undefined,
    },
    instructions: agent.instructions.map((block) => ({ ...block })),
    metadata: agent.metadata
      ? {
          handoffs: agent.metadata.handoffs ? [...agent.metadata.handoffs] : undefined,
          role: agent.metadata.role,
          template: agent.metadata.template,
        }
      : undefined,
  };
}

function inferBuiltInRole(agentId: string, agent: AgentConfig): TeamRoleName | undefined {
  if (isTeamRoleName(agentId)) {
    return agentId;
  }

  if (agent.forge?.role && isTeamRoleName(agent.forge.role)) {
    return agent.forge.role;
  }

  return undefined;
}

function cloneTargetConfig(
  targetConfig: TargetConfig | undefined,
  options?: { dropTargetSpecificFields?: boolean; targetName?: InitTargetName },
): TargetConfig | undefined {
  if (!targetConfig) return undefined;

  return {
    agents: Object.fromEntries(
      Object.entries(targetConfig.agents).map(([agentId, agent]) => [
        agentId,
        (() => {
          const roleName =
            options?.dropTargetSpecificFields && options.targetName
              ? inferBuiltInRole(agentId, agent)
              : undefined;
          const runtimeDefaults =
            roleName && options?.targetName
              ? getRoleRuntimeDefaults(roleName, options.targetName)
              : {};

          return {
          ...agent,
          model: options?.dropTargetSpecificFields ? runtimeDefaults.model : agent.model,
          reasoning_effort: options?.dropTargetSpecificFields ? runtimeDefaults.reasoningEffort : agent.reasoning_effort,
          tools: agent.tools ? [...agent.tools] : undefined,
          disallowed_tools: agent.disallowed_tools ? [...agent.disallowed_tools] : undefined,
          skills: agent.skills ? [...agent.skills] : undefined,
          mcp_servers: agent.mcp_servers?.map((server) => ({ ...server })),
          instruction_fragments: agent.instruction_fragments ? [...agent.instruction_fragments] : undefined,
          instruction_blocks: agent.instruction_blocks?.map((block) => ({ ...block })),
          capability_traits: agent.capability_traits ? [...agent.capability_traits] : undefined,
          forge: agent.forge
            ? {
                handoffs: agent.forge.handoffs ? [...agent.forge.handoffs] : undefined,
                role: agent.forge.role,
                template: agent.forge.template,
              }
            : undefined,
          } satisfies AgentConfig;
        })(),
      ]),
    ),
    policies: targetConfig.policies
      ? {
          ...targetConfig.policies,
          fragments: targetConfig.policies.fragments ? [...targetConfig.policies.fragments] : undefined,
          permissions: targetConfig.policies.permissions
            ? {
                ...targetConfig.policies.permissions,
                allow: targetConfig.policies.permissions.allow ? [...targetConfig.policies.permissions.allow] : undefined,
                ask: targetConfig.policies.permissions.ask ? [...targetConfig.policies.permissions.ask] : undefined,
                deny: targetConfig.policies.permissions.deny ? [...targetConfig.policies.permissions.deny] : undefined,
                rules: targetConfig.policies.permissions.rules
                  ? {
                      allow: targetConfig.policies.permissions.rules.allow
                        ? [...targetConfig.policies.permissions.rules.allow]
                        : undefined,
                      ask: targetConfig.policies.permissions.rules.ask
                        ? [...targetConfig.policies.permissions.rules.ask]
                        : undefined,
                      deny: targetConfig.policies.permissions.rules.deny
                        ? [...targetConfig.policies.permissions.rules.deny]
                        : undefined,
                    }
                  : undefined,
              }
            : undefined,
          sandbox: targetConfig.policies.sandbox
            ? {
                ...targetConfig.policies.sandbox,
                excluded_commands: targetConfig.policies.sandbox.excluded_commands
                  ? [...targetConfig.policies.sandbox.excluded_commands]
                  : undefined,
                network: targetConfig.policies.sandbox.network
                  ? {
                      allow_unix_sockets: targetConfig.policies.sandbox.network.allow_unix_sockets
                        ? [...targetConfig.policies.sandbox.network.allow_unix_sockets]
                        : undefined,
                      allow_local_binding: targetConfig.policies.sandbox.network.allow_local_binding,
                    }
                  : undefined,
              }
            : undefined,
          hooks: targetConfig.policies.hooks
            ? {
                pre_tool_use: targetConfig.policies.hooks.pre_tool_use?.map((entry) => ({ ...entry })),
                post_tool_use: targetConfig.policies.hooks.post_tool_use?.map((entry) => ({ ...entry })),
                notification: targetConfig.policies.hooks.notification?.map((entry) => ({ ...entry })),
              }
            : undefined,
          network: targetConfig.policies.network
            ? {
                allowed_domains: targetConfig.policies.network.allowed_domains
                  ? [...targetConfig.policies.network.allowed_domains]
                  : undefined,
              }
            : undefined,
          assertions: targetConfig.policies.assertions ? [...targetConfig.policies.assertions] : undefined,
        }
      : undefined,
    settings: targetConfig.settings
      ? {
          generate_docs: targetConfig.settings.generate_docs,
          generate_local_settings: targetConfig.settings.generate_local_settings,
        }
      : undefined,
  };
}

function mergeManifests(base: TeamCastManifest | undefined, extra: TeamCastManifest): TeamCastManifest {
  if (!base) return extra;

  return {
    ...base,
    claude: extra.claude ?? base.claude,
    codex: extra.codex ?? base.codex,
  };
}

export function buildManifestFromPreset(
  presetName: string,
  projectName: string,
  selection: InitTargetSelection = 'claude',
): TeamCastManifest {
  const presetManifest = buildPresetManifest(presetName);
  const manifest: TeamCastManifest = {
    ...presetManifest,
    project: {
      ...presetManifest.project,
      name: projectName,
    },
  };
  const sourceTarget = manifest.claude ?? manifest.codex;
  const targetNames = resolveInitTargets(selection);

  return {
    version: '2',
    project: { ...manifest.project },
    preset_meta: manifest.preset_meta ? { ...manifest.preset_meta } : undefined,
    claude: targetNames.includes('claude')
      ? cloneTargetConfig(manifest.claude ?? sourceTarget, {
          dropTargetSpecificFields: !manifest.claude,
          targetName: 'claude',
        })
      : undefined,
    codex: targetNames.includes('codex')
      ? cloneTargetConfig(manifest.codex ?? sourceTarget, {
          dropTargetSpecificFields: !manifest.codex,
          targetName: 'codex',
        })
      : undefined,
  };
}

export function buildTeamFromPreset(
  presetName: string,
  projectName: string,
  targetName: InitTargetName = 'claude',
): CoreTeam {
  const manifest = buildManifestFromPreset(presetName, projectName, targetName);
  return normalizeManifest(manifest, getTarget(targetName));
}

export function buildTeamFromRoles(
  projectName: string,
  roles: TeamRoleName[],
  targetName: InitTargetName = 'claude',
): CoreTeam {
  const targetContext = getTarget(targetName);
  const agents = Object.fromEntries(
    roles.map((roleName) => [roleName, createRoleAgent(roleName, targetContext)]),
  );

  if (agents.orchestrator && roles.length > 1) {
    agents.orchestrator = {
      ...agents.orchestrator,
      metadata: {
        ...agents.orchestrator.metadata,
        handoffs: roles.filter((role) => role !== 'orchestrator'),
      },
    };
  }

  return {
    version: '2',
    project: { name: projectName },
    agents,
    policies: createPolicies('custom-team'),
    settings: {
      generateDocs: true,
      generateLocalSettings: true,
    },
  };
}

export function buildManifestFromRoles(
  projectName: string,
  roles: TeamRoleName[],
  selection: InitTargetSelection = 'claude',
): TeamCastManifest {
  return buildManifestFromTeams(
    resolveInitTargets(selection).map((targetName) => ({
      targetName,
      team: buildTeamFromRoles(projectName, roles, targetName),
    })),
  );
}

export function buildSingleAgentTeam(projectName: string): CoreTeam {
  const claudeTarget = getTarget('claude');
  return {
    version: '2',
    project: { name: projectName },
    agents: {
      developer: createRoleAgent('developer', claudeTarget, {
        description: 'Full-stack developer. Handles implementation, testing, and debugging.',
        runtime: {
          model: 'sonnet',
          tools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'Agent'],
          skillDocs: ['test-first', 'clean-code'],
        },
        instructions: [
          {
            kind: 'behavior',
            content: 'You are a capable developer. Understand the task, read the relevant code, make a plan, implement with tests, and verify the result.',
          },
        ],
      }),
    },
    policies: createPolicies('single-agent'),
    settings: {
      generateDocs: true,
      generateLocalSettings: true,
    },
  };
}

export function buildSingleAgentTeamForTarget(
  projectName: string,
  targetName: InitTargetName = 'claude',
): CoreTeam {
  const targetContext = getTarget(targetName);
  const runtimeOverrides =
    targetName === 'claude'
      ? {
          model: 'sonnet',
          tools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'Agent'],
          skillDocs: ['test-first', 'clean-code'],
        }
      : {
          tools: ['read_file', 'write_file', 'execute_command', 'search_codebase'],
          skillDocs: ['test-first', 'clean-code'],
        };

  return {
    version: '2',
    project: { name: projectName },
    agents: {
      developer: createRoleAgent('developer', targetContext, {
        description: 'Full-stack developer. Handles implementation, testing, and debugging.',
        runtime: runtimeOverrides,
        instructions: [
          {
            kind: 'behavior',
            content: 'You are a capable developer. Understand the task, read the relevant code, make a plan, implement with tests, and verify the result.',
          },
        ],
      }),
    },
    policies: createPolicies('single-agent'),
    settings: {
      generateDocs: true,
      generateLocalSettings: true,
    },
  };
}

export function buildSingleAgentManifest(
  projectName: string,
  selection: InitTargetSelection = 'claude',
): TeamCastManifest {
  return buildManifestFromTeams(
    resolveInitTargets(selection).map((targetName) => ({
      targetName,
      team: buildSingleAgentTeamForTarget(projectName, targetName),
    })),
  );
}

export function buildManifestFromTeams(
  teams: Array<{ targetName: InitTargetName; team: CoreTeam }>,
): TeamCastManifest {
  let manifest: TeamCastManifest | undefined;
  for (const entry of teams) {
    manifest = mergeManifests(manifest, createManifestForTarget(entry.team, entry.targetName));
  }

  if (!manifest) {
    throw new Error('At least one target team is required');
  }

  return manifest;
}

export function addAgentToTeam(team: CoreTeam, name: string, agent: CoreAgent): CoreTeam {
  return {
    ...team,
    agents: {
      ...team.agents,
      [name]: {
        ...cloneAgent(agent),
        id: name,
      },
    },
  };
}

export function editAgentInTeam(team: CoreTeam, name: string, agent: CoreAgent): CoreTeam {
  return {
    ...team,
    agents: {
      ...team.agents,
      [name]: {
        ...cloneAgent(agent),
        id: name,
      },
    },
  };
}

export function removeAgentFromTeam(team: CoreTeam, name: string): CoreTeam {
  const remainingAgents = { ...team.agents };
  delete remainingAgents[name];

  for (const [agentName, agent] of Object.entries(remainingAgents)) {
    if (agent.metadata?.handoffs?.length) {
      remainingAgents[agentName] = {
        ...agent,
        metadata: {
          ...agent.metadata,
          handoffs: agent.metadata.handoffs.filter((handoff) => handoff !== name),
        },
      };
    }
  }

  return {
    ...team,
    agents: remainingAgents,
  };
}

export function assignSkillToAgents(team: CoreTeam, skill: string, agentNames: string[]): CoreTeam {
  return {
    ...team,
    agents: Object.fromEntries(
      Object.entries(team.agents).map(([agentName, agent]) => {
        if (!agentNames.includes(agentName)) {
          return [agentName, agent];
        }

        return [
          agentName,
          {
            ...agent,
            runtime: {
              ...agent.runtime,
              skillDocs: [...(agent.runtime.skillDocs ?? []), skill],
            },
          },
        ];
      }),
    ),
  };
}

export function updateAgentBasics(
  agent: CoreAgent,
  options: {
    description?: string;
    model?: string | null;
    reasoningEffort?: ReasoningEffort | null;
    maxTurns?: number;
    tools?: CoreAgent['runtime']['tools'];
    disallowedTools?: CoreAgent['runtime']['disallowedTools'];
  },
): CoreAgent {
  return {
    ...agent,
    description: options.description?.trim() || agent.description,
    runtime: {
      ...agent.runtime,
      model: options.model === undefined ? agent.runtime.model : options.model ?? undefined,
      reasoningEffort:
        options.reasoningEffort === undefined ? agent.runtime.reasoningEffort : options.reasoningEffort ?? undefined,
      maxTurns: options.maxTurns ?? agent.runtime.maxTurns,
      tools: options.tools ? [...options.tools] : agent.runtime.tools ? [...agent.runtime.tools] : undefined,
      disallowedTools: options.disallowedTools
        ? [...options.disallowedTools]
        : agent.runtime.disallowedTools
          ? [...agent.runtime.disallowedTools]
          : undefined,
    },
  };
}
