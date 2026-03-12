import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse } from 'yaml';
import { readManifest } from '../../../src/manifest/reader.js';
import { writeManifest } from '../../../src/manifest/writer.js';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

describe('manifest io', () => {
  it('round-trips a multi-target manifest without dropping target blocks', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-manifest-io-'));
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'multi-target-app' },
      claude: {
        settings: {
          generate_docs: true,
          generate_local_settings: false,
        },
        agents: {
          developer: {
            description: 'Claude developer',
            tools: ['Read', 'Write'],
          },
        },
      },
      codex: {
        settings: {
          generate_docs: true,
          generate_local_settings: false,
        },
        agents: {
          developer: {
            description: 'Codex developer',
            model: 'gpt-5.2-codex',
            reasoning_effort: 'medium',
            tools: ['read_files', 'execute'],
          },
        },
      },
    };

    writeManifest(manifest, cwd);

    expect(existsSync(join(cwd, 'teamcast.yaml'))).toBe(true);
    expect(readManifest(cwd)).toEqual(manifest);
    expect(parse(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8'))).toEqual(manifest);

    rmSync(cwd, { recursive: true, force: true });
  });
});
