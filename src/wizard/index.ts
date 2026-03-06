import chalk from 'chalk';
import type { AgentForgeManifest } from '../types/manifest.js';
import { detectProjectContext } from '../detector/index.js';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import { stepProjectContext } from './steps/project-context.js';
import { stepTeamSelection } from './steps/team-selection.js';
import { stepConfirmGenerate } from './steps/confirm-generate.js';
import { printSuccess, printError } from '../utils/chalk-helpers.js';

export interface WizardOptions {
  cwd: string;
  skipConfirm?: boolean;
}

export async function runWizard(options: WizardOptions): Promise<void> {
  const { cwd, skipConfirm = false } = options;

  console.log('');
  console.log(chalk.bold('AgentForge') + chalk.dim(' — design your Claude Code agent team'));
  console.log('');

  const ctx = detectProjectContext(cwd);

  // Step 1: Project context
  let partial: Partial<AgentForgeManifest> = {};
  partial = await stepProjectContext(ctx, partial);

  // Step 2: Team selection (preset or single agent)
  const manifest = (await stepTeamSelection(partial)) as AgentForgeManifest;

  // Ensure version is set
  manifest.version = '1';

  // Step 3: Confirm + generate
  const confirmed = await stepConfirmGenerate(manifest, cwd, skipConfirm);

  if (!confirmed) {
    console.log(chalk.dim('\nAborted. No files were written.'));
    return;
  }

  // Write manifest and generate files
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

  console.log('');
  console.log(chalk.green(`✓ Agent team initialized for project "${manifest.project.name}"`));
  console.log('');
  console.log('Next steps:');
  console.log(`  ${chalk.dim('1.')} ${chalk.bold('agentforge explain')}   — view the team structure`);
  console.log(`  ${chalk.dim('2.')} ${chalk.bold('agentforge validate')}  — check for configuration issues`);
  console.log(`  ${chalk.dim('3.')} Edit ${chalk.bold('agentforge.yaml')} and run ${chalk.bold('agentforge generate')} to apply changes`);
  console.log('');
}
