import type { TeamPolicies } from '../core/types.js';
import type { PolicyFragmentName } from '../components/policy-fragments.js';
import { composePoliciesFromFragments } from '../components/policy-fragments.js';

export type PolicyBundleName =
  | 'custom-team'
  | 'single-agent'
  | 'feature-team'
  | 'solo-dev'
  | 'research-and-build'
  | 'secure-dev';

const POLICY_BUNDLES: Record<PolicyBundleName, PolicyFragmentName[]> = {
  'custom-team': [
    'allow-npm-run',
    'allow-git-read',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-env-files',
    'sandbox-default',
  ],
  'single-agent': [
    'allow-npm-run',
    'allow-git-read',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-env-files',
    'sandbox-default',
  ],
  'feature-team': [
    'allow-npm-run',
    'allow-npm-test',
    'allow-git-read',
    'allow-git-write',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-network-downloads',
    'deny-env-files',
    'sandbox-default',
  ],
  'solo-dev': [
    'allow-npm-run',
    'allow-npm-test',
    'allow-git-read',
    'allow-git-write',
    'allow-npx',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-env-files',
    'sandbox-default',
  ],
  'research-and-build': [
    'allow-npm-run',
    'allow-npm-test',
    'allow-git-read',
    'allow-git-write',
    'ask-git-push',
    'deny-destructive-shell',
    'deny-network-downloads',
    'deny-env-files',
    'sandbox-default',
  ],
  'secure-dev': [
    'allow-npm-run',
    'allow-npm-test',
    'allow-npm-audit',
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
