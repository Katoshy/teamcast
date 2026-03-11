import { existsSync } from 'fs';
import { join } from 'path';
import type { TeamCastPlugin } from '../types.js';

export const nodeEnvPlugin: TeamCastPlugin = {
  name: 'node-env',
  version: '1.0.0',
  description: 'Node.js environment profile, auto-detected via package.json',
  
  detect: (cwd: string) => existsSync(join(cwd, 'package.json')),
  
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
          'Bash(npm run *)',
          'Bash(npm test *)',
          'Bash(npx *)',
          'Bash(npm install)',
          'Bash(node *)'
        ]
      }
    }
  },

  instruction_fragments: {
    'node_testing': 'To run tests, use `npm test`. To execute scripts, use `npm run <script>`.',
  }
};
