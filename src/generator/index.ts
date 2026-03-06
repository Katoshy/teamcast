import type { AgentForgeManifest } from '../types/manifest.js';
import type { GeneratedFile, GeneratorOptions } from './types.js';
import { renderAllAgentMd } from './renderers/agent-md.js';
import { renderSettingsJson, renderSettingsLocalJson } from './renderers/settings-json.js';
import { renderSkillMd } from './renderers/skill-md.js';
import { renderClaudeMd } from './renderers/claude-md.js';
import { renderAgentsMd } from './renderers/agents-md.js';
import { writeFiles } from './writer.js';

// Generates all Claude Code config files from the manifest.
// Returns the list of GeneratedFile objects.
// If options.dryRun is false (default), also writes them to disk.
export function generate(
  manifest: AgentForgeManifest,
  options: GeneratorOptions,
): GeneratedFile[] {
  const { cwd, dryRun = false } = options;

  const files: GeneratedFile[] = [
    ...renderAllAgentMd(manifest),
    renderSettingsJson(manifest),
    ...renderSkillMd(manifest),
  ];

  if (manifest.settings?.generate_local_settings !== false) {
    files.push(renderSettingsLocalJson());
  }

  if (manifest.settings?.generate_docs !== false) {
    files.push(renderClaudeMd(manifest));
    files.push(renderAgentsMd(manifest));
  }

  if (!dryRun) {
    writeFiles(files, cwd, { skipExisting: true });
  }

  return files;
}
