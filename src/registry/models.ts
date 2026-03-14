// Model catalog — moved from src/plugins/core/models-plugin.ts.

import type { ModelDefinition } from './types.js';

export const MODEL_CATALOG: Record<string, ModelDefinition> = {
  opus: {
    id: 'opus',
    displayName: 'Claude Opus 4.6',
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
    displayName: 'Claude Haiku 4.5',
    target: 'claude',
    features: ['fast', 'economical'],
  },
  'gpt-5.3-codex': {
    id: 'gpt-5.3-codex',
    displayName: 'GPT-5.3-Codex',
    target: 'codex',
    features: ['tools', 'reasoning'],
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
};
