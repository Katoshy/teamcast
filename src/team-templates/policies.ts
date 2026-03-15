import type { TeamPolicies } from '../core/types.js';
import type { PolicyFragmentId } from '../registry/types.js';
import { composePoliciesFromFragments } from '../registry/policy-fragments.js';

export type PolicyBundleName =
  | 'custom-team'
  | 'single-agent'
  | 'feature-team'
  | 'solo-dev'
  | 'research-and-build'
  | 'secure-dev';

const POLICY_BUNDLES: Record<PolicyBundleName, PolicyFragmentId[]> = {
  'custom-team': [
    'allow-git-read',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-env-files',
    'sandbox-default',
  ],
  'single-agent': [
    'allow-git-read',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-env-files',
    'sandbox-default',
  ],
  'feature-team': [
    'allow-git-read',
    'allow-git-write',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-network-downloads',
    'deny-env-files',
    'sandbox-default',
  ],
  'solo-dev': [
    'allow-git-read',
    'allow-git-write',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-env-files',
    'sandbox-default',
  ],
  'research-and-build': [
    'allow-git-read',
    'allow-git-write',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-network-downloads',
    'deny-env-files',
    'sandbox-default',
  ],
  'secure-dev': [
    'allow-git-read',
    'allow-git-write',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-network-downloads',
    'deny-dynamic-exec',
    'deny-env-files',
    'sandbox-default',
  ],
};

export function createPolicies(bundle: PolicyBundleName): TeamPolicies {
  return composePoliciesFromFragments(POLICY_BUNDLES[bundle]);
}
