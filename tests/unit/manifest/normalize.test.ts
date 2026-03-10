import { describe, expect, it } from 'vitest';
import {
  createManifestForTarget,
  denormalizeTarget,
  normalizeManifest,
} from '../../../src/manifest/normalize.js';
import type { CoreTeam } from '../../../src/core/types.js';
import type { TeamCastManifest } from '../../../src/manifest/types.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import { createCodexTarget } from '../../../src/renderers/codex/index.js';

const claudeTarget = createClaudeTarget();
const codexTarget = createCodexTarget();

describe('manifest normalization', () => {
  it('normalizes a claude target block into the core team model', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'normalize-claude' },
      settings: {
        generate_docs: false,
      },
      policies: {
        permissions: {
          allow: ['project.commands'],
          deny: ['Write(.env*)'],
        },
      },
      claude: {
        agents: {
          developer: {
            description: 'Builds the feature',
            model: 'sonnet',
            tools: ['read_files', 'Bash'],
            disallowed_tools: ['web'],
            skills: ['test-first'],
            instruction_blocks: [
              {
                kind: 'behavior',
                content: 'Implement the requested change.',
              },
            ],
            forge: {
              handoffs: ['reviewer'],
              role: 'developer',
            },
          },
        },
      },
    };

    const team = normalizeManifest(manifest, claudeTarget);

    expect(team.project.name).toBe('normalize-claude');
    expect(team.settings).toEqual({
      generateDocs: false,
      generateLocalSettings: true,
    });
    expect(team.policies?.permissions?.allow).toEqual(['project.commands']);
    expect(team.policies?.permissions?.deny).toEqual(['env.write']);
    expect(team.agents.developer.runtime.tools).toEqual(['Read', 'Grep', 'Glob', 'Bash']);
    expect(team.agents.developer.runtime.disallowedTools).toEqual(['WebFetch', 'WebSearch']);
    expect(team.agents.developer.runtime.skillDocs).toEqual(['test-first']);
    expect(team.agents.developer.metadata).toEqual({
      handoffs: ['reviewer'],
      role: 'developer',
      template: undefined,
    });
  });

  it('selects the requested target block when multiple targets exist', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'multi-target' },
      claude: {
        agents: {
          developer: {
            description: 'Claude developer',
            tools: ['Read', 'Write'],
          },
        },
      },
      codex: {
        agents: {
          developer: {
            description: 'Codex developer',
            model: 'gpt-5.2-codex',
            reasoning_effort: 'high',
            tools: ['read_files', 'execute'],
          },
        },
      },
    };

    const team = normalizeManifest(manifest, codexTarget);

    expect(team.agents.developer.description).toBe('Codex developer');
    expect(team.agents.developer.runtime.tools).toEqual([
      'read_file',
      'search_codebase',
      'execute_command',
    ]);
    expect(team.agents.developer.runtime.model).toBe('gpt-5.2-codex');
    expect(team.agents.developer.runtime.reasoningEffort).toBe('high');
  });

  it('denormalizes a core team into a target config', () => {
    const team: CoreTeam = {
      version: '2',
      project: {
        name: 'roundtrip-project',
        description: 'Roundtrip fixture',
      },
      agents: {
        reviewer: {
          id: 'reviewer',
          description: 'Reviews changes',
          runtime: {
            model: 'gpt-5.2-codex',
            reasoningEffort: 'high',
            tools: ['read_file', 'search_codebase', 'execute_command'],
            disallowedTools: ['write_file'],
            skillDocs: ['code-review'],
            maxTurns: 6,
            permissionMode: 'plan',
            background: true,
          },
          instructions: [
            {
              kind: 'behavior',
              content: 'Review the implementation carefully.',
            },
          ],
          metadata: {
            handoffs: ['developer'],
            role: 'reviewer',
            template: 'review-template',
          },
        },
      },
      policies: {
        permissions: {
          allow: ['project.commands'],
          deny: ['env.write'],
        },
      },
      settings: {
        generateDocs: false,
        generateLocalSettings: false,
      },
      presetMeta: {
        author: 'teamcast',
        tags: ['review'],
        minVersion: '2.0.0',
      },
    };

    expect(denormalizeTarget(team, 'codex')).toEqual({
      agents: {
        reviewer: {
          description: 'Reviews changes',
          model: 'gpt-5.2-codex',
          reasoning_effort: 'high',
          tools: ['read_file', 'search_codebase', 'execute_command'],
          disallowed_tools: ['write_file'],
          skills: ['code-review'],
          max_turns: 6,
          mcp_servers: undefined,
          permission_mode: 'plan',
          instruction_blocks: [
            {
              kind: 'behavior',
              content: 'Review the implementation carefully.',
            },
          ],
          background: true,
          forge: {
            handoffs: ['developer'],
            role: 'reviewer',
            template: 'review-template',
          },
        },
      },
    });
  });

  it('creates a single-target raw manifest explicitly under the selected target root', () => {
    const team: CoreTeam = {
      version: '2',
      project: {
        name: 'roundtrip-project',
        description: 'Roundtrip fixture',
      },
      agents: {
        reviewer: {
          id: 'reviewer',
          description: 'Reviews changes',
          runtime: {
            model: 'sonnet',
            tools: ['Read', 'Grep', 'Glob', 'Bash'],
            disallowedTools: ['Write', 'Edit'],
            skillDocs: ['code-review'],
            maxTurns: 6,
            permissionMode: 'plan',
            background: true,
          },
          instructions: [
            {
              kind: 'behavior',
              content: 'Review the implementation carefully.',
            },
          ],
          metadata: {
            handoffs: ['developer'],
            role: 'reviewer',
            template: 'review-template',
          },
        },
      },
      policies: {
        permissions: {
          allow: ['project.commands'],
          deny: ['env.write'],
        },
      },
      settings: {
        generateDocs: false,
        generateLocalSettings: false,
      },
      presetMeta: {
        author: 'teamcast',
        tags: ['review'],
        minVersion: '2.0.0',
      },
    };

    const manifest = createManifestForTarget(team, 'claude');

    expect(manifest.version).toBe('2');
    expect(manifest.project).toEqual({
      name: 'roundtrip-project',
      preset: undefined,
      description: 'Roundtrip fixture',
    });
    expect(manifest.claude?.agents.reviewer).toEqual({
      description: 'Reviews changes',
      model: 'sonnet',
      tools: ['Read', 'Grep', 'Glob', 'Bash'],
      disallowed_tools: ['Write', 'Edit'],
      skills: ['code-review'],
      max_turns: 6,
      mcp_servers: undefined,
      permission_mode: 'plan',
      instruction_blocks: [
        {
          kind: 'behavior',
          content: 'Review the implementation carefully.',
        },
      ],
      background: true,
      forge: {
        handoffs: ['developer'],
        role: 'reviewer',
        template: 'review-template',
      },
    });
    expect(manifest.settings).toEqual({
      generate_docs: false,
      generate_local_settings: false,
    });
    expect(manifest.policies?.permissions?.deny).toEqual(['env.write']);
    expect(manifest.preset_meta).toEqual({
      author: 'teamcast',
      tags: ['review'],
      min_version: '2.0.0',
    });
  });
});
