import type { InstructionBlock } from './instructions.js';
import type { CoreTeam } from './types.js';
import type { PoliciesConfig, TeamCastManifest, TargetConfig } from '../manifest/types.js';
import { TARGET_NAMES, getManifestTargetConfig, setManifestTargetConfig } from '../manifest/targets.js';
import { getEnvironment, detectEnvironments } from '../registry/environments.js';
import { isEnvironmentId } from '../registry/types.js';
import type { EnvironmentId } from '../registry/types.js';
import { agentHasCapability } from './capability-resolver.js';
import type { TargetContext } from '../renderers/target-context.js';

/**
 * Resolves environment IDs from the manifest, combining:
 * 1. Explicit `project.environments`
 * 2. Auto-detected environments from cwd
 */
export function resolveEnvironmentIds(manifest: TeamCastManifest, cwd: string): EnvironmentId[] {
  const ids = new Set<EnvironmentId>();

  for (const env of manifest.project.environments ?? []) {
    if (isEnvironmentId(env)) {
      ids.add(env);
    }
  }

  for (const envId of detectEnvironments(cwd)) {
    ids.add(envId);
  }

  return [...ids];
}

/**
 * Builds a PoliciesConfig from the active environments.
 * Used pre-normalization to merge environment policies into the raw manifest.
 */
function buildEnvironmentPolicies(envIds: EnvironmentId[]): PoliciesConfig {
  if (envIds.length === 0) return {};

  const allAllow: string[] = [];
  let sandboxEnabled: boolean | undefined;

  for (const envId of envIds) {
    const env = getEnvironment(envId);
    if (env.policyRules.sandbox?.enabled !== undefined) {
      sandboxEnabled = env.policyRules.sandbox.enabled;
    }
    if (env.policyRules.allow) {
      allAllow.push(...env.policyRules.allow);
    }
  }

  return {
    sandbox: sandboxEnabled !== undefined ? { enabled: sandboxEnabled } : undefined,
    permissions: allAllow.length > 0 ? { rules: { allow: [...new Set(allAllow)] } } : undefined,
  };
}

function mergePoliciesSimple(base: PoliciesConfig, extra: PoliciesConfig): PoliciesConfig {
  const mergedAllow = [...new Set([
    ...(base.permissions?.rules?.allow ?? []),
    ...(extra.permissions?.rules?.allow ?? []),
  ])];
  const mergedAsk = [...new Set([
    ...(base.permissions?.rules?.ask ?? []),
    ...(extra.permissions?.rules?.ask ?? []),
  ])];
  const mergedDeny = [...new Set([
    ...(base.permissions?.rules?.deny ?? []),
    ...(extra.permissions?.rules?.deny ?? []),
  ])];

  const mergedFragments = [...new Set([
    ...(base.fragments ?? []),
    ...(extra.fragments ?? []),
  ])];

  return {
    fragments: mergedFragments.length > 0 ? mergedFragments : undefined,
    permissions:
      mergedAllow.length || mergedAsk.length || mergedDeny.length || base.permissions?.default_mode || extra.permissions?.default_mode
        ? {
            rules:
              mergedAllow.length || mergedAsk.length || mergedDeny.length
                ? {
                    allow: mergedAllow.length > 0 ? mergedAllow : undefined,
                    ask: mergedAsk.length > 0 ? mergedAsk : undefined,
                    deny: mergedDeny.length > 0 ? mergedDeny : undefined,
                  }
                : undefined,
            default_mode: extra.permissions?.default_mode ?? base.permissions?.default_mode,
          }
        : undefined,
    sandbox:
      base.sandbox || extra.sandbox
        ? {
            enabled: extra.sandbox?.enabled ?? base.sandbox?.enabled,
            auto_allow_bash: extra.sandbox?.auto_allow_bash ?? base.sandbox?.auto_allow_bash,
          }
        : undefined,
    hooks: base.hooks || extra.hooks
      ? {
          pre_tool_use: [...(base.hooks?.pre_tool_use ?? []), ...(extra.hooks?.pre_tool_use ?? [])].length > 0
            ? [...(base.hooks?.pre_tool_use ?? []), ...(extra.hooks?.pre_tool_use ?? [])]
            : undefined,
          post_tool_use: [...(base.hooks?.post_tool_use ?? []), ...(extra.hooks?.post_tool_use ?? [])].length > 0
            ? [...(base.hooks?.post_tool_use ?? []), ...(extra.hooks?.post_tool_use ?? [])]
            : undefined,
          notification: [...(base.hooks?.notification ?? []), ...(extra.hooks?.notification ?? [])].length > 0
            ? [...(base.hooks?.notification ?? []), ...(extra.hooks?.notification ?? [])]
            : undefined,
        }
      : undefined,
    network: base.network || extra.network
      ? {
          allowed_domains: [...new Set([
            ...(base.network?.allowed_domains ?? []),
            ...(extra.network?.allowed_domains ?? []),
          ])].length > 0
            ? [...new Set([...(base.network?.allowed_domains ?? []), ...(extra.network?.allowed_domains ?? [])])]
            : undefined,
        }
      : undefined,
    assertions: [...(base.assertions ?? []), ...(extra.assertions ?? [])].length > 0
      ? [...(base.assertions ?? []), ...(extra.assertions ?? [])]
      : undefined,
  };
}

function resolveTargetPolicies(
  envPolicies: PoliciesConfig,
  targetConfig: TargetConfig | undefined,
): PoliciesConfig | undefined {
  if (!targetConfig) return undefined;

  const hasEnvPolicies = Object.keys(envPolicies).length > 0;
  if (!targetConfig.policies && !hasEnvPolicies) return undefined;

  return mergePoliciesSimple(envPolicies, targetConfig.policies ?? {});
}

/**
 * Injects environment policies into all targets of the manifest.
 */
export function resolveEnvironmentPolicies(manifest: TeamCastManifest, cwd: string): TeamCastManifest {
  const envIds = resolveEnvironmentIds(manifest, cwd);
  const envPolicies = buildEnvironmentPolicies(envIds);

  let result = { ...manifest };
  for (const targetName of TARGET_NAMES) {
    const targetConfig = getManifestTargetConfig(manifest, targetName);
    if (!targetConfig) continue;

    const mergedPolicies = resolveTargetPolicies(envPolicies, targetConfig);
    result = setManifestTargetConfig(result, targetName, {
      ...targetConfig,
      policies: mergedPolicies,
    });
  }

  return result;
}

/**
 * Collects instruction fragment contents from active environments.
 */
function collectEnvironmentInstructions(envIds: EnvironmentId[]): string[] {
  return [...new Set(
    envIds
      .flatMap((envId) => Object.values(getEnvironment(envId).instructionFragments))
      .map((content) => content.trim())
      .filter((content) => content.length > 0),
  )];
}

function appendWorkflowInstructions(blocks: InstructionBlock[], fragmentContents: string[]): InstructionBlock[] {
  const normalizedContents = fragmentContents
    .map((content) => content.trim())
    .filter((content) => content.length > 0);
  if (normalizedContents.length === 0) return blocks;

  const nextBlocks = blocks.map((block) => ({ ...block }));
  const workflowIndex = nextBlocks.findIndex((block) => block.kind === 'workflow');

  if (workflowIndex >= 0) {
    const existing = nextBlocks[workflowIndex];
    const missingContents = normalizedContents.filter((content) => !existing.content.includes(content));
    if (missingContents.length === 0) return blocks;

    nextBlocks[workflowIndex] = {
      ...existing,
      content: `${existing.content.trim()}\n\n${missingContents.join('\n\n')}`.trim(),
    };
    return nextBlocks;
  }

  nextBlocks.push({
    kind: 'workflow',
    content: normalizedContents.join('\n\n'),
  });
  return nextBlocks;
}

/**
 * Appends environment instruction fragments to agents with execute capability.
 */
export function applyEnvironmentInstructions(
  team: CoreTeam,
  targetContext: TargetContext,
  envIds: EnvironmentId[],
): CoreTeam {
  const fragmentContents = collectEnvironmentInstructions(envIds);
  if (fragmentContents.length === 0) return team;

  let changed = false;
  const agents = Object.fromEntries(
    Object.entries(team.agents).map(([agentId, agent]) => {
      if (!agentHasCapability(agent.runtime.tools ?? [], 'execute', targetContext.skillMap)) {
        return [agentId, agent];
      }

      const nextInstructions = appendWorkflowInstructions(agent.instructions, fragmentContents);
      if (nextInstructions === agent.instructions) return [agentId, agent];

      changed = true;
      return [agentId, { ...agent, instructions: nextInstructions }];
    }),
  );

  return changed ? { ...team, agents } : team;
}
