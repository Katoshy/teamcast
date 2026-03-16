import type { CoreTeam } from '../core/types.js';
import { getTarget } from '../renderers/registry.js';
import type { RenderedFile, TeamRenderSpec } from '../renderers/types.js';
import { isUserEditableGeneratedFile } from '../generator/file-policies.js';
import { writeFiles } from '../generator/writer.js';

export interface BuildGeneratedOutputsOptions {
  cwd: string;
  dryRun?: boolean;
}

export function buildGeneratedOutputs(team: CoreTeam, targetName: string, options: BuildGeneratedOutputsOptions): RenderedFile[] {
  const spec: TeamRenderSpec = { team };
  const target = getTarget(targetName);
  const renderer = target.renderer;
  const files = renderer.render(spec);

  if (!options.dryRun) {
    const editable: RenderedFile[] = [];
    const generated: RenderedFile[] = [];
    for (const file of files) {
      (isUserEditableGeneratedFile(file.path) ? editable : generated).push(file);
    }
    writeFiles(generated, options.cwd);
    writeFiles(editable, options.cwd, { skipExisting: true });
  }

  return files;
}
