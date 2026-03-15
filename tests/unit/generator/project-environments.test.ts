import { describe, expect, it } from 'vitest';
import { generate } from '../../../src/generator/index.js';
import { buildManifestFromRoles } from '../../../src/application/team.js';

describe('project environment overlays in generation', () => {
  it('applies testing instructions only to agents with execute + write_files', () => {
    const manifest = buildManifestFromRoles('demo-app', ['planner', 'developer'], 'both');
    manifest.project.environments = ['node'];

    const files = generate(manifest, { cwd: process.cwd(), dryRun: true });
    const claudeDeveloper = files.find((file) => file.path === '.claude/agents/developer.md');
    const claudePlanner = files.find((file) => file.path === '.claude/agents/planner.md');
    const codexDeveloper = files.find((file) => file.path === '.codex/agents/developer.toml');
    const codexPlanner = files.find((file) => file.path === '.codex/agents/planner.toml');

    // developer has execute + write_files → gets testing instructions
    expect(claudeDeveloper?.content).toContain('npm test');
    expect(codexDeveloper?.content).toContain('npm test');
    // planner lacks write_files → no testing instructions
    expect(claudePlanner?.content).not.toContain('npm test');
    expect(codexPlanner?.content).not.toContain('npm test');
  });

  it('applies code pattern instructions to all agents with read_files', () => {
    const manifest = buildManifestFromRoles('demo-app', ['planner', 'developer'], 'both');
    manifest.project.environments = ['node'];

    const files = generate(manifest, { cwd: process.cwd(), dryRun: true });
    const claudeDeveloper = files.find((file) => file.path === '.claude/agents/developer.md');
    const claudePlanner = files.find((file) => file.path === '.claude/agents/planner.md');

    // both planner and developer have read_files → get code pattern instructions
    expect(claudeDeveloper?.content).toContain('ESM module syntax');
    expect(claudePlanner?.content).toContain('ESM module syntax');
  });

  it('does not inject development instructions to reviewer (no write_files)', () => {
    const manifest = buildManifestFromRoles('demo-app', ['developer', 'reviewer'], 'claude');
    manifest.project.environments = ['node'];

    const files = generate(manifest, { cwd: process.cwd(), dryRun: true });
    const claudeReviewer = files.find((file) => file.path === '.claude/agents/reviewer.md');
    const claudeDeveloper = files.find((file) => file.path === '.claude/agents/developer.md');

    // reviewer has execute + read_files but no write_files → no testing, no development
    expect(claudeReviewer?.content).not.toContain('npm test');
    expect(claudeReviewer?.content).not.toContain('npm install');
    // reviewer gets code patterns (read_files)
    expect(claudeReviewer?.content).toContain('ESM module syntax');
    // developer gets everything
    expect(claudeDeveloper?.content).toContain('npm test');
    expect(claudeDeveloper?.content).toContain('ESM module syntax');
  });
});
