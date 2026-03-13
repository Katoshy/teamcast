import type { TeamCastPlugin } from '../types.js';

export const coreToolsPlugin: TeamCastPlugin = {
  scope: 'core-catalog',
  name: 'core-tools',
  version: '1.0.0',
  description: 'Provides basic system tools and default skills',
  
  // These tools are available to all setups by default
  tools: {
    read_file: { name: 'read_file', description: 'Read file contents' },
    write_file: { name: 'write_file', description: 'Write or modify file contents' },
    execute_command: { name: 'execute_command', description: 'Execute a bash command in the project directory' },
    search_codebase: { name: 'search_codebase', description: 'Search the codebase for keywords or regex' },
    web_search: { name: 'web_search', description: 'Search the web for documentation or answers' },
  },

  // Base skills that orchestrators and generators expect to exist
  skills: {
    read_files: { id: 'read_files', description: 'Read files' },
    write_files: { id: 'write_files', description: 'Write files' },
    execute: { id: 'execute', description: 'Execute commands' },
    search: { id: 'search', description: 'Search the codebase' },
    web: { id: 'web', description: 'Web access' },
    delegate: { id: 'delegate', description: 'Delegate tasks' },
    interact: { id: 'interact', description: 'Interact with user' },
    notebook: { id: 'notebook', description: 'Jupyter Notebook' },
  },

  // Base policies that apply if no other plugin overrides them
  policies: {
    sandbox: {
      enabled: true,
      excluded_commands: [
        'rm -rf /',
        'mkfs',
      ],
    },
    permissions: {
      rules: {
        allow: [
          'Bash(git diff *)',
          'Bash(git status)',
          'Bash(git log)',
        ]
      }
    }
  }
};
