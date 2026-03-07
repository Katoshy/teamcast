import type { PermissionsConfig, PoliciesConfig, SandboxConfig } from '../types/manifest.js';

export type PolicyBundleName =
  | 'custom-team'
  | 'single-agent'
  | 'feature-team'
  | 'solo-dev'
  | 'research-and-build'
  | 'secure-dev';

const DEFAULT_SANDBOX: SandboxConfig = {
  enabled: true,
  auto_allow_bash: true,
};

const POLICY_BUNDLES: Record<PolicyBundleName, PoliciesConfig> = {
  'custom-team': {
    permissions: {
      allow: ['Bash(npm run *)', 'Bash(npm test)', 'Bash(git status)', 'Bash(git diff *)'],
      ask: ['Bash(git push *)'],
      deny: ['Bash(rm -rf *)', 'Bash(git push --force *)', 'Write(.env*)', 'Edit(.env*)'],
    },
    sandbox: DEFAULT_SANDBOX,
  },
  'single-agent': {
    permissions: {
      allow: ['Bash(npm run *)', 'Bash(git status)', 'Bash(git diff *)'],
      ask: ['Bash(git push *)'],
      deny: ['Bash(rm -rf *)', 'Bash(git push --force *)', 'Write(.env*)', 'Edit(.env*)'],
    },
    sandbox: DEFAULT_SANDBOX,
  },
  'feature-team': {
    permissions: {
      allow: [
        'Bash(npm run *)',
        'Bash(npm test *)',
        'Bash(git status)',
        'Bash(git diff *)',
        'Bash(git add *)',
        'Bash(git commit *)',
      ],
      ask: ['Bash(git push *)'],
      deny: [
        'Bash(rm -rf *)',
        'Bash(git push --force *)',
        'Bash(curl *)',
        'Bash(wget *)',
        'Write(.env*)',
        'Edit(.env*)',
      ],
    },
    sandbox: DEFAULT_SANDBOX,
  },
  'solo-dev': {
    permissions: {
      allow: [
        'Bash(npm run *)',
        'Bash(npm test *)',
        'Bash(git status)',
        'Bash(git diff *)',
        'Bash(git add *)',
        'Bash(git commit *)',
        'Bash(npx *)',
      ],
      ask: ['Bash(git push *)'],
      deny: ['Bash(rm -rf *)', 'Bash(git push --force *)', 'Write(.env*)', 'Edit(.env*)'],
    },
    sandbox: DEFAULT_SANDBOX,
  },
  'research-and-build': {
    permissions: {
      allow: [
        'Bash(npm run *)',
        'Bash(npm test *)',
        'Bash(git status)',
        'Bash(git diff *)',
        'Bash(git add *)',
        'Bash(git commit *)',
      ],
      ask: ['Bash(git push *)'],
      deny: [
        'Bash(rm -rf *)',
        'Bash(git push --force *)',
        'Bash(curl *)',
        'Bash(wget *)',
        'Write(.env*)',
        'Edit(.env*)',
      ],
    },
    sandbox: DEFAULT_SANDBOX,
  },
  'secure-dev': {
    permissions: {
      allow: [
        'Bash(npm run *)',
        'Bash(npm test *)',
        'Bash(npm audit)',
        'Bash(git status)',
        'Bash(git diff *)',
        'Bash(git add *)',
        'Bash(git commit *)',
      ],
      ask: ['Bash(git push *)'],
      deny: [
        'Bash(rm -rf *)',
        'Bash(git push --force *)',
        'Bash(curl *)',
        'Bash(wget *)',
        'Bash(eval *)',
        'Bash(exec *)',
        'Write(.env*)',
        'Edit(.env*)',
      ],
    },
    sandbox: DEFAULT_SANDBOX,
  },
};

function clonePermissions(permissions: PermissionsConfig | undefined): PermissionsConfig | undefined {
  if (!permissions) return undefined;

  return {
    allow: permissions.allow ? [...permissions.allow] : undefined,
    ask: permissions.ask ? [...permissions.ask] : undefined,
    deny: permissions.deny ? [...permissions.deny] : undefined,
    default_mode: permissions.default_mode,
  };
}

export function createPolicies(bundle: PolicyBundleName): PoliciesConfig {
  const source = POLICY_BUNDLES[bundle];

  return {
    permissions: clonePermissions(source.permissions),
    sandbox: source.sandbox ? { ...source.sandbox } : undefined,
    hooks: source.hooks ? { ...source.hooks } : undefined,
    network: source.network ? { ...source.network } : undefined,
  };
}
