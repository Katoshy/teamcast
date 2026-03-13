import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import { detectProjectContext } from '../detector/index.js';
import { validateSchema } from '../manifest/schema-validator.js';
import { applyDefaults } from '../manifest/defaults.js';
import {
  evaluateTeam,
  teamHasBlockingIssues,
  printManifestValidation,
} from '../application/validate-team.js';
import {
  buildManifestFromPreset,
  type InitTargetSelection,
} from '../application/team.js';
import { listPresetMetas } from '../team-templates/presets.js';
import { abortCli } from './errors.js';
import {
  printHeader,
  printSuccess,
  printError,
  printCommandSuccess,
  printNextSteps,
} from '../utils/chalk-helpers.js';
import { runWizard } from '../wizard/index.js';
import { resolveDetectedProjectPlugins } from '../wizard/steps/plugin-selection.js';

function parseInitTargetSelection(value: string | undefined): InitTargetSelection {
  if (!value) {
    return 'claude';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'claude' || normalized === 'codex' || normalized === 'both') {
    return normalized;
  }

  printError('Invalid --target', 'Use one of: claude, codex, both');
  abortCli(1);
}

export async function runInitCommand(options: { preset?: string; from?: string; target?: string; yes?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const ctx = detectProjectContext(cwd);
  const targetSelection = parseInitTargetSelection(options.target);

  if (options.from) {
    await initFromFile(options.from, cwd, ctx.name);
    return;
  }

  if (options.preset) {
    await initWithPreset(options.preset, cwd, ctx.name, targetSelection);
    return;
  }

  await runWizard({
    cwd,
    skipConfirm: options.yes,
    nonInteractive: options.yes,
    targetSelection,
  });
}

export { registerInitCommand } from './registrars/init.js';

async function initWithPreset(
  presetName: string,
  cwd: string,
  detectedName: string | undefined,
  targetSelection: InitTargetSelection,
): Promise<void> {
  printHeader('Init');
  console.log(chalk.dim(`Using preset ${chalk.bold(presetName)} for ${chalk.bold(targetSelection)}`));
  console.log('');

  try {
    buildManifestFromPreset(presetName, detectedName ?? 'my-project', targetSelection);
  } catch (err) {
    printError('Unknown preset', String(err));
    console.log('');
    console.log('Available presets:');
    for (const entry of listPresetMetas()) {
      console.log(`  ${chalk.bold(entry.name)}  ${chalk.dim(entry.description)}`);
    }
    abortCli(1);
  }

  const projectName = detectedName ?? 'my-project';
  const manifest = buildManifestFromPreset(presetName, projectName, targetSelection);
  manifest.plugins = resolveDetectedProjectPlugins(cwd, manifest.plugins);
  const validation = evaluateTeam(manifest, { cwd });

  if (teamHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    abortCli(1);
  }

  try {
    writeManifest(manifest, cwd);
  } catch (err) {
    printError('Failed to write teamcast.yaml', String(err));
    abortCli(1);
  }

  printHeader('Generate');

  let files;
  try {
    files = generate(manifest, { cwd });
  } catch (err) {
    printError('Generation failed', String(err));
    abortCli(1);
  }

  for (const file of files) {
    printSuccess(file.path);
  }

  printCommandSuccess(`Initialized "${presetName}" for project "${projectName}"`);
  printManifestValidation(validation);
  printNextSteps([
    `Run ${chalk.bold('teamcast explain')} to see the team structure`,
    `Open ${chalk.bold('teamcast.yaml')} to customize the team`,
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
    abortCli(1);
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    printError('Failed to read file', String(err));
    abortCli(1);
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err) {
    printError('Failed to parse YAML', String(err));
    abortCli(1);
  }

  const schemaResult = validateSchema(parsed);
  if (!schemaResult.valid) {
    printError('Schema validation failed', '');
    for (const error of schemaResult.errors) {
      console.error(chalk.dim(`  ${error.path}: ${error.message}`));
    }
    abortCli(1);
  }

  const manifest = applyDefaults(schemaResult.data);
  if (detectedName && manifest.project.name === 'my-project') {
    manifest.project.name = detectedName;
  }

  const validation = evaluateTeam(manifest, { cwd });

  if (teamHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    abortCli(1);
  }

  try {
    writeManifest(manifest, cwd);
  } catch (err) {
    printError('Failed to write teamcast.yaml', String(err));
    abortCli(1);
  }

  printHeader('Generate');

  let files;
  try {
    files = generate(manifest, { cwd });
  } catch (err) {
    printError('Generation failed', String(err));
    abortCli(1);
  }

  for (const file of files) {
    printSuccess(file.path);
  }

  printCommandSuccess(`Initialized from ${filePath}`);
  printManifestValidation(validation);
  printNextSteps([
    `Run ${chalk.bold('teamcast explain')} to see the team structure`,
    `Open ${chalk.bold('teamcast.yaml')} to customize`,
  ]);
}
