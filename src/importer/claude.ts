import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { CoreAgent, CoreTeam } from '../core/types.js';
import { createManifestForTarget } from '../manifest/normalize.js';
import { getTarget } from '../renderers/registry.js';
import {
  parseClaudeAgentFile,
  parseClaudeSettingsJson,
} from './shared.js';
import type { ImportHandler, ImportResult, ImportWarning } from './types.js';

export function importFromClaudeDir(cwd: string, projectName: string): ImportResult {
  const warnings: ImportWarning[] = [];
  const agents: Record<string, CoreAgent> = {};
  const targetContext = getTarget('claude');

  const agentsDir = join(cwd, '.claude', 'agents');
  if (existsSync(agentsDir)) {
    const files = readdirSync(agentsDir).filter((file) => file.endsWith('.md'));
    for (const file of files) {
      const filePath = join(agentsDir, file);
      const result = parseClaudeAgentFile(filePath, targetContext);
      agents[result.name] = result.agent;
      warnings.push(...result.warnings);
    }
  }

  if (Object.keys(agents).length === 0) {
    warnings.push({ file: agentsDir, message: 'No agent .md files found in .claude/agents/' });
  }

  let policies: CoreTeam['policies'];
  const settingsPath = join(cwd, '.claude', 'settings.json');
  if (existsSync(settingsPath)) {
    const result = parseClaudeSettingsJson(settingsPath);
    policies = result.policies;
    warnings.push(...result.warnings);
  }

  return {
    team: createManifestForTarget({
      version: '2',
      project: { name: projectName },
      agents,
      policies,
      settings: {
        generateDocs: true,
        generateLocalSettings: true,
      },
    }, 'claude'),
    warnings,
  };
}

export const claudeImportHandler: ImportHandler = {
  targetName: 'claude',
  detect(cwd: string) {
    return existsSync(join(cwd, '.claude'));
  },
  importFromDir: importFromClaudeDir,
};
