import { describe, expect, it } from 'vitest';
import { PluginRegistry } from '../../../src/plugins/registry.js';
import type { TeamCastPlugin } from '../../../src/plugins/types.js';

function createPlugin(plugin: Partial<TeamCastPlugin> & Pick<TeamCastPlugin, 'name'>): TeamCastPlugin {
  return {
    scope: plugin.scope ?? 'project-plugin',
    name: plugin.name,
    version: plugin.version ?? '1.0.0',
    description: plugin.description,
    kind: plugin.kind,
    models: plugin.models,
    skills: plugin.skills,
    tools: plugin.tools,
    presets: plugin.presets,
    policies: plugin.policies,
    detect: plugin.detect,
    wizard: plugin.wizard,
    instruction_fragments: plugin.instruction_fragments,
  };
}

describe('PluginRegistry', () => {
  it('fails fast on duplicate capability keys', () => {
    const registry = new PluginRegistry();

    registry.register(createPlugin({
      name: 'alpha',
      models: {
        sonnet: {
          id: 'sonnet',
          displayName: 'Sonnet',
          target: 'claude',
          features: ['general'],
        },
      },
    }));

    expect(() => {
      registry.register(createPlugin({
        name: 'beta',
        models: {
          sonnet: {
            id: 'sonnet',
            displayName: 'Conflicting Sonnet',
            target: 'claude',
            features: ['general'],
          },
        },
      }));
    }).toThrow('conflicts on model "sonnet"');
  });
});
