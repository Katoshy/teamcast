// Policy fragments catalog — moved from src/components/policy-fragments.ts.

import type { TeamPolicies } from '../core/types.js';
import { composePolicies } from '../core/compose-policies.js';
import type { PolicyFragmentId } from './types.js';

const POLICY_FRAGMENTS: Record<PolicyFragmentId, TeamPolicies> = {
  'allow-git-read': {
    permissions: { rules: { allow: ['Bash(git status)', 'Bash(git diff *)'] } },
  },
  'allow-git-write': {
    permissions: { rules: { allow: ['Bash(git add *)', 'Bash(git commit *)'] } },
  },
  'ask-git-push': {
    permissions: { rules: { ask: ['Bash(git push *)'] } },
  },
  'deny-destructive-shell': {
    permissions: { rules: { deny: ['Bash(rm -rf *)', 'Bash(git push --force *)'] } },
  },
  'deny-network-downloads': {
    permissions: { rules: { deny: ['Bash(curl *)', 'Bash(wget *)'] } },
  },
  'deny-dynamic-exec': {
    permissions: { rules: { deny: ['Bash(eval *)', 'Bash(exec *)'] } },
  },
  'deny-env-files': {
    permissions: { rules: { deny: ['Write(.env*)', 'Edit(.env*)'] } },
  },
  'sandbox-default': {
    sandbox: {
      enabled: true,
      autoAllowBash: true,
    },
  },
};

export function listPolicyFragments(): PolicyFragmentId[] {
  return Object.keys(POLICY_FRAGMENTS) as PolicyFragmentId[];
}

export function isPolicyFragmentId(value: string): value is PolicyFragmentId {
  return Object.prototype.hasOwnProperty.call(POLICY_FRAGMENTS, value);
}

export function composePoliciesFromFragments(
  fragments: PolicyFragmentId[] | undefined,
  overrides: TeamPolicies = {},
): TeamPolicies {
  const layers = (fragments ?? []).map((fragmentId) => {
    const fragment = POLICY_FRAGMENTS[fragmentId];
    if (!fragment) {
      throw new Error(`Unknown policy fragment "${fragmentId}"`);
    }
    return { label: `fragment:${fragmentId}`, policies: fragment };
  });

  layers.push({ label: 'inline', policies: overrides });

  return composePolicies(layers);
}
