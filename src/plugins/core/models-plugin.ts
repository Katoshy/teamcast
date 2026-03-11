import type { TeamCastPlugin } from '../types.js';

export const coreModelsPlugin: TeamCastPlugin = {
  name: 'core-models',
  version: '1.0.0',
  description: 'Registers default Anthropic and Codex models',
  models: {
    'claude-3-opus': {
      id: 'claude-3-5-opus-20240229',
      displayName: 'Claude 3.5 Opus',
      features: ['vision', 'tools'],
    },
    'claude-3-sonnet': {
      id: 'claude-3-5-sonnet-20241022',
      displayName: 'Claude 3.5 Sonnet',
      features: ['vision', 'tools', 'fast'],
    },
    'gpt-4o': {
      id: 'gpt-4o',
      displayName: 'GPT-4o (Codex)',
      features: ['vision', 'tools'],
    },
    'o3-mini': {
      id: 'o3-mini',
      displayName: 'o3-mini (Codex)',
      features: ['reasoning'],
    }
  }
};
