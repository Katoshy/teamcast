import { existsSync } from 'fs';
import { join } from 'path';
import type { TeamCastPlugin } from '../types.js';

export const pythonEnvPlugin: TeamCastPlugin = {
  name: 'python-env',
  version: '1.0.0',
  description: 'Python environment profile, auto-detected via pyproject.toml or requirements.txt',
  
  detect: (cwd: string) => 
    existsSync(join(cwd, 'pyproject.toml')) || 
    existsSync(join(cwd, 'requirements.txt')) ||
    existsSync(join(cwd, 'setup.py')),
  
  wizard: {
    suggest: true,
  },

  policies: {
    sandbox: {
      enabled: true,
    },
    permissions: {
      rules: {
        allow: [
          'Bash(pytest *)',
          'Bash(python -m pytest *)',
          'Bash(uv run *)',
          'Bash(poetry run *)',
          'Bash(python *)'
        ]
      }
    }
  },

  instruction_fragments: {
    'python_testing': 'To run tests, use `pytest`. If using poetry or uv, prefix with `poetry run` or `uv run`.',
  }
};
