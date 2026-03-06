import chalk from 'chalk';

export const icons = {
  success: chalk.green('✓'),
  error: chalk.red('✗'),
  warning: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
  arrow: chalk.dim('→'),
  bullet: chalk.dim('●'),
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
}

export function printDim(text: string): void {
  console.log(chalk.dim(text));
}
