import chalk from 'chalk';
import type { InitTargetSelection } from '../application/team.js';
import { detectProjectContext } from '../detector/index.js';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import { stepProjectContext } from './steps/project-context.js';
import { stepTargetSelection } from './steps/target-selection.js';
import { stepTeamSelection } from './steps/team-selection.js';
import { stepConfirmGenerate } from './steps/confirm-generate.js';
import { stepAgentCustomization } from './steps/agent-customization.js';
import { stepEnvironmentSelection } from './steps/environment-selection.js';
import { normalizeManifest, replaceManifestTarget } from '../manifest/normalize.js';
import { getTarget, getRegisteredTargetNames } from '../renderers/registry.js';
import { evaluateTeam, teamHasBlockingIssues, printManifestValidation } from '../application/validate-team.js';
import {
  printSuccess,
  printError,
  printHeader,
  printCommandSuccess,
  printNextSteps,
} from '../utils/chalk-helpers.js';
import { abortCli } from '../cli/errors.js';

export interface WizardOptions {
  cwd: string;
  skipConfirm?: boolean;
  nonInteractive?: boolean;
  targetSelection?: InitTargetSelection;
}

export async function runWizard(options: WizardOptions): Promise<void> {
  const { cwd, skipConfirm = false, nonInteractive = false, targetSelection } = options;

  printHeader('Init');
  console.log(chalk.dim('Design your agent team'));
  console.log('');

  const ctx = detectProjectContext(cwd);

  const projectPartial = await stepProjectContext(ctx, undefined, { nonInteractive });
  const selection = await stepTargetSelection({
    nonInteractive,
    defaultSelection: targetSelection,
  });

  let rawManifest = await stepTeamSelection(projectPartial, selection, { nonInteractive });
  const activeTargetNames = getRegisteredTargetNames().filter((targetName) => {
    const rawManifestRecord = rawManifest as unknown as Record<string, unknown>;
    return Boolean(rawManifestRecord[targetName]);
  });

  for (const targetName of getRegisteredTargetNames()) {
    const rawManifestRecord = rawManifest as unknown as Record<string, unknown>;
    if (!rawManifestRecord[targetName]) {
      continue;
    }

    if (!nonInteractive && activeTargetNames.length > 1) {
      console.log('');
      console.log(chalk.bold(`Customize ${targetName} target`));
    }

    const targetContext = getTarget(targetName);
    const normalizedTeam = normalizeManifest(rawManifest, targetContext);
    const customizedTeam = await stepAgentCustomization(normalizedTeam, targetContext, { nonInteractive });
    rawManifest = replaceManifestTarget(rawManifest, targetName, customizedTeam);
  }

  rawManifest.project.environments = await stepEnvironmentSelection(cwd, rawManifest.project.environments, { nonInteractive });
  const validation = evaluateTeam(rawManifest, { cwd });
  if (teamHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    abortCli(1);
  }

  const confirmed = await stepConfirmGenerate(rawManifest, cwd, skipConfirm || nonInteractive);
  if (!confirmed) {
    console.log(chalk.dim('\nAborted. No files were written.'));
    return;
  }

  try {
    writeManifest(rawManifest, cwd);
  } catch (err) {
    printError('Failed to write teamcast.yaml', String(err));
    abortCli(1);
  }

  let files;
  try {
    files = generate(rawManifest, { cwd });
  } catch (err) {
    printError('Generation failed', String(err));
    abortCli(1);
  }

  console.log('');
  for (const file of files) {
    printSuccess(file.path);
  }

  printCommandSuccess(`Agent team initialized for project "${rawManifest.project.name}"`);
  printManifestValidation(validation);
  printNextSteps([
    `Open ${chalk.bold('teamcast.yaml')} and fill in agent instructions based on ${chalk.yellow('// TODO')} comments`,
    `${chalk.bold('teamcast explain')} - view the team structure`,
    `Run ${chalk.bold('teamcast generate')} to apply your changes`,
  ]);
}
