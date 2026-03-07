import type { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { importFromClaudeDir } from '../importer/index.js';
import { writeManifest } from '../manifest/writer.js';
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
  printWarning,
  printCommandSuccess,
  printNextSteps,
} from '../utils/chalk-helpers.js';
import { promptConfirm } from '../utils/prompts.js';

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('Import existing .claude/ configuration into agentforge.yaml')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options: { yes?: boolean }) => {
      const cwd = process.cwd();

      printHeader('Import');

      const claudeDir = join(cwd, '.claude');
      if (!existsSync(claudeDir)) {
        printError('No .claude/ directory found', 'Nothing to import.');
        process.exit(1);
      }

      const manifestPath = join(cwd, 'agentforge.yaml');
      if (existsSync(manifestPath)) {
        printError('agentforge.yaml already exists', 'Use "agentforge generate" to update from existing manifest.');
        process.exit(1);
      }

      const ctx = detectProjectContext(cwd);
      const projectName = ctx.name ?? 'my-project';
      const result = importFromClaudeDir(cwd, projectName);

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          printWarning(warning.file, warning.message);
        }
        console.log('');
      }

      const agentNames = Object.keys(result.manifest.agents);
      if (agentNames.length === 0) {
        printError('No agents found', 'No .claude/agents/*.md files to import.');
        process.exit(1);
      }

      console.log(chalk.dim(`  Found ${agentNames.length} agent${agentNames.length !== 1 ? 's' : ''}:`));
      for (const name of agentNames) {
        const agent = result.manifest.agents[name];
        console.log(chalk.dim(`    ${name} - ${agent.claude.description}`));
      }

      if (result.manifest.policies) {
        const parts: string[] = [];
        if (result.manifest.policies.permissions) parts.push('permissions');
        if (result.manifest.policies.sandbox) parts.push('sandbox');
        if (result.manifest.policies.hooks) parts.push('hooks');
        if (parts.length > 0) {
          console.log(chalk.dim(`  Policies: ${parts.join(', ')}`));
        }
      }
      console.log('');

      const validation = evaluateManifest(result.manifest);

      if (manifestHasBlockingIssues(validation)) {
        printManifestValidation(validation);
        printError('Imported configuration has errors', 'Fix the issues above and try again.');
        process.exit(1);
      }

      if (!options.yes) {
        const confirmed = await promptConfirm({
          message: 'Write agentforge.yaml with imported configuration?',
          default: true,
        });
        if (!confirmed) {
          console.log(chalk.dim('Aborted.'));
          return;
        }
      }

      try {
        writeManifest(result.manifest, cwd);
      } catch (err) {
        printError('Failed to write agentforge.yaml', String(err));
        process.exit(1);
      }

      printSuccess('agentforge.yaml');
      printManifestValidation(validation);
      printCommandSuccess(`Imported ${agentNames.length} agent${agentNames.length !== 1 ? 's' : ''} from .claude/`);
      printNextSteps([
        `Run ${chalk.bold('agentforge validate')} to check the configuration`,
        `Run ${chalk.bold('agentforge explain')} to see the team structure`,
        `Edit ${chalk.bold('agentforge.yaml')} to customize, then run ${chalk.bold('agentforge generate')}`,
      ]);
    });
}
