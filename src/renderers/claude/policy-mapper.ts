import type { TeamPolicies } from '../../core/types.js';

interface ClaudePermissionRules {
  allow: string[];
  ask: string[];
  deny: string[];
  defaultMode?: string;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function domainToPermissionRule(domain: string): string {
  return `WebFetch(${domain}:*)`;
}

export function mapPoliciesToClaudePermissions(policies: TeamPolicies | undefined): ClaudePermissionRules {
  const allow = [...(policies?.permissions?.rules?.allow ?? [])];
  const ask = [...(policies?.permissions?.rules?.ask ?? [])];
  const deny = [...(policies?.permissions?.rules?.deny ?? [])];

  if (policies?.network?.allowedDomains) {
    allow.push(...policies.network.allowedDomains.map(domainToPermissionRule));
  }

  return {
    allow: dedupe(allow),
    ask: dedupe(ask),
    deny: dedupe(deny),
    defaultMode: policies?.permissions?.defaultMode,
  };
}
