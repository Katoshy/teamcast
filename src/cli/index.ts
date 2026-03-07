import type { Command } from 'commander';
import { registerInitCommand } from './init.js';
import { registerGenerateCommand } from './generate.js';
import { registerValidateCommand } from './validate.js';
import { registerExplainCommand } from './explain.js';
import { registerDiffCommand } from './diff.js';
import { registerManageCommands } from './manage.js';
import { registerResetCommand } from './reset.js';

export function registerAllCommands(program: Command): void {
  registerInitCommand(program);
  registerGenerateCommand(program);
  registerValidateCommand(program);
  registerExplainCommand(program);
  registerDiffCommand(program);
  registerManageCommands(program);
  registerResetCommand(program);
}
