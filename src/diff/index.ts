import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { AgentForgeManifest } from '../types/manifest.js';
import { generate } from '../generator/index.js';
import { isUserEditableGeneratedFile } from '../generator/file-policies.js';

export type DiffStatus = 'new' | 'modified' | 'unchanged';

export interface DiffEntry {
  path: string;
  status: DiffStatus;
  /** Lines added (only for modified) */
  addedLines?: number;
  /** Lines removed (only for modified) */
  removedLines?: number;
}

// Compares what would be generated with what's on disk.
export function diffManifest(manifest: AgentForgeManifest, cwd: string): DiffEntry[] {
  const expected = generate(manifest, { cwd, dryRun: true });

  return expected.map((file): DiffEntry => {
    const absPath = join(cwd, file.path);

    if (!existsSync(absPath)) {
      return { path: file.path, status: 'new' };
    }

    const existing = readFileSync(absPath, 'utf-8');
    if (isUserEditableGeneratedFile(file.path)) {
      return { path: file.path, status: 'unchanged' };
    }

    if (existing === file.content) {
      return { path: file.path, status: 'unchanged' };
    }

    const existingLines = existing.split('\n');
    const expectedLines = file.content.split('\n');

    const added = expectedLines.filter((l) => !existingLines.includes(l)).length;
    const removed = existingLines.filter((l) => !expectedLines.includes(l)).length;

    return { path: file.path, status: 'modified', addedLines: added, removedLines: removed };
  });
}
