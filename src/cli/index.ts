import type { Command } from 'commander';
import { registerInitCommand } from './registrars/init.js';
import { registerGenerateCommand } from './registrars/generate.js';
import { registerValidateCommand } from './registrars/validate.js';
import { registerExplainCommand } from './registrars/explain.js';
import { registerDiffCommand } from './registrars/diff.js';
import { registerManageCommands } from './registrars/manage.js';
import { registerResetCommand } from './registrars/reset.js';
import { registerImportCommand } from './registrars/import.js';

export function registerAllCommands(program: Command): void {
  registerInitCommand(program);
  registerGenerateCommand(program);
  registerValidateCommand(program);
  registerExplainCommand(program);
  registerDiffCommand(program);
  registerManageCommands(program);
  registerResetCommand(program);
  registerImportCommand(program);
}
