import type { TeamPolicies, HookEntry } from './types.js';
import type { PolicyAssertion } from './assertions.js';

export interface PolicyLayer {
  label?: string;
  policies: TeamPolicies;
}

function mergeUnique<T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined {
  const merged = [...(left ?? []), ...(right ?? [])];
  if (merged.length === 0) return undefined;
  // Deduplicate primitive values (strings); object values are kept as-is
  if (typeof merged[0] === 'string') {
    return [...new Set(merged as string[])] as T[];
  }
  return merged;
}

function concatArrays<T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined {
  const merged = [...(left ?? []), ...(right ?? [])];
  return merged.length > 0 ? merged : undefined;
}

function mergeTwoLayers(base: TeamPolicies, extra: TeamPolicies): TeamPolicies {
  const result: TeamPolicies = {};

  // --- permissions ---
  if (base.permissions || extra.permissions) {
    result.permissions = {
      defaultMode: extra.permissions?.defaultMode ?? base.permissions?.defaultMode,
      rules:
        base.permissions?.rules || extra.permissions?.rules
          ? {
              allow: mergeUnique(base.permissions?.rules?.allow, extra.permissions?.rules?.allow),
              ask: mergeUnique(base.permissions?.rules?.ask, extra.permissions?.rules?.ask),
              deny: mergeUnique(base.permissions?.rules?.deny, extra.permissions?.rules?.deny),
            }
          : undefined,
    };
  }

  // --- sandbox ---
  if (base.sandbox || extra.sandbox) {
    result.sandbox = {
      enabled: extra.sandbox?.enabled ?? base.sandbox?.enabled,
      autoAllowBash: extra.sandbox?.autoAllowBash ?? base.sandbox?.autoAllowBash,
      excludedCommands: mergeUnique(base.sandbox?.excludedCommands, extra.sandbox?.excludedCommands),
      network:
        base.sandbox?.network || extra.sandbox?.network
          ? {
              allowUnixSockets: mergeUnique(
                base.sandbox?.network?.allowUnixSockets,
                extra.sandbox?.network?.allowUnixSockets,
              ),
              allowLocalBinding:
                extra.sandbox?.network?.allowLocalBinding ?? base.sandbox?.network?.allowLocalBinding,
            }
          : undefined,
    };
  }

  // --- hooks ---
  if (base.hooks || extra.hooks) {
    result.hooks = {
      preToolUse: concatArrays<HookEntry>(base.hooks?.preToolUse, extra.hooks?.preToolUse),
      postToolUse: concatArrays<HookEntry>(base.hooks?.postToolUse, extra.hooks?.postToolUse),
      notification: concatArrays<HookEntry>(base.hooks?.notification, extra.hooks?.notification),
    };
  }

  // --- network ---
  if (base.network || extra.network) {
    result.network = {
      allowedDomains: mergeUnique(base.network?.allowedDomains, extra.network?.allowedDomains),
    };
  }

  // --- assertions ---
  if (base.assertions || extra.assertions) {
    result.assertions = concatArrays<PolicyAssertion>(base.assertions, extra.assertions);
  }

  return result;
}

/**
 * Applies deterministic priority: deny > ask > allow.
 * Patterns in deny are removed from ask and allow.
 * Patterns in ask are removed from allow.
 * Empty arrays are normalized to undefined.
 */
function applyPriority(policies: TeamPolicies): TeamPolicies {
  const rules = policies.permissions?.rules;
  if (!rules) return policies;

  const denySet = new Set(rules.deny ?? []);

  // deny > ask: remove denied patterns from ask
  const filteredAsk = (rules.ask ?? []).filter((p) => !denySet.has(p));
  // deny > allow and ask > allow: remove denied and asked patterns from allow
  const filteredAskSet = new Set(filteredAsk);
  const filteredAllow = (rules.allow ?? []).filter((p) => !denySet.has(p) && !filteredAskSet.has(p));

  return {
    ...policies,
    permissions: {
      ...policies.permissions,
      rules: {
        allow: filteredAllow.length > 0 ? filteredAllow : undefined,
        ask: filteredAsk.length > 0 ? filteredAsk : undefined,
        deny: rules.deny && rules.deny.length > 0 ? rules.deny : undefined,
      },
    },
  };
}

/**
 * Merges multiple policy layers with deterministic priority: deny > ask > allow.
 *
 * Layers are merged in order (later layers override scalars, arrays are concatenated).
 * After merging, permission rules are deduplicated with priority enforcement:
 * - If a pattern is in deny, it is removed from ask and allow.
 * - If a pattern is in ask, it is removed from allow.
 */
export function composePolicies(layers: PolicyLayer[]): TeamPolicies {
  if (layers.length === 0) return {};

  const merged = layers.reduce<TeamPolicies>(
    (acc, layer) => mergeTwoLayers(acc, layer.policies),
    {},
  );

  return applyPriority(merged);
}
