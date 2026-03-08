import type { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { listPresets, loadPreset, applyPreset } from '../presets/index.js';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import { detectProjectContext } from '../detector/index.js';
import { validateSchema } from '../manifest/schema-validator.js';
import { applyDefaults } from '../manifest/defaults.js';
import type { AgentForgeManifest } from '../manifest/types.js';
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
    .option('--from <path>', 'Initialize from a custom YAML manifest file')
    .option('--yes', 'Accept all defaults without prompting')
    .action(async (options: { preset?: string; from?: string; yes?: boolean }) => {
      const cwd = process.cwd();
      const ctx = detectProjectContext(cwd);

      if (options.from) {
        await initFromFile(options.from, cwd, ctx.name);
        return;
      }

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
  const team = applyPreset(preset, projectName);
  const validation = evaluateManifest(team);

  if (manifestHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    process.exit(1);
  }

  try {
    writeManifest(team, cwd);
  } catch (err) {
    printError('Failed to write agentforge.yaml', String(err));
    process.exit(1);
  }

  printHeader('Generate');

  let files;
  try {
    files = generate(team, { cwd });
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

async function initFromFile(
  filePath: string,
  cwd: string,
  detectedName: string | undefined,
): Promise<void> {
  printHeader('Init');
  console.log(chalk.dim(`Loading from ${chalk.bold(filePath)}`));
  console.log('');

  if (!existsSync(filePath)) {
    printError('File not found', filePath);
    process.exit(1);
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    printError('Failed to read file', String(err));
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err) {
    printError('Failed to parse YAML', String(err));
    process.exit(1);
  }

  const { valid, errors } = validateSchema(parsed);
  if (!valid) {
    printError('Schema validation failed', '');
    for (const error of errors) {
      console.error(chalk.dim(`  ${error.path}: ${error.message}`));
    }
    process.exit(1);
  }

  const team = applyDefaults(parsed as AgentForgeManifest);
  if (detectedName && team.project.name === 'my-project') {
    team.project.name = detectedName;
  }

  const validation = evaluateManifest(team);

  if (manifestHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    process.exit(1);
  }

  try {
    writeManifest(team, cwd);
  } catch (err) {
    printError('Failed to write agentforge.yaml', String(err));
    process.exit(1);
  }

  printHeader('Generate');

  let files;
  try {
    files = generate(team, { cwd });
  } catch (err) {
    printError('Generation failed', String(err));
    process.exit(1);
  }

  for (const file of files) {
    printSuccess(file.path);
  }

  printCommandSuccess(`Initialized from ${filePath}`);
  printManifestValidation(validation);
  printNextSteps([
    `Run ${chalk.bold('agentforge explain')} to see the team structure`,
    `Open ${chalk.bold('agentforge.yaml')} to customize`,
  ]);
}
