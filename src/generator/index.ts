import type { TeamCastManifest } from '../manifest/types.js';
import { applyDefaults } from '../manifest/defaults.js';
import type { BuildGeneratedOutputsOptions } from '../application/build-generated-files.js';
import { buildGeneratedOutputs } from '../application/build-generated-files.js';

import { getRegisteredTargetNames, getTarget } from '../renderers/registry.js';
import { normalizeManifest } from '../manifest/normalize.js';
import {
  applyEnvironmentInstructions,
  resolveEnvironmentIds,
  resolveEnvironmentPolicies,
} from '../core/environment-resolver.js';

export function generate(
  manifest: TeamCastManifest,
  options: BuildGeneratedOutputsOptions,
) {
  const rawManifest = resolveEnvironmentPolicies(applyDefaults(manifest), options.cwd);
  const envIds = resolveEnvironmentIds(rawManifest, options.cwd);

  const rawManifestRecord = rawManifest as unknown as Record<string, unknown>;
  const registeredTargets = getRegisteredTargetNames();
  const allGeneratedFiles: ReturnType<typeof buildGeneratedOutputs> = [];

  for (const targetName of registeredTargets) {
    if (rawManifestRecord[targetName]) {
      const targetContext = getTarget(targetName);
      const coreTeam = applyEnvironmentInstructions(
        normalizeManifest(rawManifest, targetContext),
        targetContext,
        envIds,
      );
      const targetFiles = buildGeneratedOutputs(coreTeam, targetName, options);
      allGeneratedFiles.push(...targetFiles);
    }
  }

  return allGeneratedFiles;
}
