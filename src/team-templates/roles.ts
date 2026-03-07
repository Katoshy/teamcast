import type { AgentConfig, ModelAlias, Tool } from '../types/manifest.js';

export type TeamRoleName =
  | 'orchestrator'
  | 'planner'
  | 'researcher'
  | 'developer'
  | 'tester'
  | 'reviewer'
  | 'security-auditor';

export interface RoleTemplate {
  name: TeamRoleName;
  label: string;
  description: string;
  model: Exclude<ModelAlias, 'inherit'>;
  allow: Tool[];
  deny: Tool[];
  behavior: string;
}

const ROLE_TEMPLATES: Record<TeamRoleName, RoleTemplate> = {
  orchestrator: {
    name: 'orchestrator',
    label: 'Orchestrator',
    description: 'Coordinates the team and delegates tasks',
    model: 'opus',
    allow: ['Read', 'Grep', 'Glob', 'Task'],
    deny: ['Edit', 'Write', 'Bash'],
    behavior: 'You are the coordinator. Analyze requests, break them into subtasks, and delegate to the appropriate team members.',
  },
  planner: {
    name: 'planner',
    label: 'Planner',
    description: 'Analyzes codebase and produces implementation plans',
    model: 'sonnet',
    allow: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
    deny: ['Edit', 'Write', 'Bash'],
    behavior: 'You are the planner. Read the codebase, identify patterns, and produce step-by-step implementation plans. Never modify files.',
  },
  researcher: {
    name: 'researcher',
    label: 'Researcher',
    description: 'Researches topics using web access',
    model: 'haiku',
    allow: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
    deny: ['Edit', 'Write', 'Bash'],
    behavior: 'You are the researcher. Search the web, read documentation, and provide structured research reports.',
  },
  developer: {
    name: 'developer',
    label: 'Developer',
    description: 'Implements features, writes code and tests',
    model: 'sonnet',
    allow: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob'],
    deny: ['WebFetch', 'WebSearch'],
    behavior: 'You are the developer. Implement features based on the plan, write tests, and verify the result.',
  },
  tester: {
    name: 'tester',
    label: 'Tester',
    description: 'Runs tests and verifies functionality',
    model: 'sonnet',
    allow: ['Read', 'Bash', 'Grep', 'Glob'],
    deny: ['Edit', 'Write'],
    behavior: 'You are the tester. Run tests, analyze failures, and report results. Do not modify source code.',
  },
  reviewer: {
    name: 'reviewer',
    label: 'Reviewer',
    description: 'Reviews code for quality and security issues',
    model: 'sonnet',
    allow: ['Read', 'Grep', 'Glob', 'Bash'],
    deny: ['Edit', 'Write', 'WebFetch', 'WebSearch'],
    behavior: 'You are the reviewer. Review code for correctness, style, security, and performance. Provide actionable feedback.',
  },
  'security-auditor': {
    name: 'security-auditor',
    label: 'Security Auditor',
    description: 'Audits code for security vulnerabilities',
    model: 'sonnet',
    allow: ['Read', 'Grep', 'Glob', 'Bash'],
    deny: ['Edit', 'Write', 'WebFetch', 'WebSearch'],
    behavior: 'You are the security auditor. Check for injection, auth flaws, data exposure, misconfigurations, and vulnerable dependencies.',
  },
};

const CUSTOM_TEAM_ROLE_ORDER: TeamRoleName[] = [
  'orchestrator',
  'planner',
  'researcher',
  'developer',
  'tester',
  'reviewer',
  'security-auditor',
];

function cloneTools(allow: Tool[], deny: Tool[]) {
  return {
    allow: [...allow],
    deny: deny.length > 0 ? [...deny] : undefined,
  };
}

function cloneArray<T>(value: T[] | undefined): T[] | undefined {
  return value ? [...value] : undefined;
}

export function listRoleTemplates(): RoleTemplate[] {
  return CUSTOM_TEAM_ROLE_ORDER.map((name) => ROLE_TEMPLATES[name]);
}

export function isTeamRoleName(value: string): value is TeamRoleName {
  return value in ROLE_TEMPLATES;
}

export function getRoleTemplate(name: TeamRoleName): RoleTemplate {
  return ROLE_TEMPLATES[name];
}

export function createRoleAgent(
  name: TeamRoleName,
  overrides: Partial<AgentConfig> = {},
): AgentConfig {
  const template = getRoleTemplate(name);
  const base: AgentConfig = {
    description: template.description,
    model: template.model,
    tools: cloneTools(template.allow, template.deny),
    behavior: template.behavior,
  };

  return {
    ...base,
    ...overrides,
    tools: overrides.tools ?? base.tools,
    skills: cloneArray(overrides.skills ?? base.skills),
    handoffs: cloneArray(overrides.handoffs ?? base.handoffs),
    mcp_servers: cloneArray(overrides.mcp_servers ?? base.mcp_servers),
  };
}
