import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CoreTeam } from '../core/types.js';
import { generate } from '../generator/index.js';
import { isUserEditableGeneratedFile } from '../generator/file-policies.js';

export type DiffStatus = 'new' | 'modified' | 'unchanged';

export interface DiffEntry {
  path: string;
  status: DiffStatus;
  addedLines?: number;
  removedLines?: number;
}

export function diffManifest(team: CoreTeam, cwd: string): DiffEntry[] {
  const expected = generate(team, { cwd, dryRun: true });

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

    const added = expectedLines.filter((line) => !existingLines.includes(line)).length;
    const removed = existingLines.filter((line) => !expectedLines.includes(line)).length;

    return { path: file.path, status: 'modified', addedLines: added, removedLines: removed };
  });
}
