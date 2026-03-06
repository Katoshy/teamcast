import inquirer from 'inquirer';
import chalk from 'chalk';
import type { AgentForgeManifest } from '../../types/manifest.js';
import { generate } from '../../generator/index.js';

export async function stepConfirmGenerate(
  manifest: AgentForgeManifest,
  cwd: string,
  skipConfirm = false,
): Promise<boolean> {
  // Show preview of files to be generated
  const files = generate(manifest, { cwd, dryRun: true });

  console.log('');
  console.log(chalk.bold('Files that will be created:'));
  for (const f of files) {
    console.log(`  ${chalk.dim('·')} ${f.path}`);
  }
  console.log('');

  if (skipConfirm) return true;

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Generate these files?',
      default: true,
    },
  ]);

  return confirmed;
}
