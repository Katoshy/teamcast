import type { Command } from 'commander';
import chalk from 'chalk';
import { listPresets, loadPreset, applyPreset } from '../presets/index.js';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import { detectProjectContext } from '../detector/index.js';
import { printHeader, printSuccess, printError, printDim } from '../utils/chalk-helpers.js';
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
        // Fast path: preset specified on CLI
        await initWithPreset(options.preset, cwd, ctx.name);
      } else {
        // Interactive wizard
        await runWizard({ cwd, skipConfirm: options.yes });
      }
    });
}

async function initWithPreset(
  presetName: string,
  cwd: string,
  detectedName: string | undefined,
): Promise<void> {
  printHeader(`Initializing with preset: ${chalk.bold(presetName)}`);

  // Load preset
  let preset;
  try {
    preset = loadPreset(presetName);
  } catch (err) {
    printError('Unknown preset', String(err));
    console.log('');
    console.log('Available presets:');
    for (const p of listPresets()) {
      console.log(`  ${chalk.bold(p.name)}  ${chalk.dim(p.description)}`);
    }
    process.exit(1);
  }

  // Apply project name
  const projectName = detectedName ?? 'my-project';
  const manifest = applyPreset(preset, projectName);

  // Write manifest
  try {
    writeManifest(manifest, cwd);
  } catch (err) {
    printError('Failed to write agentforge.yaml', String(err));
    process.exit(1);
  }

  // Generate files
  printHeader('Generating configuration files...');
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

  console.log('');
  console.log(chalk.green(`\n✓ Agent team "${presetName}" initialized for project "${projectName}"`));
  console.log('');
  console.log('Next steps:');
  console.log(`  ${chalk.dim('1.')} Run ${chalk.bold('agentforge explain')} to see the team structure`);
  console.log(`  ${chalk.dim('2.')} Run ${chalk.bold('agentforge validate')} to check for issues`);
  console.log(`  ${chalk.dim('3.')} Open ${chalk.bold('agentforge.yaml')} to customize the team`);
  console.log('');
}
