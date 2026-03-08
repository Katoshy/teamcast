import type { AbstractPermission } from './types.js';

export const ABSTRACT_PERMISSIONS: AbstractPermission[] = [
  'project.commands',
  'tests',
  'git.read',
  'git.write',
  'package.exec',
  'security.audit',
  'git.push',
  'destructive-shell',
  'downloads',
  'dynamic-exec',
  'env.write',
];

type PermissionBucket = 'allow' | 'ask' | 'deny';

const LEGACY_PERMISSION_RULE_MAP: Record<PermissionBucket, Record<string, AbstractPermission>> = {
  allow: {
    'Bash(npm run *)': 'project.commands',
    'Bash(npm run)': 'project.commands',
    'Bash(npm test *)': 'tests',
    'Bash(npm test)': 'tests',
    'Bash(git status)': 'git.read',
    'Bash(git diff *)': 'git.read',
    'Bash(git add *)': 'git.write',
    'Bash(git commit *)': 'git.write',
    'Bash(npx *)': 'package.exec',
    'Bash(npm audit)': 'security.audit',
  },
  ask: {
    'Bash(git push *)': 'git.push',
  },
  deny: {
    'Bash(rm -rf *)': 'destructive-shell',
    'Bash(git push --force *)': 'destructive-shell',
    'Bash(curl *)': 'downloads',
    'Bash(wget *)': 'downloads',
    'Bash(eval *)': 'dynamic-exec',
    'Bash(exec *)': 'dynamic-exec',
    'Write(.env*)': 'env.write',
    'Edit(.env*)': 'env.write',
  },
};

export function isAbstractPermission(value: string): value is AbstractPermission {
  return ABSTRACT_PERMISSIONS.includes(value as AbstractPermission);
}

export function normalizePermissionTokens(
  tokens: string[] | undefined,
  bucket: PermissionBucket,
): { abstract: AbstractPermission[] | undefined; raw: string[] | undefined } {
  if (!tokens?.length) {
    return { abstract: undefined, raw: undefined };
  }

  const abstract = new Set<AbstractPermission>();
  const raw = new Set<string>();

  for (const token of tokens) {
    if (isAbstractPermission(token)) {
      abstract.add(token);
      continue;
    }

    const mapped = LEGACY_PERMISSION_RULE_MAP[bucket][token];
    if (mapped) {
      abstract.add(mapped);
      continue;
    }

    raw.add(token);
  }

  return {
    abstract: abstract.size > 0 ? [...abstract] : undefined,
    raw: raw.size > 0 ? [...raw] : undefined,
  };
}
