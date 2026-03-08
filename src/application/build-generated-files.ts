import type { CoreTeam } from '../core/types.js';
import { ClaudeRenderer } from '../renderers/claude/index.js';
import type { RenderedFile, TeamRenderSpec } from '../renderers/types.js';
import { isUserEditableGeneratedFile } from '../generator/file-policies.js';
import { writeFiles } from '../generator/writer.js';

export interface BuildGeneratedOutputsOptions {
  cwd: string;
  dryRun?: boolean;
}

export function buildGeneratedOutputs(team: CoreTeam, options: BuildGeneratedOutputsOptions): RenderedFile[] {
  const spec: TeamRenderSpec = { team };
  const renderer = new ClaudeRenderer();
  const files = renderer.render(spec);

  if (!options.dryRun) {
    const editable = files.filter((file) => isUserEditableGeneratedFile(file.path));
    const generated = files.filter((file) => !isUserEditableGeneratedFile(file.path));
    writeFiles(generated, options.cwd);
    writeFiles(editable, options.cwd, { skipExisting: true });
  }

  return files;
}
