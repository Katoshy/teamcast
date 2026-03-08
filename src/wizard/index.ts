import chalk from 'chalk';
import type { AgentForgeManifest, NormalizedAgentForgeManifest } from '../types/manifest.js';
import { detectProjectContext } from '../detector/index.js';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import { stepProjectContext } from './steps/project-context.js';
import { stepTeamSelection } from './steps/team-selection.js';
import { stepConfirmGenerate } from './steps/confirm-generate.js';
import { stepAgentCustomization } from './steps/agent-customization.js';
import {
  evaluateManifest,
  manifestHasBlockingIssues,
  printManifestValidation,
} from '../cli/manifest-validation.js';
import {
  printSuccess,
  printError,
  printHeader,
  printCommandSuccess,
  printNextSteps,
} from '../utils/chalk-helpers.js';

export interface WizardOptions {
  cwd: string;
  skipConfirm?: boolean;
  nonInteractive?: boolean;
}

export async function runWizard(options: WizardOptions): Promise<void> {
  const { cwd, skipConfirm = false, nonInteractive = false } = options;

  printHeader('Init');
  console.log(chalk.dim('Design your Claude Code agent team'));
  console.log('');

  const ctx = detectProjectContext(cwd);

  let partial: Partial<AgentForgeManifest> = {};
  partial = await stepProjectContext(ctx, partial, { nonInteractive });

  let manifest = (await stepTeamSelection(partial, { nonInteractive })) as NormalizedAgentForgeManifest;
  manifest.version = '1';
  manifest = await stepAgentCustomization(manifest, { nonInteractive });

  const validation = evaluateManifest(manifest);
  if (manifestHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    process.exit(1);
  }

  const confirmed = await stepConfirmGenerate(manifest, cwd, skipConfirm || nonInteractive);
  if (!confirmed) {
    console.log(chalk.dim('\nAborted. No files were written.'));
    return;
  }

  try {
    writeManifest(manifest, cwd);
  } catch (err) {
    printError('Failed to write agentforge.yaml', String(err));
    process.exit(1);
  }

  let files;
  try {
    files = generate(manifest, { cwd });
  } catch (err) {
    printError('Generation failed', String(err));
    process.exit(1);
  }

  console.log('');
  for (const file of files) {
    printSuccess(file.path);
  }

  printCommandSuccess(`Agent team initialized for project "${manifest.project.name}"`);
  printManifestValidation(validation);
  printNextSteps([
    `${chalk.bold('agentforge explain')} - view the team structure`,
    `Edit ${chalk.bold('agentforge.yaml')} and run ${chalk.bold('agentforge generate')} to apply changes`,
  ]);
}
