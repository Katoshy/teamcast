import chalk from 'chalk';

export const icons = {
  success: chalk.green('[ok]'),
  error: chalk.red('[x]'),
  warning: chalk.yellow('[!]'),
  info: chalk.blue('[i]'),
  arrow: chalk.dim('->'),
  bullet: chalk.dim('-'),
};

export function printSuccess(label: string, detail?: string): void {
  const msg = detail ? `${chalk.bold(label)}  ${chalk.dim(detail)}` : chalk.bold(label);
  console.log(`  ${icons.success} ${msg}`);
}

export function printError(label: string, detail?: string): void {
  const msg = detail ? `${chalk.bold(label)}  ${chalk.red(detail)}` : chalk.bold(label);
  console.log(`  ${icons.error} ${msg}`);
}

export function printWarning(label: string, detail?: string): void {
  const msg = detail ? `${chalk.bold(label)}  ${chalk.yellow(detail)}` : chalk.bold(label);
  console.log(`  ${icons.warning} ${msg}`);
}

export function printInfo(label: string, detail?: string): void {
  const msg = detail ? `${chalk.bold(label)}  ${chalk.dim(detail)}` : chalk.bold(label);
  console.log(`  ${icons.info} ${msg}`);
}

export function printHeader(text: string): void {
  console.log('');
  console.log(chalk.bold(text));
  console.log('');
}

export function printDim(text: string): void {
  console.log(chalk.dim(text));
}

export function printCommandSuccess(summary: string): void {
  console.log('');
  console.log(chalk.green(`${icons.success} ${summary}`));
}

export function printBulletList(items: string[]): void {
  for (const item of items) {
    console.log(`  ${icons.bullet} ${item}`);
  }
}

export function printNextSteps(steps: string[]): void {
  console.log('');
  console.log(chalk.bold('Next steps'));
  for (const [index, step] of steps.entries()) {
    console.log(`  ${chalk.dim(`${index + 1}.`)} ${step}`);
  }
  console.log('');
}
