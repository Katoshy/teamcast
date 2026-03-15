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
      node_code_patterns: {
        content: [
          'This is a Node.js project.',
          'Use ESM module syntax (import/export). All relative imports must use .js extensions.',
          'Prefer named exports over default exports.',
          'Use TypeScript strict mode when tsconfig.json is present.',
        ].join('\n'),
        requires_capabilities: ['read_files'],
      },
      node_development: {
        content: [
          'Install dependencies with `npm install`.',
          'Use `npm run <script>` to execute package.json scripts.',
          'Prefer async/await over raw Promises or callbacks.',
          'Handle errors at system boundaries. Use typed error classes where the project defines them.',
        ].join('\n'),
        requires_capabilities: ['write_files'],
      },
      node_testing: {
        content: [
          'Run tests with `npm test`.',
          'Run a specific test file with `npx vitest run <path>` (vitest) or `npx jest <path>` (jest).',
          'Always run tests after making changes to verify nothing broke.',
          'Follow existing test patterns: check the tests/ directory for conventions before writing new tests.',
        ].join('\n'),
        requires_capabilities: ['execute', 'write_files'],
      },
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
      python_code_patterns: {
        content: [
          'This is a Python project.',
          'Follow PEP 8 style conventions.',
          'Use type hints for function signatures and class attributes.',
          'Prefer pathlib.Path over os.path for file operations.',
        ].join('\n'),
        requires_capabilities: ['read_files'],
      },
      python_development: {
        content: [
          'If using poetry: `poetry install` and `poetry run <cmd>`. If using uv: `uv sync` and `uv run <cmd>`.',
          'Otherwise use pip and virtualenv.',
          'Use structured logging (logging module) instead of print statements.',
          'Handle exceptions with specific types, not bare except clauses.',
        ].join('\n'),
        requires_capabilities: ['write_files'],
      },
      python_testing: {
        content: [
          'Run tests with `pytest`. If using poetry or uv, prefix with `poetry run` or `uv run`.',
          'Run a specific test: `pytest <path>::<test_name>`.',
          'Always run tests after changes. Follow existing test patterns in the tests/ directory.',
          'Use fixtures for shared setup. Prefer parametrize for similar test cases.',
        ].join('\n'),
        requires_capabilities: ['execute', 'write_files'],
      },
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
