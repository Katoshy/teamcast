import type { Command } from 'commander';
import chalk from 'chalk';
import { listPresets, loadPreset, applyPreset } from '../presets/index.js';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import { detectProjectContext } from '../detector/index.js';
import {
  evaluateManifest,
  manifestHasBlockingIssues,
  printManifestValidation,
} from './manifest-validation.js';
import {
  printHeader,
  printSuccess,
  printError,
  printCommandSuccess,
  printNextSteps,
} from '../utils/chalk-helpers.js';
import { runWizard } from '../wizard/index.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize an agent team configuration in the current project')
    .option('--preset <name>', 'Skip the wizard and use a preset directly')
    .option('--yes', 'Accept all defaults without prompting')
    .action(async (options: { preset?: string; yes?: boolean }) => {
      const cwd = process.cwd();
      const ctx = detectProjectContext(cwd);

      if (options.preset) {
        await initWithPreset(options.preset, cwd, ctx.name);
        return;
      }

      await runWizard({
        cwd,
        skipConfirm: options.yes,
        nonInteractive: options.yes,
      });
    });
}

async function initWithPreset(
  presetName: string,
  cwd: string,
  detectedName: string | undefined,
): Promise<void> {
  printHeader('Init');
  console.log(chalk.dim(`Using preset ${chalk.bold(presetName)}`));
  console.log('');

  let preset;
  try {
    preset = loadPreset(presetName);
  } catch (err) {
    printError('Unknown preset', String(err));
    console.log('');
    console.log('Available presets:');
    for (const entry of listPresets()) {
      console.log(`  ${chalk.bold(entry.name)}  ${chalk.dim(entry.description)}`);
    }
    process.exit(1);
  }

  const projectName = detectedName ?? 'my-project';
  const manifest = applyPreset(preset, projectName);
  const validation = evaluateManifest(manifest);

  if (manifestHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    process.exit(1);
  }

  try {
    writeManifest(manifest, cwd);
  } catch (err) {
    printError('Failed to write agentforge.yaml', String(err));
    process.exit(1);
  }

  printHeader('Generate');

  let files;
  try {
    files = generate(manifest, { cwd });
  } catch (err) {
    printError('Generation failed', String(err));
    process.exit(1);
  }

  for (const file of files) {
    printSuccess(file.path);
  }

  printCommandSuccess(`Initialized "${presetName}" for project "${projectName}"`);
  printManifestValidation(validation);
  printNextSteps([
    `Run ${chalk.bold('agentforge explain')} to see the team structure`,
    `Open ${chalk.bold('agentforge.yaml')} to customize the team`,
  ]);
}
