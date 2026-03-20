import type { TeamCastManifest } from '../types/manifest.js';
import { applyDefaults } from '../manifest/defaults.js';
import { getManifestTargetConfig, isManifestTargetName } from '../manifest/targets.js';
import { validateSchema } from '../manifest/schema-validator.js';
import { normalizeManifest } from '../manifest/normalize.js';
import { runValidation } from '../validator/index.js';
import {
  hasErrors,
  printManifestValidationSummary,
} from '../validator/reporter.js';
import type { ValidationResult } from '../validator/types.js';
import { getTarget, getRegisteredTargetNames } from '../renderers/registry.js';
import {
  applyEnvironmentInstructions,
  resolveEnvironmentIds,
  resolveEnvironmentPolicies,
} from '../core/environment-resolver.js';
import { checkManifestRegistry } from '../validator/checks/manifest-registry.js';
import { builtinResourceLoader } from '../registry/resource-loader.js';

export interface TeamValidationSummary {
  schemaErrors: Array<{ path: string; message: string }>;
  validationResults: ValidationResult[];
  policyAssertionCount?: number;
}

export function evaluateTeam(
  manifest: TeamCastManifest,
  options?: { cwd?: string },
): TeamValidationSummary {
  const schemaResult = validateSchema(manifest);

  if (!schemaResult.valid) {
    return {
      schemaErrors: schemaResult.errors,
      validationResults: [],
    };
  }

  if (options?.cwd) builtinResourceLoader.loadUserResources(options.cwd);
  const rawManifest = applyDefaults(schemaResult.data);
  const resolvedManifest = options?.cwd ? resolveEnvironmentPolicies(rawManifest, options.cwd) : rawManifest;

  const manifestRegistryResults = checkManifestRegistry(resolvedManifest);

  const envIds = options?.cwd ? resolveEnvironmentIds(resolvedManifest, options.cwd) : [];
  const activeTargets = getRegisteredTargetNames().filter(
    (targetName) =>
      isManifestTargetName(targetName) &&
      Boolean(getManifestTargetConfig(resolvedManifest, targetName)),
  );
  const validationResults: ValidationResult[] = [...manifestRegistryResults];
  let policyAssertionCount = 0;

  for (const targetName of activeTargets) {
    const targetContext = getTarget(targetName);
    const team = applyEnvironmentInstructions(
      normalizeManifest(resolvedManifest, targetContext),
      targetContext,
      envIds,
    );
    const targetResults = runValidation(team, targetContext);
    const prefix = activeTargets.length > 1 ? `[${targetName}] ` : '';
    policyAssertionCount += team.policies?.assertions?.length ?? 0;
    validationResults.push(
      ...targetResults.map((result) => ({
        ...result,
        message: prefix + result.message,
      })),
    );
  }

  return {
    schemaErrors: [],
    validationResults,
    policyAssertionCount,
  };
}

export function teamHasBlockingIssues(summary: TeamValidationSummary): boolean {
  return summary.schemaErrors.length > 0 || hasErrors(summary.validationResults);
}

export function printManifestValidation(summary: TeamValidationSummary): void {
  printManifestValidationSummary(summary);
}
