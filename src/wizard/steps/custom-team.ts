import chalk from 'chalk';
import type { CoreTeam } from '../../core/types.js';
import { promptCheckbox } from '../../utils/prompts.js';
import {
  listRoleTemplates,
  type TeamRoleName,
} from '../../team-templates/roles.js';
import { buildTeamFromRoles } from '../../application/team.js';

export async function stepCustomTeam(projectName: string): Promise<CoreTeam> {
  const roleTemplates = listRoleTemplates();
  const selectedRoles = await promptCheckbox<TeamRoleName>({
    message: 'Select roles for your team:',
    choices: roleTemplates.map((role) => ({
      name: `${chalk.bold(role.label.padEnd(20))} ${chalk.dim(role.description)}`,
      value: role.name,
    })),
    validate: (value: TeamRoleName[]) => value.length > 0 || 'Select at least one role',
  });

  return buildTeamFromRoles(projectName, selectedRoles);
}
