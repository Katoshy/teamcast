#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { registerAllCommands } from './cli/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
let version = '0.1.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  version = pkg.version ?? version;
} catch {
  // ignore
}

const program = new Command();

program
  .name('teamcast')
  .description('CLI to design, generate, and validate Claude Code agent teams from a single manifest')
  .version(version, '-v, --version');

registerAllCommands(program);

program.parseAsync(process.argv);
