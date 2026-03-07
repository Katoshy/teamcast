import chalk from 'chalk';
import type { AgentForgeManifest } from '../../types/manifest.js';
import { generate } from '../../generator/index.js';
import { promptConfirm } from '../../utils/prompts.js';

export async function stepConfirmGenerate(
  manifest: AgentForgeManifest,
  cwd: string,
  skipConfirm = false,
): Promise<boolean> {
  const files = generate(manifest, { cwd, dryRun: true });

  console.log('');
  console.log(chalk.bold('Files that will be created:'));
  for (const file of files) {
    console.log(`  ${chalk.dim('-')} ${file.path}`);
  }
  console.log('');

  if (skipConfirm) return true;

  return promptConfirm({
    message: 'Generate these files?',
    default: true,
  });
}
