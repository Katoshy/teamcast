import chalk from 'chalk';
import type { AgentForgeManifest, AgentConfig } from '../../types/manifest.js';
import { promptCheckbox } from '../../utils/prompts.js';
import {
  createRoleAgent,
  listRoleTemplates,
  type TeamRoleName,
} from '../../team-templates/roles.js';
import { createPolicies } from '../../team-templates/policies.js';

export async function stepCustomTeam(
  partial: Partial<AgentForgeManifest>,
): Promise<Partial<AgentForgeManifest>> {
  const roleTemplates = listRoleTemplates();
  const selectedRoles = await promptCheckbox<TeamRoleName>({
    message: 'Select roles for your team:',
    choices: roleTemplates.map((role) => ({
      name: `${chalk.bold(role.label.padEnd(20))} ${chalk.dim(role.description)}`,
      value: role.name,
    })),
    validate: (value: TeamRoleName[]) => value.length > 0 || 'Select at least one role',
  });

  const agents: Record<string, AgentConfig> = {};

  for (const roleName of selectedRoles) {
    agents[roleName] = createRoleAgent(roleName);
  }

  if (agents.orchestrator && selectedRoles.length > 1) {
    agents.orchestrator.forge = {
      ...agents.orchestrator.forge,
      handoffs: selectedRoles.filter((role) => role !== 'orchestrator'),
    };
  }

  return {
    ...partial,
    version: '1',
    project: partial.project ?? { name: 'my-project' },
    agents,
    policies: createPolicies('custom-team'),
  } as AgentForgeManifest;
}
