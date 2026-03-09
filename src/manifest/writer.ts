import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify } from 'yaml';
import type { CoreTeam } from '../core/types.js';
import { denormalizeManifest } from './normalize.js';

export function writeManifest(team: CoreTeam, cwd: string): void {
  const manifestPath = join(cwd, 'teamcast.yaml');
  const content = stringify(denormalizeManifest(team), { lineWidth: 0 });
  writeFileSync(manifestPath, content, 'utf-8');
}
