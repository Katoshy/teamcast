import type { AgentForgeManifest } from '../types/manifest.js';
import { normalizeManifest } from '../types/manifest.js';
import type { GeneratedFile, GeneratorOptions } from './types.js';
import { isUserEditableGeneratedFile } from './file-policies.js';
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
  const normalized = normalizeManifest(manifest);

  const files: GeneratedFile[] = [
    ...renderAllAgentMd(normalized),
    renderSettingsJson(normalized),
    ...renderSkillMd(normalized),
  ];

  if (normalized.settings?.generate_local_settings !== false) {
    files.push(renderSettingsLocalJson());
  }

  if (normalized.settings?.generate_docs !== false) {
    files.push(renderClaudeMd(normalized));
    files.push(renderAgentsMd(normalized));
  }

  if (!dryRun) {
    // Skill stubs should not be overwritten (users edit them manually).
    // Everything else should always be overwritten to stay in sync.
    const skillFiles = files.filter((f) => isUserEditableGeneratedFile(f.path));
    const otherFiles = files.filter((f) => !isUserEditableGeneratedFile(f.path));
    writeFiles(otherFiles, cwd);
    writeFiles(skillFiles, cwd, { skipExisting: true });
  }

  return files;
}
