#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

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

const args = process.argv.slice(2);
if (args.length > 0 && args.every((arg) => arg === '-v' || arg === '--version')) {
  process.stdout.write(`${version}\n`);
  process.exit(0);
}

const [{ Command }, { registerAllCommands }] = await Promise.all([
  import('commander'),
  import('./cli/index.js'),
]);

const program = new Command();

program
  .name('teamcast')
  .description('CLI to design, generate, and validate multi-target agent teams from a single manifest')
  .version(version, '-v, --version');

registerAllCommands(program);

await program.parseAsync(process.argv);
