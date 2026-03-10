import type { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { importFromClaudeDir, importFromCodexDir } from '../importer/index.js';
import { createManifestForTarget } from '../manifest/normalize.js';
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

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('Import existing .claude/ and/or .codex/ configuration into teamcast.yaml')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options: { yes?: boolean }) => {
      const cwd = process.cwd();

      printHeader('Import');

      const claudeDir = join(cwd, '.claude');
      const codexDir = join(cwd, '.codex');
      const hasClaude = existsSync(claudeDir);
      const hasCodex = existsSync(codexDir);
      if (!hasClaude && !hasCodex) {
        printError('No target directories found', 'Expected .claude/ and/or .codex/.');
        process.exit(1);
      }

      const manifestPath = join(cwd, 'teamcast.yaml');
      if (existsSync(manifestPath)) {
        printError('teamcast.yaml already exists', 'Use "teamcast generate" to update from existing manifest.');
        process.exit(1);
      }

      const ctx = detectProjectContext(cwd);
      const projectName = ctx.name ?? 'my-project';
      const importedTargets: Array<{ targetName: 'claude' | 'codex'; agentNames: string[] }> = [];
      let manifest: TeamCastManifest | undefined;

      const mergeManifest = (nextManifest: TeamCastManifest) => {
        manifest = manifest
          ? {
              ...manifest,
              claude: nextManifest.claude ?? manifest.claude,
              codex: nextManifest.codex ?? manifest.codex,
            }
          : nextManifest;
      };

      if (hasClaude) {
        const result = importFromClaudeDir(cwd, projectName);

        if (result.warnings.length > 0) {
          for (const warning of result.warnings) {
            printWarning(warning.file, warning.message);
          }
          console.log('');
        }

        const agentNames = Object.keys(result.team.agents);
        if (agentNames.length > 0) {
          importedTargets.push({ targetName: 'claude', agentNames });
          mergeManifest(createManifestForTarget(result.team, 'claude'));

          console.log(chalk.dim(`  Claude: ${agentNames.length} agent${agentNames.length !== 1 ? 's' : ''}`));
          for (const name of agentNames) {
            const agent = result.team.agents[name];
            console.log(chalk.dim(`    ${name} - ${agent.description}`));
          }

          if (result.team.policies) {
            const parts: string[] = [];
            if (result.team.policies.permissions) parts.push('permissions');
            if (result.team.policies.sandbox) parts.push('sandbox');
            if (result.team.policies.hooks) parts.push('hooks');
            if (parts.length > 0) {
              console.log(chalk.dim(`  Claude policies: ${parts.join(', ')}`));
            }
          }
          console.log('');
        }
      }

      if (hasCodex) {
        const result = importFromCodexDir(cwd, projectName);

        if (result.warnings.length > 0) {
          for (const warning of result.warnings) {
            printWarning(warning.file, warning.message);
          }
          console.log('');
        }

        const agentNames = Object.keys(result.team.agents);
        if (agentNames.length > 0) {
          importedTargets.push({ targetName: 'codex', agentNames });
          mergeManifest(createManifestForTarget(result.team, 'codex'));

          console.log(chalk.dim(`  Codex: ${agentNames.length} agent${agentNames.length !== 1 ? 's' : ''}`));
          for (const name of agentNames) {
            const agent = result.team.agents[name];
            console.log(chalk.dim(`    ${name} - ${agent.description}`));
          }
          console.log('');
        }
      }

      if (!manifest || importedTargets.length === 0) {
        printError('No agents found', 'No importable agents were found in .claude/agents or .codex/agents.');
        process.exit(1);
      }

      const validation = evaluateTeam(manifest);

      if (teamHasBlockingIssues(validation)) {
        printManifestValidation(validation);
        printError('Imported configuration has errors', 'Fix the issues above and try again.');
        process.exit(1);
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
        process.exit(1);
      }

      printSuccess('teamcast.yaml');
      printManifestValidation(validation);
      printCommandSuccess(`Imported ${importedTargets.map((entry) => `${entry.agentNames.length} ${entry.targetName}`).join(', ')}`);
      printNextSteps([
        `Run ${chalk.bold('teamcast validate')} to check the configuration`,
        `Run ${chalk.bold('teamcast explain')} to see the team structure`,
        `Edit ${chalk.bold('teamcast.yaml')} to customize, then run ${chalk.bold('teamcast generate')}`,
      ]);
    });
}
