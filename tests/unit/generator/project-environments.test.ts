import { describe, expect, it } from 'vitest';
import { generate } from '../../../src/generator/index.js';
import { buildManifestFromRoles } from '../../../src/application/team.js';

describe('project plugin overlays in generation', () => {
  it('applies plugin instruction fragments only to execute-capable agents across both targets', () => {
    const manifest = buildManifestFromRoles('demo-app', ['planner', 'developer'], 'both');
    manifest.plugins = ['node-env'];

    const files = generate(manifest, { cwd: process.cwd(), dryRun: true });
    const claudeDeveloper = files.find((file) => file.path === '.claude/agents/developer.md');
    const claudePlanner = files.find((file) => file.path === '.claude/agents/planner.md');
    const codexDeveloper = files.find((file) => file.path === '.codex/agents/developer.toml');
    const codexPlanner = files.find((file) => file.path === '.codex/agents/planner.toml');

    expect(claudeDeveloper?.content).toContain('npm test');
    expect(codexDeveloper?.content).toContain('npm test');
    expect(claudePlanner?.content).not.toContain('npm test');
    expect(codexPlanner?.content).not.toContain('npm test');
  });
});
