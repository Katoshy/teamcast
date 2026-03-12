import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { getDetectedImportHandlers } from '../importer/index.js';
import {
  getManifestTargetConfig,
  setManifestTargetConfig,
} from '../manifest/targets.js';
import { writeManifest } from '../manifest/writer.js';
import { detectProjectContext } from '../detector/index.js';
import type { TeamCastManifest } from '../manifest/types.js';
import {
  evaluateTeam,
  teamHasBlockingIssues,
  printManifestValidation,
} from '../application/validate-team.js';
import {
  printHeader,
  printSuccess,
  printError,
  printWarning,
  printCommandSuccess,
  printNextSteps,
} from '../utils/chalk-helpers.js';
import { promptConfirm } from '../utils/prompts.js';
import { abortCli } from './errors.js';

export async function runImportCommand(options: { yes?: boolean }): Promise<void> {
  const cwd = process.cwd();

  printHeader('Import');

  const detectedHandlers = getDetectedImportHandlers(cwd);
  if (detectedHandlers.length === 0) {
    printError('No target directories found', 'Expected .claude/ and/or .codex/.');
    abortCli(1);
  }

  const manifestPath = join(cwd, 'teamcast.yaml');
  if (existsSync(manifestPath)) {
    printError('teamcast.yaml already exists', 'Use "teamcast generate" to update from existing manifest.');
    abortCli(1);
  }

  const ctx = detectProjectContext(cwd);
  const projectName = ctx.name ?? 'my-project';
  const importedTargets: Array<{ targetName: string; agentNames: string[] }> = [];
  let manifest: TeamCastManifest | undefined;

  const mergeManifest = (nextManifest: TeamCastManifest, targetName: 'claude' | 'codex') => {
    const targetConfig = getManifestTargetConfig(nextManifest, targetName);
    if (!targetConfig) {
      return;
    }

    manifest = manifest
      ? setManifestTargetConfig(manifest, targetName, targetConfig)
      : nextManifest;
  };

  const formatTargetLabel = (targetName: string) => targetName.charAt(0).toUpperCase() + targetName.slice(1);

  for (const handler of detectedHandlers) {
    const result = handler.importFromDir(cwd, projectName);
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        printWarning(warning.file, warning.message);
      }
      console.log('');
    }

    const targetConfig = getManifestTargetConfig(result.team, handler.targetName);
    const agents = targetConfig?.agents ?? {};
    const agentNames = Object.keys(agents);
    if (agentNames.length > 0) {
      importedTargets.push({ targetName: handler.targetName, agentNames });
      mergeManifest(result.team, handler.targetName);

      console.log(chalk.dim(`  ${formatTargetLabel(handler.targetName)}: ${agentNames.length} agent${agentNames.length !== 1 ? 's' : ''}`));
      for (const name of agentNames) {
        const agent = agents[name];
        console.log(chalk.dim(`    ${name} - ${agent.description}`));
      }

      if (targetConfig?.policies) {
        const parts: string[] = [];
        if (targetConfig.policies.permissions) parts.push('permissions');
        if (targetConfig.policies.sandbox) parts.push('sandbox');
        if (targetConfig.policies.hooks) parts.push('hooks');
        if (parts.length > 0) {
          console.log(chalk.dim(`  ${formatTargetLabel(handler.targetName)} policies: ${parts.join(', ')}`));
        }
      }
      console.log('');
    }
  }

  if (!manifest || importedTargets.length === 0) {
    printError('No agents found', 'No importable agents were found in .claude/agents or .codex/agents.');
    abortCli(1);
  }

  const validation = evaluateTeam(manifest, { cwd });

  if (teamHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    printError('Imported configuration has errors', 'Fix the issues above and try again.');
    abortCli(1);
  }

  if (!options.yes) {
    const confirmed = await promptConfirm({
      message: 'Write teamcast.yaml with imported configuration?',
      default: true,
    });
    if (!confirmed) {
      console.log(chalk.dim('Aborted.'));
      return;
    }
  }

  try {
    writeManifest(manifest, cwd);
  } catch (err) {
    printError('Failed to write teamcast.yaml', String(err));
    abortCli(1);
  }

  printSuccess('teamcast.yaml');
  printManifestValidation(validation);
  printCommandSuccess(`Imported ${importedTargets.map((entry) => `${entry.agentNames.length} ${entry.targetName}`).join(', ')}`);
  printNextSteps([
    `Run ${chalk.bold('teamcast validate')} to check the configuration`,
    `Run ${chalk.bold('teamcast explain')} to see the team structure`,
    `Edit ${chalk.bold('teamcast.yaml')} to customize, then run ${chalk.bold('teamcast generate')}`,
  ]);
}

export { registerImportCommand } from './registrars/import.js';
