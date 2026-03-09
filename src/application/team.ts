import type { CoreAgent, CoreTeam, ModelAlias } from '../core/types.js';
import { CLAUDE_CODE_TOOLS } from '../renderers/claude/tools.js';
import type { TeamRoleName } from '../team-templates/roles.js';
import { createPolicies } from '../team-templates/policies.js';
import { createRoleAgent } from '../team-templates/roles.js';
import { applyPreset, loadPreset } from '../presets/index.js';

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

export function buildTeamFromPreset(presetName: string, projectName: string): CoreTeam {
  const preset = loadPreset(presetName);
  return applyPreset(preset, projectName);
}

export function buildTeamFromRoles(projectName: string, roles: TeamRoleName[]): CoreTeam {
  const agents = Object.fromEntries(
    roles.map((roleName) => [roleName, createRoleAgent(roleName)]),
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
      defaultModel: 'sonnet',
      generateDocs: true,
      generateLocalSettings: true,
    },
  };
}

export function buildSingleAgentTeam(projectName: string): CoreTeam {
  return {
    version: '2',
    project: { name: projectName },
    agents: {
      developer: createRoleAgent('developer', {
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
      defaultModel: 'sonnet',
      generateDocs: true,
      generateLocalSettings: true,
    },
  };
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
    model?: ModelAlias;
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
      model: options.model ?? agent.runtime.model,
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

export function buildCustomAgent(config: {
  name: string;
  description: string;
  model: Exclude<ModelAlias, 'inherit'>;
  canWrite: boolean;
  canBash: boolean;
  canWeb: boolean;
  canDelegate: boolean;
}): CoreAgent {
  const allow: CoreAgent['runtime']['tools'] = ['Read', 'Grep', 'Glob'];
  const deny: CoreAgent['runtime']['disallowedTools'] = [];

  if (config.canWrite) {
    allow.push('Write', 'Edit', 'MultiEdit');
  } else {
    deny.push('Write', 'Edit');
  }

  if (config.canBash) {
    allow.push('Bash');
  } else {
    deny.push('Bash');
  }

  if (config.canWeb) {
    allow.push('WebFetch', 'WebSearch');
  } else {
    deny.push('WebFetch', 'WebSearch');
  }

  if (config.canDelegate) {
    allow.push('Agent');
  }

  return {
    id: config.name,
    description: config.description.trim(),
    runtime: {
      model: config.model,
      tools: allow,
      disallowedTools: deny.length > 0 ? deny : undefined,
    },
    instructions: [
      {
        kind: 'behavior',
        content: `You are ${config.name}. Focus on the responsibilities described in your role and use your allowed tools appropriately.`,
      },
    ],
  };
}

export function invertToolSelection(tools: NonNullable<CoreAgent['runtime']['tools']>) {
  return CLAUDE_CODE_TOOLS.filter((tool) => !tools.includes(tool));
}
