import type { Command } from 'commander';
import chalk from 'chalk';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { applyDefaults } from '../manifest/defaults.js';
import { normalizeManifest } from '../manifest/normalize.js';
import { buildExplanation } from '../explainer/index.js';
import { getRegisteredTargetNames, getTarget } from '../renderers/registry.js';

export function runExplainCommand(): void {
  const cwd = process.cwd();

  let manifest;
  try {
    manifest = readManifest(cwd);
  } catch (err) {
    if (err instanceof ManifestError) {
      console.error(chalk.red(`\nError: ${err.message}`));
      if (err.details?.length) {
        for (const d of err.details) console.error(chalk.dim(`  ${d}`));
      }
      process.exit(1);
    }
    throw err;
  }

  console.log('');

  const rawManifest = applyDefaults(manifest);
  const rawManifestRecord = rawManifest as unknown as Record<string, unknown>;
  const registeredTargets = getRegisteredTargetNames();
  let foundAny = false;

  for (const targetName of registeredTargets) {
    if (rawManifestRecord[targetName]) {
      foundAny = true;
      const targetContext = getTarget(targetName);
      console.log(chalk.cyan.bold(`\n=== Target: ${targetName.toUpperCase()} ===`));
      const coreTeam = normalizeManifest(rawManifest, targetContext);
      console.log(buildExplanation(coreTeam, targetContext));
    }
  }

  if (!foundAny) {
    console.log(chalk.yellow('No targets defined in teamcast.yaml (e.g., claude:, codex:)'));
  }
}

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Show a human-readable view of the agent team architecture')
    .action(runExplainCommand);
}
