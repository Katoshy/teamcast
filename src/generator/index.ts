import type { TeamCastManifest } from '../manifest/types.js';
import { applyDefaults } from '../manifest/defaults.js';
import type { BuildGeneratedOutputsOptions } from '../application/build-generated-files.js';
import { buildGeneratedOutputs } from '../application/build-generated-files.js';

import { getRegisteredTargetNames, getTarget } from '../renderers/registry.js';
import { normalizeManifest } from '../manifest/normalize.js';
import { injectEnvironmentPolicies } from '../plugins/inject.js';

export function generate(
  manifest: TeamCastManifest,
  options: BuildGeneratedOutputsOptions,
) {
  const rawManifest = applyDefaults(manifest);
  injectEnvironmentPolicies(rawManifest, options.cwd);
  
  const rawManifestRecord = rawManifest as unknown as Record<string, unknown>;
  const registeredTargets = getRegisteredTargetNames();
  const allGeneratedFiles: ReturnType<typeof buildGeneratedOutputs> = [];

  for (const targetName of registeredTargets) {
    if (rawManifestRecord[targetName]) {
      const targetContext = getTarget(targetName);
      const coreTeam = normalizeManifest(rawManifest, targetContext);
      const targetFiles = buildGeneratedOutputs(coreTeam, targetName, options);
      allGeneratedFiles.push(...targetFiles);
    }
  }

  return allGeneratedFiles;
}
