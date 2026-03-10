import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify } from 'yaml';
import type { TeamCastManifest } from './types.js';

export function writeManifest(manifest: TeamCastManifest, cwd: string): void {
  const manifestPath = join(cwd, 'teamcast.yaml');
  const content = stringify(manifest, { lineWidth: 0 });
  writeFileSync(manifestPath, content, 'utf-8');
}
