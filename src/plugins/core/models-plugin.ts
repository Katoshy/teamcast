import type { TeamCastPlugin } from '../types.js';

export const coreModelsPlugin: TeamCastPlugin = {
  name: 'core-models',
  version: '1.0.0',
  description: 'Registers default Anthropic and Codex models',
  models: {
    opus: {
      id: 'opus',
      displayName: 'Claude Opus',
      target: 'claude',
      features: ['quality', 'tools'],
    },
    sonnet: {
      id: 'sonnet',
      displayName: 'Claude 4.6 Sonnet',
      target: 'claude',
      features: ['vision', 'tools', 'fast', 'reasoning'],
    },
    haiku: {
      id: 'haiku',
      displayName: 'Claude Haiku',
      target: 'claude',
      features: ['fast', 'economical'],
    },
    'gpt-5.2-codex': {
      id: 'gpt-5.2-codex',
      displayName: 'GPT-5.2-Codex',
      target: 'codex',
      features: ['tools', 'reasoning'],
    },
    'gpt-5-codex': {
      id: 'gpt-5-codex',
      displayName: 'GPT-5-Codex',
      target: 'codex',
      features: ['tools', 'reasoning'],
    },
    'gpt-5.1-codex-mini': {
      id: 'gpt-5.1-codex-mini',
      displayName: 'GPT-5.1-Codex Mini',
      target: 'codex',
      features: ['tools', 'fast'],
    },
  },
};
