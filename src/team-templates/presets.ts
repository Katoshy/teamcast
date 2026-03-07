import type { AgentForgeManifest } from '../types/manifest.js';
import type { PresetMeta } from '../presets/types.js';
import { createPolicies } from './policies.js';
import { createRoleAgent } from './roles.js';

export type PresetName = 'feature-team' | 'solo-dev' | 'research-and-build' | 'secure-dev';

const PRESET_REGISTRY: Record<PresetName, PresetMeta> = {
  'feature-team': {
    name: 'feature-team',
    description: 'Classic feature development team: orchestrator -> planner -> developer -> reviewer',
    agentsCount: 4,
    tags: ['team', 'feature', 'orchestration'],
  },
  'solo-dev': {
    name: 'solo-dev',
    description: 'Single enhanced developer agent with safe defaults for individual developers',
    agentsCount: 1,
    tags: ['solo', 'simple'],
  },
  'research-and-build': {
    name: 'research-and-build',
    description: 'Research-first team: orchestrator -> researcher -> planner -> developer',
    agentsCount: 4,
    tags: ['research', 'team'],
  },
  'secure-dev': {
    name: 'secure-dev',
    description: 'High-security team with security auditor: orchestrator -> planner -> developer -> security-auditor -> reviewer',
    agentsCount: 5,
    tags: ['security', 'team', 'audit'],
  },
};

export function listPresetMetas(): PresetMeta[] {
  return Object.values(PRESET_REGISTRY);
}

export function isPresetName(value: string): value is PresetName {
  return value in PRESET_REGISTRY;
}

export function getPresetMeta(name: string): PresetMeta | undefined {
  return PRESET_REGISTRY[name as PresetName];
}

export function buildPresetManifest(name: PresetName, projectName = 'placeholder'): AgentForgeManifest {
  switch (name) {
    case 'feature-team':
      return {
        version: '1',
        project: {
          name: projectName,
          preset: 'feature-team',
          description: 'Classic feature development team with orchestration, planning, coding, and review.',
        },
        agents: {
          orchestrator: createRoleAgent('orchestrator', {
            claude: {
              description: 'Coordinates the team. Analyzes tasks, decomposes them into subtasks, and delegates to the right specialist. Never writes code directly.',
              tools: ['Read', 'Grep', 'Glob', 'Agent'],
              disallowed_tools: ['Edit', 'Write', 'Bash', 'WebFetch', 'WebSearch'],
              skills: ['triage', 'routing'],
              max_turns: 30,
              instructions: [
                'You are the team coordinator. Your job is to analyze the user\'s request, break it down into subtasks, and delegate each subtask to the appropriate specialist.',
                '',
                'Always start by reading the task carefully. Then decide:',
                '- Does this need research or planning first? -> delegate to planner',
                '- Is the plan ready and implementation needed? -> delegate to developer',
                '- Is the implementation done and needs review? -> delegate to reviewer',
                '',
                'Never write code or modify files yourself. Your output is always a delegation or a final summary.',
              ].join('\n'),
            },
            forge: {
              handoffs: ['planner', 'developer', 'reviewer'],
            },
          }),
          planner: createRoleAgent('planner', {
            claude: {
              description: 'Reads the codebase and produces an implementation plan. Does not write code.',
              skills: ['architecture-analysis', 'planning'],
              instructions: [
                'You are the planner. Your job is to deeply understand the codebase and produce a clear, step-by-step implementation plan.',
                '',
                'Always read the relevant files before making conclusions. Search for existing patterns and utilities that can be reused.',
                '',
                'Your output is always a plan - never code changes.',
              ].join('\n'),
            },
          }),
          developer: createRoleAgent('developer', {
            claude: {
              description: 'Implements code according to the plan. Writes tests. Does not access the internet.',
              skills: ['test-first', 'clean-code'],
              instructions: [
                'You are the developer. Your job is to implement the plan precisely.',
                '',
                'Always start with tests. Follow the existing code style. Do not access the internet.',
                '',
                'When done, summarize what you changed and why.',
              ].join('\n'),
            },
          }),
          reviewer: createRoleAgent('reviewer', {
            claude: {
              description: 'Reviews code quality, security, and style. Does not modify files - only provides recommendations.',
              skills: ['code-review', 'security-check'],
              instructions: [
                'You are the reviewer. Your job is to review the implementation for quality, correctness, and security.',
                '',
                'Read the changed files carefully. Check for:',
                '- Correctness and edge cases',
                '- Security vulnerabilities',
                '- Code style and readability',
                '- Test coverage',
                '',
                'Provide clear, actionable recommendations. Do not modify files yourself.',
              ].join('\n'),
            },
          }),
        },
        policies: createPolicies('feature-team'),
      };
    case 'solo-dev':
      return {
        version: '1',
        project: {
          name: projectName,
          preset: 'solo-dev',
          description: 'Single enhanced developer agent with safe defaults for individual developers.',
        },
        agents: {
          developer: createRoleAgent('developer', {
            claude: {
              description: 'Full-stack developer agent. Reads, writes, edits files and runs commands. Use for any development task.',
              tools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Agent'],
              disallowed_tools: undefined,
              skills: ['test-first', 'clean-code', 'planning'],
              instructions: [
                'You are a capable full-stack developer. Handle the task end-to-end:',
                '1. Understand the request',
                '2. Read relevant code',
                '3. Make a plan',
                '4. Implement with tests',
                '5. Verify the result',
                '',
                'Follow existing code style. Keep changes minimal and focused.',
              ].join('\n'),
            },
          }),
        },
        policies: createPolicies('solo-dev'),
      };
    case 'research-and-build':
      return {
        version: '1',
        project: {
          name: projectName,
          preset: 'research-and-build',
          description: 'Research-first team. Researcher has full internet access; developer does not.',
        },
        agents: {
          orchestrator: createRoleAgent('orchestrator', {
            claude: {
              description: 'Coordinates research and implementation. Delegates research tasks to the researcher and coding tasks to the developer.',
              tools: ['Read', 'Grep', 'Glob', 'Agent'],
              disallowed_tools: ['Edit', 'Write', 'Bash', 'WebFetch', 'WebSearch'],
              max_turns: 30,
              instructions: [
                'You are the coordinator. For tasks requiring external research, delegate to the researcher first.',
                'Once research is done and a plan is ready, delegate implementation to the developer.',
                'Never write code yourself.',
              ].join('\n'),
            },
            forge: {
              handoffs: ['researcher', 'planner', 'developer'],
            },
          }),
          researcher: createRoleAgent('researcher', {
            claude: {
              description: 'Finds information in documentation and on the web. Produces research reports and source summaries.',
              skills: ['research-report', 'source-validation'],
              instructions: [
                'You are the researcher. Your job is to find accurate information from documentation and trusted sources.',
                '',
                'Always cite your sources. Summarize findings clearly.',
                'Do not modify any files.',
              ].join('\n'),
            },
          }),
          planner: createRoleAgent('planner', {
            claude: {
              description: 'Analyzes the codebase and research findings to produce an implementation plan.',
              tools: ['Read', 'Grep', 'Glob'],
              disallowed_tools: ['Edit', 'Write', 'Bash', 'WebFetch', 'WebSearch'],
              skills: ['architecture-analysis', 'planning'],
              instructions: [
                'You are the planner. Use the research findings and codebase knowledge to produce a clear plan.',
                'Do not write code. Do not access the internet.',
              ].join('\n'),
            },
          }),
          developer: createRoleAgent('developer', {
            claude: {
              description: 'Implements code according to the plan. No internet access - all needed information must come from the planner or researcher.',
              skills: ['test-first', 'clean-code'],
              instructions: [
                'You are the developer. Implement the plan provided to you.',
                'You do not have internet access - ask the orchestrator to delegate research if you need information.',
                'Always write tests alongside code.',
              ].join('\n'),
            },
          }),
        },
        policies: createPolicies('research-and-build'),
      };
    case 'secure-dev':
      return {
        version: '1',
        project: {
          name: projectName,
          preset: 'secure-dev',
          description: 'High-security team with a dedicated security auditor and strict access controls.',
        },
        agents: {
          orchestrator: createRoleAgent('orchestrator', {
            claude: {
              description: 'Coordinates the team with security-first mindset. Ensures every change goes through security review.',
              tools: ['Read', 'Grep', 'Glob', 'Agent'],
              disallowed_tools: ['Edit', 'Write', 'Bash', 'WebFetch', 'WebSearch'],
              max_turns: 30,
              instructions: [
                'You are the security-conscious coordinator. Every implementation must pass security review.',
                '',
                'Workflow: planner -> developer -> security-auditor -> reviewer',
                '',
                'Never skip the security audit step. Never write code yourself.',
              ].join('\n'),
            },
            forge: {
              handoffs: ['planner', 'developer', 'security-auditor', 'reviewer'],
            },
          }),
          planner: createRoleAgent('planner', {
            claude: {
              description: 'Plans implementation with security considerations in mind. Identifies potential attack surfaces.',
              tools: ['Read', 'Grep', 'Glob'],
              disallowed_tools: ['Edit', 'Write', 'Bash', 'WebFetch', 'WebSearch'],
              skills: ['architecture-analysis', 'planning', 'threat-modeling'],
              instructions: [
                'You are the planner. In addition to the implementation plan, always include:',
                '- Security considerations for each step',
                '- Potential attack surfaces introduced by the changes',
                '- Recommendations for input validation and error handling',
              ].join('\n'),
            },
          }),
          developer: createRoleAgent('developer', {
            claude: {
              description: 'Implements code securely. Follows OWASP guidelines. No internet access.',
              skills: ['test-first', 'clean-code', 'secure-coding'],
              instructions: [
                'You are the developer. Write secure code:',
                '- Validate all inputs at system boundaries',
                '- Never trust user input',
                '- Avoid SQL injection, XSS, command injection',
                '- Use parameterized queries',
                '- Never log sensitive data',
                '',
                'Always write security-focused tests alongside regular tests.',
              ].join('\n'),
            },
          }),
          'security-auditor': createRoleAgent('security-auditor', {
            claude: {
              description: 'Performs security review of all code changes. Checks for vulnerabilities before code reaches reviewer.',
              skills: ['security-check', 'vulnerability-scan'],
              instructions: [
                'You are the security auditor. Review all code changes for:',
                '- Injection vulnerabilities (SQL, command, LDAP, XPath)',
                '- Authentication and authorization flaws',
                '- Sensitive data exposure',
                '- Security misconfiguration',
                '- Known vulnerable dependencies',
                '',
                'If you find critical issues, block the PR and explain what must be fixed.',
                'Do not modify files yourself.',
              ].join('\n'),
            },
          }),
          reviewer: createRoleAgent('reviewer', {
            claude: {
              description: 'Reviews code quality and style after security clearance.',
              skills: ['code-review'],
              instructions: [
                'You are the reviewer. Code has already passed security audit.',
                'Focus on code quality, readability, test coverage, and maintainability.',
                'Do not modify files yourself.',
              ].join('\n'),
            },
          }),
        },
        policies: createPolicies('secure-dev'),
      };
  }
}
