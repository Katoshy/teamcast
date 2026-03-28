import inquirer from 'inquirer';

type PromptValidator<T> = (value: T) => true | string | Promise<true | string>;

export interface PromptChoice<T extends string> {
  name: string;
  value: T;
  checked?: boolean;
}

export async function promptInput(options: {
  message: string;
  default?: string;
  validate?: PromptValidator<string>;
}): Promise<string> {
  const answers = await inquirer.prompt<{ value: string }>([
    {
      type: 'input',
      name: 'value',
      message: options.message,
      default: options.default,
      validate: options.validate,
    },
  ]);

  return answers.value;
}

export async function promptConfirm(options: {
  message: string;
  default?: boolean;
}): Promise<boolean> {
  const answers = await inquirer.prompt<{ value: boolean }>([
    {
      type: 'confirm',
      name: 'value',
      message: options.message,
      default: options.default,
    },
  ]);

  return answers.value;
}

export async function promptList<T extends string>(options: {
  message: string;
  choices: PromptChoice<T>[];
  default?: T;
}): Promise<T> {
  const answers = await inquirer.prompt<{ value: T }>([
    {
      type: 'select',
      name: 'value',
      message: options.message,
      choices: options.choices,
      default: options.default,
    },
  ]);

  return answers.value;
}

export async function promptCheckbox<T extends string>(options: {
  message: string;
  choices: PromptChoice<T>[];
  default?: T[];
  validate?: PromptValidator<T[]>;
}): Promise<T[]> {
  const answers = await inquirer.prompt<{ value: T[] }>([
    {
      type: 'checkbox',
      name: 'value',
      message: options.message,
      choices: options.choices,
      default: options.default,
      validate: options.validate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inquirer checkbox type mismatch: validate + generic choices
    } as any,
  ]);

  return answers.value;
}
