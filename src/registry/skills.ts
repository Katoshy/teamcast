// Built-in skill definitions catalog.
// Each skill corresponds to a reusable agent behavior referenced by presets.

import type { SkillDefinition } from './types.js';

export const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    id: 'test-first',
    name: 'Test First',
    description: 'Write tests before implementation. Verify each change with a failing test first.',
    instructions: [
      'Before writing any implementation code, write a failing test that describes the expected behavior.',
      'Run the test to confirm it fails for the right reason.',
      'Implement the minimum code to make the test pass.',
      'Refactor if needed while keeping tests green.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['execute'],
  },
  {
    id: 'clean-code',
    name: 'Clean Code',
    description: 'Follow clean code principles: small functions, meaningful names, no duplication.',
    instructions: [
      'Keep functions small and focused on a single responsibility.',
      'Use descriptive, intention-revealing names for variables, functions, and types.',
      'Eliminate code duplication — extract shared logic into reusable helpers.',
      'Prefer composition over inheritance. Favor pure functions where possible.',
    ].join('\n'),
    source: 'builtin',
  },
  {
    id: 'planning',
    name: 'Planning',
    description: 'Analyze the codebase and produce a step-by-step implementation plan before coding.',
    instructions: [
      'Read relevant source files to understand the current architecture.',
      'Identify affected modules, types, and test files.',
      'Produce a numbered step-by-step plan with clear deliverables per step.',
      'Flag risks, open questions, and dependencies between steps.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search'],
  },
  {
    id: 'triage',
    name: 'Triage',
    description: 'Assess incoming requests: classify priority, estimate scope, identify blockers.',
    instructions: [
      'Read the request carefully and classify it: bug fix, feature, refactor, docs, or chore.',
      'Estimate scope: small (single file), medium (2-5 files), or large (cross-cutting).',
      'Identify blockers: missing context, unclear requirements, external dependencies.',
      'Summarize findings and recommend which agent or workflow should handle the task.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search'],
  },
  {
    id: 'routing',
    name: 'Routing',
    description: 'Route tasks to the appropriate specialist agent based on the request type.',
    instructions: [
      'Analyze the task to determine which specialist is best suited.',
      'Consider agent capabilities, current workload hints, and task requirements.',
      'Delegate with a clear, self-contained description of what the specialist should do.',
      'Include relevant file paths, context, and acceptance criteria in the handoff.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['delegate'],
  },
  {
    id: 'architecture-analysis',
    name: 'Architecture Analysis',
    description: 'Deep codebase analysis: module boundaries, dependency graph, design patterns.',
    instructions: [
      'Map the module structure and identify public API boundaries.',
      'Trace key data flows through the system.',
      'Identify design patterns in use (e.g., registry, strategy, observer).',
      'Note coupling hotspots, circular dependencies, and layering violations.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search'],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Review code for correctness, style, performance, and security issues.',
    instructions: [
      'Check for logical errors, edge cases, and off-by-one mistakes.',
      'Verify naming conventions, code style, and consistent patterns.',
      'Look for performance issues: unnecessary allocations, O(n^2) loops, missing caching.',
      'Flag security concerns: injection, auth bypass, data exposure.',
      'Provide actionable feedback with specific file and line references.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search'],
  },
  {
    id: 'security-check',
    name: 'Security Check',
    description: 'Check code for common security vulnerabilities and OWASP top 10 issues.',
    instructions: [
      'Scan for injection vulnerabilities: SQL, command, XSS, LDAP.',
      'Check authentication and authorization logic for bypass opportunities.',
      'Verify sensitive data handling: encryption, logging, error messages.',
      'Review dependency versions for known CVEs.',
      'Assess input validation at system boundaries.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search'],
  },
  {
    id: 'threat-modeling',
    name: 'Threat Modeling',
    description: 'Identify threat vectors, attack surfaces, and security boundaries.',
    instructions: [
      'Enumerate system entry points and trust boundaries.',
      'Identify assets worth protecting (credentials, PII, business logic).',
      'Map potential threat actors and their capabilities.',
      'Produce a threat matrix: threat, likelihood, impact, mitigation.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search'],
  },
  {
    id: 'secure-coding',
    name: 'Secure Coding',
    description: 'Write code following secure development practices and OWASP guidelines.',
    instructions: [
      'Validate all input at system boundaries. Never trust external data.',
      'Use parameterized queries — never concatenate user input into SQL or commands.',
      'Apply the principle of least privilege to file access, network calls, and permissions.',
      'Handle errors without leaking internal details. Log securely.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['write_files', 'execute'],
  },
  {
    id: 'vulnerability-scan',
    name: 'Vulnerability Scan',
    description: 'Systematically scan code for known vulnerability patterns.',
    instructions: [
      'Search for hardcoded secrets: API keys, tokens, passwords in source.',
      'Check for unsafe deserialization, prototype pollution, path traversal.',
      'Verify TLS/SSL configuration and certificate validation.',
      'Review file permission settings and temporary file handling.',
      'Report findings with severity (critical/high/medium/low) and remediation steps.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search'],
  },
  {
    id: 'research-report',
    name: 'Research Report',
    description: 'Produce a structured research report with citations and key findings.',
    instructions: [
      'Gather information from documentation, source code, and trusted references.',
      'Organize findings into sections: summary, key findings, details, recommendations.',
      'Cite sources with specific file paths, URLs, or documentation references.',
      'Highlight confidence levels: confirmed, likely, uncertain.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search', 'web'],
  },
  {
    id: 'source-validation',
    name: 'Source Validation',
    description: 'Validate information accuracy by cross-referencing multiple sources.',
    instructions: [
      'Cross-reference claims against official documentation and source code.',
      'Flag contradictions between sources. Prefer primary sources over secondary.',
      'Verify version-specific information matches the project\'s actual dependencies.',
      'Note when information could not be independently verified.',
    ].join('\n'),
    source: 'builtin',
    required_capabilities: ['read_files', 'search', 'web'],
  },
];

export function getBuiltinSkill(id: string): SkillDefinition | undefined {
  return BUILTIN_SKILLS.find((skill) => skill.id === id);
}

export function isBuiltinSkillId(id: string): boolean {
  return BUILTIN_SKILLS.some((skill) => skill.id === id);
}
