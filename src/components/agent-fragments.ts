import type { InstructionBlock } from '../core/instructions.js';
import type { AgentRuntime } from '../core/types.js';
import type { AgentSkill } from '../core/skills.js';
import { expandSkills, type SkillToolMap } from '../core/skill-resolver.js';

export type CapabilityTraitName =
  | 'base-read'
  | 'file-authoring'
  | 'command-execution'
  | 'web-research'
  | 'delegation'
  | 'no-file-edits'
  | 'no-commands'
  | 'no-web';

export type InstructionFragmentName =
  | 'coordination-core'
  | 'delegate-first'
  | 'planning-core'
  | 'planning-read-only'
  | 'research-core'
  | 'research-citation'
  | 'research-no-file-edits'
  | 'development-core'
  | 'development-workflow'
  | 'tester-core'
  | 'tester-read-only'
  | 'review-core'
  | 'review-feedback'
  | 'security-audit-core'
  | 'security-audit-severity'
  | 'research-handoff'
  | 'secure-planning'
  | 'secure-development'
  | 'secure-development-tests'
  | 'security-review-gate'
  | 'post-audit-review'
  | 'solo-dev-core'
  | 'solo-dev-workflow'
  | 'solo-dev-style'
  | 'feature-orchestrator-workflow'
  | 'feature-orchestrator-output'
  | 'feature-planner-workflow'
  | 'feature-planner-read-only'
  | 'feature-developer-core'
  | 'feature-developer-workflow'
  | 'feature-developer-summary'
  | 'feature-reviewer-checklist'
  | 'feature-reviewer-style'
  | 'research-orchestrator-core'
  | 'research-orchestrator-workflow'
  | 'research-orchestrator-output'
  | 'research-planner-core'
  | 'research-planner-constraints'
  | 'research-developer-core'
  | 'research-developer-tests'
  | 'secure-orchestrator-core'
  | 'secure-orchestrator-workflow'
  | 'secure-orchestrator-gate'
  | 'post-audit-review-core';

interface CapabilityTrait {
  skills?: AgentSkill[];
  deny_skills?: AgentSkill[];
}

function block(kind: InstructionBlock['kind'], content: string, title?: string): InstructionBlock {
  return { kind, content, title };
}

const CAPABILITY_TRAITS: Record<CapabilityTraitName, CapabilityTrait> = {
  'base-read': {
    skills: ['read_files', 'search'],
  },
  'file-authoring': {
    skills: ['write_files'],
  },
  'command-execution': {
    skills: ['execute'],
  },
  'web-research': {
    skills: ['web'],
  },
  delegation: {
    skills: ['delegate'],
  },
  'no-file-edits': {
    deny_skills: ['write_files'],
  },
  'no-commands': {
    deny_skills: ['execute'],
  },
  'no-web': {
    deny_skills: ['web'],
  },
};

const INSTRUCTION_FRAGMENTS: Record<InstructionFragmentName, InstructionBlock> = {
  'coordination-core': block(
    'behavior',
    'You are the coordinator. Analyze requests, break them into subtasks, and delegate to the appropriate team members.',
  ),
  'delegate-first': block(
    'delegation',
    'Prefer delegation over direct execution. Keep the team moving and synthesize results clearly.',
  ),
  'planning-core': block(
    'behavior',
    'You are the planner. Read the codebase, identify patterns, and produce step-by-step implementation plans.',
  ),
  'planning-read-only': block(
    'safety',
    'Never modify files. Focus on understanding and planning.',
  ),
  'research-core': block(
    'behavior',
    'You are the researcher. Search the web, read documentation, and provide structured research reports.',
  ),
  'research-citation': block(
    'style',
    'Always cite your sources. Summarize findings clearly.',
  ),
  'research-no-file-edits': block(
    'safety',
    'Do not modify any files.',
  ),
  'development-core': block(
    'behavior',
    'You are the developer. Implement features based on the plan, write tests, and verify the result.',
  ),
  'development-workflow': block(
    'workflow',
    'Read the relevant code before editing. Keep changes focused and validate the result.',
  ),
  'tester-core': block(
    'behavior',
    'You are the tester. Run tests, analyze failures, and report results.',
  ),
  'tester-read-only': block(
    'safety',
    'Do not modify source code.',
  ),
  'review-core': block(
    'behavior',
    'You are the reviewer. Review code for correctness, style, security, and performance.',
  ),
  'review-feedback': block(
    'style',
    'Provide actionable feedback. Do not modify files yourself.',
  ),
  'security-audit-core': block(
    'behavior',
    'You are the security auditor. Check for injection, auth flaws, data exposure, misconfigurations, and vulnerable dependencies.',
  ),
  'security-audit-severity': block(
    'safety',
    'Treat security issues as release-blocking when severity is high.',
  ),
  'research-handoff': block(
    'workflow',
    'You do not have internet access - ask the orchestrator to delegate research if you need information.',
  ),
  'secure-planning': block(
    'behavior',
    [
      'You are the planner. In addition to the implementation plan, always include:',
      '- Security considerations for each step',
      '- Potential attack surfaces introduced by the changes',
      '- Recommendations for input validation and error handling',
    ].join('\n'),
  ),
  'secure-development': block(
    'behavior',
    [
      'You are the developer. Write secure code:',
      '- Validate all inputs at system boundaries',
      '- Never trust user input',
      '- Avoid SQL injection, XSS, command injection',
      '- Use parameterized queries',
      '- Never log sensitive data',
    ].join('\n'),
  ),
  'secure-development-tests': block(
    'style',
    'Always write security-focused tests alongside regular tests.',
  ),
  'security-review-gate': block(
    'safety',
    'If you find critical issues, block the PR and explain what must be fixed. Do not modify files yourself.',
  ),
  'post-audit-review': block(
    'style',
    'Focus on code quality, readability, test coverage, and maintainability. Do not modify files yourself.',
  ),
  'solo-dev-core': block(
    'behavior',
    'You are a capable full-stack developer. Handle the task end-to-end.',
  ),
  'solo-dev-workflow': block(
    'workflow',
    [
      '1. Understand the request',
      '2. Read relevant code',
      '3. Make a plan',
      '4. Implement with tests',
      '5. Verify the result',
    ].join('\n'),
  ),
  'solo-dev-style': block(
    'style',
    'Follow existing code style. Keep changes minimal and focused.',
  ),
  'feature-orchestrator-workflow': block(
    'workflow',
    [
      'Always start by reading the task carefully. Then decide:',
      '- Does this need research or planning first? -> delegate to planner',
      '- Is the plan ready and implementation needed? -> delegate to developer',
      '- Is the implementation done and needs review? -> delegate to reviewer',
    ].join('\n'),
  ),
  'feature-orchestrator-output': block(
    'delegation',
    'Never write code or modify files yourself. Your output is always a delegation or a final summary.',
  ),
  'feature-planner-workflow': block(
    'workflow',
    'Always read the relevant files before making conclusions. Search for existing patterns and utilities that can be reused.',
  ),
  'feature-planner-read-only': block(
    'safety',
    'Your output is always a plan - never code changes.',
  ),
  'feature-reviewer-checklist': block(
    'workflow',
    [
      'Read the changed files carefully. Check for:',
      '- Correctness and edge cases',
      '- Security vulnerabilities',
      '- Code style and readability',
      '- Test coverage',
    ].join('\n'),
  ),
  'feature-reviewer-style': block(
    'style',
    'Provide clear, actionable recommendations. Do not modify files yourself.',
  ),
  'feature-developer-core': block(
    'behavior',
    'You are the developer. Your job is to implement the plan precisely.',
  ),
  'feature-developer-workflow': block(
    'workflow',
    'Always start with tests. Follow the existing code style. Do not access the internet.',
  ),
  'feature-developer-summary': block(
    'style',
    'When done, summarize what you changed and why.',
  ),
  'research-orchestrator-core': block(
    'behavior',
    'You are the coordinator. For tasks requiring external research, delegate to the researcher first.',
  ),
  'research-orchestrator-workflow': block(
    'workflow',
    'Once research is done and a plan is ready, delegate implementation to the developer.',
  ),
  'research-orchestrator-output': block(
    'delegation',
    'Never write code yourself.',
  ),
  'research-planner-core': block(
    'behavior',
    'You are the planner. Use the research findings and codebase knowledge to produce a clear plan.',
  ),
  'research-planner-constraints': block(
    'safety',
    'Do not write code. Do not access the internet.',
  ),
  'research-developer-core': block(
    'behavior',
    'You are the developer. Implement the plan provided to you.',
  ),
  'research-developer-tests': block(
    'style',
    'Always write tests alongside code.',
  ),
  'secure-orchestrator-core': block(
    'behavior',
    'You are the security-conscious coordinator. Every implementation must pass security review.',
  ),
  'secure-orchestrator-workflow': block(
    'workflow',
    'Workflow: planner -> developer -> security-auditor -> reviewer',
  ),
  'secure-orchestrator-gate': block(
    'delegation',
    'Never skip the security audit step. Never write code yourself.',
  ),
  'post-audit-review-core': block(
    'behavior',
    'You are the reviewer. Code has already passed security audit.',
  ),
};

function dedupeTools(tools: string[] | undefined): string[] | undefined {
  if (!tools?.length) return undefined;
  return [...new Set(tools)];
}

function mergeUnique<T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined {
  const merged = [...(left ?? []), ...(right ?? [])];
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

export function listCapabilityTraits(): CapabilityTraitName[] {
  return Object.keys(CAPABILITY_TRAITS) as CapabilityTraitName[];
}

export function listInstructionFragments(): InstructionFragmentName[] {
  return Object.keys(INSTRUCTION_FRAGMENTS) as InstructionFragmentName[];
}

/**
 * Resolve capability traits to allowed/disallowed tool lists using the provided skill mapping.
 * Pass the platform-specific skill map (e.g. CLAUDE_SKILL_MAP) from the caller layer.
 */
export function resolveCapabilityTraits(
  traits: CapabilityTraitName[] | undefined,
  skillMap: SkillToolMap,
): Pick<AgentRuntime, 'tools' | 'disallowedTools'> {
  const allowTools: string[] = [];
  const denyTools: string[] = [];

  for (const traitName of traits ?? []) {
    const trait = CAPABILITY_TRAITS[traitName];
    if (!trait) {
      throw new Error(`Unknown capability trait "${traitName}"`);
    }

    if (trait.skills?.length) {
      allowTools.push(...expandSkills(trait.skills, skillMap));
    }
    if (trait.deny_skills?.length) {
      denyTools.push(...expandSkills(trait.deny_skills, skillMap));
    }
  }

  return {
    tools: dedupeTools(allowTools),
    disallowedTools: dedupeTools(denyTools),
  };
}

export function resolveInstructionFragments(
  fragments: InstructionFragmentName[] | undefined,
  extraBlocks: InstructionBlock[] = [],
): InstructionBlock[] {
  const blocks = (fragments ?? []).map((fragmentName) => {
    const fragment = INSTRUCTION_FRAGMENTS[fragmentName];
    if (!fragment) {
      throw new Error(`Unknown instruction fragment "${fragmentName}"`);
    }
    return { ...fragment };
  });

  return [...extraBlocks.map((blockEntry) => ({ ...blockEntry })), ...blocks];
}

export function mergeRuntimeWithTraits(
  base: Omit<AgentRuntime, 'tools' | 'disallowedTools'> & Pick<AgentRuntime, 'tools' | 'disallowedTools'>,
  capabilityTraits: CapabilityTraitName[] | undefined,
  skillMap: SkillToolMap,
): AgentRuntime {
  const composed = resolveCapabilityTraits(capabilityTraits, skillMap);
  return {
    ...base,
    tools: mergeUnique(composed.tools, base.tools),
    disallowedTools: mergeUnique(composed.disallowedTools, base.disallowedTools),
  };
}
