import chalk from 'chalk';
import type { TeamCastManifest } from '../../manifest/types.js';
import { promptCheckbox } from '../../utils/prompts.js';
import {
  listRoleTemplates,
  type TeamRoleName,
} from '../../team-templates/roles.js';
import type { InitTargetSelection } from '../../application/team.js';
import { buildManifestFromRoles } from '../../application/team.js';

export async function stepCustomTeam(
  projectName: string,
  selection: InitTargetSelection = 'claude',
): Promise<TeamCastManifest> {
  const roleTemplates = listRoleTemplates();
  const selectedRoles = await promptCheckbox<TeamRoleName>({
    message: 'Select roles for your team:',
    choices: roleTemplates.map((role) => ({
      name: `${chalk.bold(role.label.padEnd(20))} ${chalk.dim(role.description)}`,
      value: role.name,
    })),
    validate: (value: TeamRoleName[]) => value.length > 0 || 'Select at least one role',
  });

  return buildManifestFromRoles(projectName, selectedRoles, selection);
}
