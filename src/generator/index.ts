import type { CoreTeam } from '../core/types.js';
import type { TeamCastManifest } from '../manifest/types.js';
import { isCoreTeam } from '../core/guards.js';
import { applyDefaults } from '../manifest/defaults.js';
import type { BuildGeneratedOutputsOptions } from '../application/build-generated-files.js';
import { buildGeneratedOutputs } from '../application/build-generated-files.js';

export function generate(
  manifest: TeamCastManifest | CoreTeam,
  options: BuildGeneratedOutputsOptions,
) {
  const team = isCoreTeam(manifest)
    ? manifest
    : applyDefaults(manifest);

  return buildGeneratedOutputs(team, options);
}
