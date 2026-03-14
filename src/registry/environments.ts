import { existsSync } from 'fs';
import { join } from 'path';
import type { EnvironmentDef, EnvironmentId } from './types.js';

const ENVIRONMENTS: Record<EnvironmentId, EnvironmentDef> = {
  node: {
    id: 'node',
    description: 'Node.js environment, auto-detected via package.json',
    detect: (cwd: string) => existsSync(join(cwd, 'package.json')),
    policyRules: {
      sandbox: { enabled: true },
      allow: [
        'Bash(npm run *)',
        'Bash(npm test *)',
        'Bash(npx *)',
        'Bash(npm install)',
        'Bash(node *)',
      ],
    },
    instructionFragments: {
      node_testing: 'To run tests, use `npm test`. To execute scripts, use `npm run <script>`.',
    },
  },
  python: {
    id: 'python',
    description: 'Python environment, auto-detected via pyproject.toml or requirements.txt',
    detect: (cwd: string) =>
      existsSync(join(cwd, 'pyproject.toml')) ||
      existsSync(join(cwd, 'requirements.txt')) ||
      existsSync(join(cwd, 'setup.py')),
    policyRules: {
      sandbox: { enabled: true },
      allow: [
        'Bash(pytest *)',
        'Bash(python -m pytest *)',
        'Bash(uv run *)',
        'Bash(poetry run *)',
        'Bash(python *)',
      ],
    },
    instructionFragments: {
      python_testing: 'To run tests, use `pytest`. If using poetry or uv, prefix with `poetry run` or `uv run`.',
    },
  },
};

export function getEnvironment(id: EnvironmentId): EnvironmentDef {
  return ENVIRONMENTS[id];
}

export function listEnvironments(): EnvironmentDef[] {
  return Object.values(ENVIRONMENTS);
}

export function detectEnvironments(cwd: string): EnvironmentId[] {
  return Object.values(ENVIRONMENTS)
    .filter((env) => env.detect(cwd))
    .map((env) => env.id);
}
