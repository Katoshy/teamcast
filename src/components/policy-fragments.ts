import type { TeamPolicies } from '../core/types.js';

export type PolicyFragmentName =
  | 'allow-git-read'
  | 'allow-git-write'
  | 'ask-git-push'
  | 'deny-destructive-shell'
  | 'deny-network-downloads'
  | 'deny-dynamic-exec'
  | 'deny-env-files'
  | 'sandbox-default';

const POLICY_FRAGMENTS: Record<PolicyFragmentName, TeamPolicies> = {
  'allow-git-read': {
    permissions: { rules: { allow: ['Bash(git status)', 'Bash(git diff *)'] } }
  },
  'allow-git-write': {
    permissions: { rules: { allow: ['Bash(git add *)', 'Bash(git commit *)'] } }
  },
  'ask-git-push': {
    permissions: { rules: { ask: ['Bash(git push *)'] } }
  },
  'deny-destructive-shell': {
    permissions: { rules: { deny: ['Bash(rm -rf *)', 'Bash(git push --force *)'] } }
  },
  'deny-network-downloads': {
    permissions: { rules: { deny: ['Bash(curl *)', 'Bash(wget *)'] } }
  },
  'deny-dynamic-exec': {
    permissions: { rules: { deny: ['Bash(eval *)', 'Bash(exec *)'] } }
  },
  'deny-env-files': {
    permissions: { rules: { deny: ['Write(.env*)', 'Edit(.env*)'] } }
  },
  'sandbox-default': {
    sandbox: {
      enabled: true,
      autoAllowBash: true,
    },
  },
};

function mergeUnique<T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined {
  const merged = [...(left ?? []), ...(right ?? [])];
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

function mergePolicies(base: TeamPolicies, extra: TeamPolicies): TeamPolicies {
  return {
    permissions: base.permissions || extra.permissions
      ? {
          rules: base.permissions?.rules || extra.permissions?.rules
            ? {
                allow: mergeUnique(base.permissions?.rules?.allow, extra.permissions?.rules?.allow),
                ask: mergeUnique(base.permissions?.rules?.ask, extra.permissions?.rules?.ask),
                deny: mergeUnique(base.permissions?.rules?.deny, extra.permissions?.rules?.deny),
              }
            : undefined,
          defaultMode: extra.permissions?.defaultMode ?? base.permissions?.defaultMode,
        }
      : undefined,
    sandbox: base.sandbox || extra.sandbox
      ? {
          enabled: extra.sandbox?.enabled ?? base.sandbox?.enabled,
          autoAllowBash: extra.sandbox?.autoAllowBash ?? base.sandbox?.autoAllowBash,
          excludedCommands: mergeUnique(base.sandbox?.excludedCommands, extra.sandbox?.excludedCommands),
          network: base.sandbox?.network || extra.sandbox?.network
            ? {
                allowUnixSockets: mergeUnique(
                  base.sandbox?.network?.allowUnixSockets,
                  extra.sandbox?.network?.allowUnixSockets,
                ),
                allowLocalBinding:
                  extra.sandbox?.network?.allowLocalBinding ?? base.sandbox?.network?.allowLocalBinding,
              }
            : undefined,
        }
      : undefined,
    hooks: base.hooks || extra.hooks
      ? {
          preToolUse: [...(base.hooks?.preToolUse ?? []), ...(extra.hooks?.preToolUse ?? [])],
          postToolUse: [...(base.hooks?.postToolUse ?? []), ...(extra.hooks?.postToolUse ?? [])],
          notification: [...(base.hooks?.notification ?? []), ...(extra.hooks?.notification ?? [])],
        }
      : undefined,
    network: base.network || extra.network
      ? {
          allowedDomains: mergeUnique(base.network?.allowedDomains, extra.network?.allowedDomains),
        }
      : undefined,
  };
}

export function listPolicyFragments(): PolicyFragmentName[] {
  return Object.keys(POLICY_FRAGMENTS) as PolicyFragmentName[];
}

export function composePoliciesFromFragments(
  fragments: PolicyFragmentName[] | undefined,
  overrides: TeamPolicies = {},
): TeamPolicies {
  const composed = (fragments ?? []).reduce<TeamPolicies>((acc, fragmentName) => {
    const fragment = POLICY_FRAGMENTS[fragmentName];
    if (!fragment) {
      throw new Error(`Unknown policy fragment "${fragmentName}"`);
    }

    return mergePolicies(acc, fragment);
  }, {});

  return mergePolicies(composed, overrides);
}
