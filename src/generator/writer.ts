import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { GeneratedFile } from './types.js';

// Writes generated files to disk, creating directories as needed.
export function writeFiles(
  files: GeneratedFile[],
  cwd: string,
  options?: { skipExisting?: boolean },
): void {
  for (const file of files) {
    const absPath = join(cwd, file.path);
    if (options?.skipExisting && existsSync(absPath)) continue;
    const dir = dirname(absPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(absPath, file.content, 'utf-8');
  }
}
