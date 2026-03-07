import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify } from 'yaml';
import type { AgentForgeManifest } from '../types/manifest.js';
import { normalizeManifest } from '../types/manifest.js';

export function writeManifest(manifest: AgentForgeManifest, cwd: string): void {
  const manifestPath = join(cwd, 'agentforge.yaml');
  const content = stringify(normalizeManifest(manifest), { lineWidth: 0 });
  writeFileSync(manifestPath, content, 'utf-8');
}
