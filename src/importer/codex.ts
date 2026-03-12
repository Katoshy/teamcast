import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { CoreAgent } from '../core/types.js';
import { createManifestForTarget } from '../manifest/normalize.js';
import { getTarget } from '../renderers/registry.js';
import {
  parseCodexAgentFile,
  parseCodexConfigEntries,
} from './shared.js';
import type { ImportHandler, ImportResult, ImportWarning } from './types.js';

export function importFromCodexDir(cwd: string, projectName: string): ImportResult {
  const warnings: ImportWarning[] = [];
  const agents: Record<string, CoreAgent> = {};
  const targetContext = getTarget('codex');
  const configPath = join(cwd, '.codex', 'config.toml');

  if (!existsSync(configPath)) {
    warnings.push({ file: configPath, message: 'No .codex/config.toml file found' });
  } else {
    const entries = parseCodexConfigEntries(configPath);
    for (const entry of entries) {
      const agentPath = join(cwd, '.codex', entry.configPath);
      if (!existsSync(agentPath)) {
        warnings.push({ file: agentPath, message: `Missing config for agent "${entry.name}"` });
        continue;
      }

      const result = parseCodexAgentFile(cwd, entry, targetContext);
      agents[result.name] = result.agent;
      warnings.push(...result.warnings);
    }
  }

  if (Object.keys(agents).length === 0) {
    warnings.push({ file: join(cwd, '.codex', 'agents'), message: 'No agent .toml files found in .codex/agents/' });
  }

  return {
    team: createManifestForTarget({
      version: '2',
      project: { name: projectName },
      agents,
      settings: {
        generateDocs: true,
        generateLocalSettings: true,
      },
    }, 'codex'),
    warnings,
  };
}

export const codexImportHandler: ImportHandler = {
  targetName: 'codex',
  detect(cwd: string) {
    return existsSync(join(cwd, '.codex'));
  },
  importFromDir: importFromCodexDir,
};
